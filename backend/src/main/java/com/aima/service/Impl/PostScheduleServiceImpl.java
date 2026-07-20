package com.aima.service.Impl;

import com.aima.dto.ai.GoldenHourPayload;
import com.aima.dto.ai.GoldenHourResultPayload;
import com.aima.dto.request.PostScheduleRequest;
import com.aima.dto.request.PostScheduleUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.GoldenHourResponse;
import com.aima.dto.response.PostScheduleResponse;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PostSchedule;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentLifecycle;
import com.aima.enums.Platform;
import com.aima.enums.ScheduleStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PostScheduleMapper;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.AiServiceClient;
import com.aima.service.PostScheduleService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * FR-47..FR-51: lịch đăng bài cho một ContentVersion đã định dạng lên một tài khoản
 * nền tảng đã kết nối (BR-05). Trạng thái theo state machine WORKFLOWS.md
 * (Formatted → Scheduled; hủy lịch trả bản định dạng về FORMATTED).
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class PostScheduleServiceImpl implements PostScheduleService {

    ActivityLogService activityLogService;

    // FR-50: chỉ dời lịch khi chưa vào pipeline đăng (SCHEDULED) hoặc đang bị giữ (ON_HOLD, FR-18b).
    static final Set<ScheduleStatus> EDITABLE_STATUSES =
            EnumSet.of(ScheduleStatus.SCHEDULED, ScheduleStatus.ON_HOLD);

    // FR-51: chỉ hủy bài chưa đăng — FAILED cũng hủy được (hướng xử lý của FR-58).
    static final Set<ScheduleStatus> CANCELLABLE_STATUSES =
            EnumSet.of(ScheduleStatus.SCHEDULED, ScheduleStatus.ON_HOLD, ScheduleStatus.FAILED);

    // Item còn bản khác đang trong pipeline đăng thì không hạ trạng thái item khi hủy lịch.
    static final List<ScheduleStatus> PIPELINE_STATUSES =
            List.of(ScheduleStatus.SCHEDULED, ScheduleStatus.ON_HOLD, ScheduleStatus.POSTING, ScheduleStatus.POSTED);

    // Cache khung giờ vàng (xem suggestGoldenHours).
    static final Duration GOLDEN_HOURS_TTL = Duration.ofHours(1);
    Map<Platform, CachedGoldenHours> goldenHoursCache = new ConcurrentHashMap<>();

    PostScheduleRepository postScheduleRepository;
    ContentVersionRepository contentVersionRepository;
    PlatformAccountRepository platformAccountRepository;
    UserRepository userRepository;
    PostScheduleMapper postScheduleMapper;
    AiServiceClient aiServiceClient;

    @Override
    @Transactional
    public ApiResponse<PostScheduleResponse> create(String email, PostScheduleRequest request) {
        User user = currentUser(email);

        ContentVersion version = contentVersionRepository
                .findByIdAndContentItem_BrandProfile_User_IdAndDeletedAtIsNull(request.getContentVersionId(), user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_VERSION_NOT_FOUND));
        if (version.getStatus() != ContentLifecycle.FORMATTED) {
            throw new AppException(ErrorCode.CONTENT_VERSION_NOT_SCHEDULABLE);
        }

        PlatformAccount account = platformAccountRepository
                .findByIdAndUser_IdAndDeletedAtIsNull(request.getPlatformAccountId(), user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONNECTION_NOT_FOUND));
        // BR-05: chỉ đăng lên nền tảng đã kết nối và còn hoạt động.
        if (account.getConnectionStatus() != ConnectionStatus.ACTIVE) {
            throw new AppException(ErrorCode.CONNECTION_NOT_ACTIVE);
        }
        if (account.getPlatformName() != version.getPlatformName()) {
            throw new AppException(ErrorCode.SCHEDULE_PLATFORM_MISMATCH);
        }

        // 1-1 version↔schedule (cột content_version_id unique): lịch CANCELLED được tái sử dụng
        // khi lên lịch lại thay vì chèn bản ghi mới.
        PostSchedule schedule = postScheduleRepository
                .findByContentVersion_IdAndDeletedAtIsNull(version.getId())
                .map(existing -> {
                    if (existing.getStatus() != ScheduleStatus.CANCELLED) {
                        throw new AppException(ErrorCode.SCHEDULE_ALREADY_EXISTS);
                    }
                    existing.setPlatformAccount(account);
                    existing.setScheduledTime(request.getScheduledTime());
                    existing.setStatus(ScheduleStatus.SCHEDULED);
                    return existing;
                })
                .orElseGet(() -> postScheduleMapper.toSchedule(version, account, request.getScheduledTime()));

        PostSchedule saved = postScheduleRepository.save(schedule);

        version.setStatus(ContentLifecycle.SCHEDULED);
        version.getContentItem().setStatus(ContentLifecycle.SCHEDULED);

        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.SCHEDULE_CREATED, email, "PostSchedule", saved.getId().toString(),
                Map.of("scheduledTime", String.valueOf(saved.getScheduledTime()))));
        PostScheduleResponse response = postScheduleMapper.toResponse(saved);
        return ApiResponse.success("Đã lên lịch đăng bài", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<PostScheduleResponse>> list(String email, ScheduleStatus status, Platform platform) {
        User user = currentUser(email);
        List<PostSchedule> schedules = findSchedules(user.getId(), status, platform);
        List<PostScheduleResponse> response = postScheduleMapper.toResponseList(schedules);
        return ApiResponse.success("Lấy danh sách lịch đăng bài thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PostScheduleResponse> get(String email, UUID scheduleId) {
        PostSchedule schedule = ownedSchedule(email, scheduleId);
        PostScheduleResponse response = postScheduleMapper.toResponse(schedule);
        return ApiResponse.success("Lấy lịch đăng bài thành công", response);
    }

    @Override
    @Transactional
    public ApiResponse<PostScheduleResponse> update(String email, UUID scheduleId, PostScheduleUpdateRequest request) {
        PostSchedule schedule = ownedSchedule(email, scheduleId);
        if (!EDITABLE_STATUSES.contains(schedule.getStatus())) {
            throw new AppException(ErrorCode.SCHEDULE_NOT_EDITABLE);
        }

        schedule.setScheduledTime(request.getScheduledTime());
        // Lịch ON_HOLD (FR-18b) mà tài khoản đã ACTIVE trở lại (user kết nối lại) → dời giờ = kích hoạt lại.
        if (schedule.getStatus() == ScheduleStatus.ON_HOLD
                && schedule.getPlatformAccount().getConnectionStatus() == ConnectionStatus.ACTIVE) {
            schedule.setStatus(ScheduleStatus.SCHEDULED);
        }
        PostSchedule saved = postScheduleRepository.save(schedule);

        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.SCHEDULE_UPDATED, email, "PostSchedule", scheduleId.toString(),
                Map.of("scheduledTime", String.valueOf(saved.getScheduledTime()),
                        "status", saved.getStatus().name())));
        PostScheduleResponse response = postScheduleMapper.toResponse(saved);
        return ApiResponse.success("Cập nhật lịch đăng bài thành công", response);
    }

    @Override
    @Transactional
    public ApiResponse<PostScheduleResponse> cancel(String email, UUID scheduleId) {
        PostSchedule schedule = ownedSchedule(email, scheduleId);
        if (!CANCELLABLE_STATUSES.contains(schedule.getStatus())) {
            throw new AppException(ErrorCode.SCHEDULE_NOT_CANCELLABLE);
        }

        schedule.setStatus(ScheduleStatus.CANCELLED);
        PostSchedule saved = postScheduleRepository.save(schedule);

        // Trả bản định dạng về FORMATTED để có thể lên lịch lại (FR-39/FR-58).
        ContentVersion version = saved.getContentVersion();
        version.setStatus(ContentLifecycle.FORMATTED);

        // Chỉ hạ trạng thái item khi không còn bản nào khác của item trong pipeline đăng.
        ContentItem item = version.getContentItem();
        boolean stillInPipeline = postScheduleRepository
                .existsByContentVersion_ContentItem_IdAndStatusInAndDeletedAtIsNull(item.getId(), PIPELINE_STATUSES);
        if (!stillInPipeline) {
            item.setStatus(ContentLifecycle.FORMATTED);
        }

        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.SCHEDULE_CANCELLED, email, "PostSchedule", scheduleId.toString(), null));
        PostScheduleResponse response = postScheduleMapper.toResponse(saved);
        return ApiResponse.success("Đã hủy lịch đăng bài", response);
    }

    // FR-48: không mở transaction — gọi HTTP sang AI service (rule #24), chưa có dữ liệu analytics
    // (FR-59) nên AI trả khung giờ mặc định theo nền tảng (data_driven = false).
    //
    // Hiệu năng: kết quả hiện là MẶC ĐỊNH theo nền tảng → cache in-process 1h mỗi nền tảng
    // (mẫu cache thủ công như PlatformVersionServiceImpl), tránh một round-trip AI service
    // mỗi lần user mở modal lên lịch. Khi nào payload gửi kèm `posts` (nhánh data-driven
    // của FR-48) thì bỏ hoặc thu ngắn cache này.
    @Override
    public ApiResponse<GoldenHourResponse> suggestGoldenHours(Platform platform) {
        CachedGoldenHours cached = goldenHoursCache.get(platform);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return ApiResponse.success("Lấy gợi ý khung giờ vàng thành công", cached.response());
        }

        GoldenHourPayload payload = postScheduleMapper.toGoldenHourPayload(platform);
        GoldenHourResultPayload result = aiServiceClient.goldenHours(payload);
        GoldenHourResponse response = postScheduleMapper.toGoldenHourResponse(result);
        goldenHoursCache.put(platform, new CachedGoldenHours(response, Instant.now().plus(GOLDEN_HOURS_TTL)));
        return ApiResponse.success("Lấy gợi ý khung giờ vàng thành công", response);
    }

    private record CachedGoldenHours(GoldenHourResponse response, Instant expiresAt) {
    }

    private List<PostSchedule> findSchedules(UUID userId, ScheduleStatus status, Platform platform) {
        if (status != null && platform != null) {
            return postScheduleRepository
                    .findByPlatformAccount_User_IdAndStatusAndContentVersion_PlatformNameAndDeletedAtIsNullOrderByScheduledTimeAsc(
                            userId, status, platform);
        }
        if (status != null) {
            return postScheduleRepository
                    .findByPlatformAccount_User_IdAndStatusAndDeletedAtIsNullOrderByScheduledTimeAsc(userId, status);
        }
        if (platform != null) {
            return postScheduleRepository
                    .findByPlatformAccount_User_IdAndContentVersion_PlatformNameAndDeletedAtIsNullOrderByScheduledTimeAsc(
                            userId, platform);
        }
        return postScheduleRepository.findByPlatformAccount_User_IdAndDeletedAtIsNullOrderByScheduledTimeAsc(userId);
    }

    private PostSchedule ownedSchedule(String email, UUID scheduleId) {
        User user = currentUser(email);
        return postScheduleRepository.findByIdAndPlatformAccount_User_IdAndDeletedAtIsNull(scheduleId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.SCHEDULE_NOT_FOUND));
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
