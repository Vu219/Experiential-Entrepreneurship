package com.aima.service.Impl;

import com.aima.enums.PlanLimitKey;
import com.aima.service.PlanUsageService;
import com.aima.dto.ai.AnalyzedPostPayload;
import com.aima.dto.ai.GoldenHourPayload;
import com.aima.dto.ai.GoldenHourResultPayload;
import com.aima.dto.request.PostScheduleRequest;
import com.aima.dto.request.PostScheduleUpdateRequest;
import com.aima.dto.request.ScheduleBatchRequest;
import com.aima.dto.request.ScheduleBatchRowRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.GoldenHourResponse;
import com.aima.dto.response.PostScheduleResponse;
import com.aima.dto.response.ScheduleBatchResponse;
import com.aima.dto.response.ScheduleRowResult;
import com.aima.dto.response.ScheduleWarning;
import com.aima.dto.response.SuggestedSlotResponse;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.IdempotencyRecord;
import com.aima.entity.PlatformAccount;
import com.aima.entity.Post;
import com.aima.entity.PostAnalytics;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostingJob;
import com.aima.entity.User;
import com.aima.entity.UserPublishingSettings;
import com.aima.enums.ActivityAction;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.HoldReason;
import com.aima.enums.IdempotencyOperation;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.ReviewStatus;
import com.aima.enums.ScheduleMode;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PostScheduleMapper;
import com.aima.mapper.StrategyOptimizationMapper;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.IdempotencyRecordRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.PostingJobRepository;
import com.aima.repository.UserPublishingSettingsRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.AiServiceClient;
import com.aima.service.ContentItemStatusResolver;
import com.aima.service.PostPublishWorkerService;
import com.aima.service.PostScheduleService;
import com.aima.service.PostingDispatchService;
import com.aima.service.PublishRecoveryService;
import com.aima.service.ScheduleHoldService;
import com.aima.util.PublishingTime;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * FR-47..FR-51: lịch đăng bài cho một ContentVersion đã định dạng lên một tài khoản
 * nền tảng đã kết nối (BR-05). Lịch không đổi trạng thái sản xuất của bản; trạng thái tổng của
 * bài do {@link ContentItemStatusResolver} tính lại sau mỗi thay đổi (khóa bài trước khi đổi lịch).
 *
 * <p>Phase 3: tạo đơn / batch / "Đăng ngay" dùng CHUNG một luồng dòng ({@link #runRow}) — mỗi dòng một
 * transaction độc lập qua {@link TransactionTemplate} (không self-invocation @Transactional), idempotent
 * theo key của client; claim + tạo job qua {@link PostingDispatchService} như dispatcher, giao worker SAU commit.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class PostScheduleServiceImpl implements PostScheduleService {

    ActivityLogService activityLogService;

    // FR-50: chỉ dời lịch khi chưa vào pipeline đăng (SCHEDULED) hoặc đang bị giữ (ON_HOLD, FR-18b).
    static final String PENDING_DELETE_JOB_STOP_REASON = "Tạm dừng: tài khoản đang chờ xóa";

    static final Set<ScheduleStatus> EDITABLE_STATUSES =
            EnumSet.of(ScheduleStatus.SCHEDULED, ScheduleStatus.ON_HOLD);

    // FR-51: chỉ hủy bài chưa đăng — FAILED cũng hủy được (hướng xử lý của FR-58).
    static final Set<ScheduleStatus> CANCELLABLE_STATUSES =
            EnumSet.of(ScheduleStatus.SCHEDULED, ScheduleStatus.ON_HOLD, ScheduleStatus.FAILED);

    /** Lịch "chiếm chỗ" của một tài khoản — dùng cho cảnh báo trùng lịch và khung giờ gợi ý. */
    static final List<ScheduleStatus> OCCUPYING_STATUSES =
            List.of(ScheduleStatus.SCHEDULED, ScheduleStatus.ON_HOLD, ScheduleStatus.POSTING);

    /** Giá trị mặc định của cột conflict_window_minutes (Flyway V2) khi user chưa có dòng settings. */
    static final int DEFAULT_CONFLICT_WINDOW_MINUTES = 60;
    static final int DEFAULT_SUGGESTED_SLOTS = 5;
    static final int MAX_SUGGESTED_SLOTS = 20;
    static final int SUGGESTION_HORIZON_DAYS = 30;
    static final Pattern HOUR_MINUTE = Pattern.compile("(\\d{1,2}):(\\d{2})");

    // Cache khung giờ vàng (xem goldenHours) — theo (user, nền tảng): kết quả data-driven là riêng của từng user.
    static final Duration GOLDEN_HOURS_TTL = Duration.ofHours(1);
    Map<GoldenHourKey, CachedGoldenHours> goldenHoursCache = new ConcurrentHashMap<>();
    // FR-48: AI chỉ dùng dữ liệu khi có ≥ 10 bài (ai/src/agents/optimizer.py) — chọn mốc số liệu có đủ ngần ấy bài.
    static final int GOLDEN_HOURS_MIN_POSTS = 10;
    static final int GOLDEN_HOURS_MAX_POSTS = 100;
    static final List<Integer> GOLDEN_HOURS_MILESTONES = List.of(168, 48, 24);

    PostScheduleRepository postScheduleRepository;
    ContentVersionRepository contentVersionRepository;
    PlatformAccountRepository platformAccountRepository;
    UserRepository userRepository;
    PostScheduleMapper postScheduleMapper;
    PostingJobRepository postingJobRepository;
    AiServiceClient aiServiceClient;
    ContentItemStatusResolver statusResolver;
    ScheduleHoldService holdService;
    UserPublishingSettingsRepository settingsRepository;
    IdempotencyRecordRepository idempotencyRepository;
    PostingDispatchService dispatchService;
    PostPublishWorkerService postPublishWorkerService;
    TransactionTemplate transactionTemplate;
    PostRepository postRepository;
    StrategyOptimizationMapper strategyOptimizationMapper;
    PublishRecoveryService recoveryService;
    PlanUsageService planUsageService;

    /** Đầu vào chuẩn hoá của MỘT dòng tạo lịch (đơn hay batch). */
    private record RowInput(UUID contentVersionId, UUID platformAccountId, ScheduleMode mode, Instant scheduledTime) {
    }

    /** Kết quả dòng trong transaction; jobId ≠ null thì giao worker SAU commit. */
    private record RowOutcome(PostScheduleResponse response, UUID jobId) {
    }

    // ===================================================================== tạo lịch (đơn / batch / NOW)

    @Override
    public ApiResponse<PostScheduleResponse> create(String email, PostScheduleRequest request, String idempotencyKey) {
        ScheduleMode mode = modeOf(request.getMode());
        if (mode == ScheduleMode.SCHEDULE) {
            requireFuture(request.getScheduledTime());
        }
        String key = normalizeKey(idempotencyKey);
        User user = currentUser(email);
        PostScheduleResponse response = runRow(user, new RowInput(request.getContentVersionId(),
                request.getPlatformAccountId(), mode, request.getScheduledTime()), key);
        return ApiResponse.success(mode == ScheduleMode.NOW ? "Đã tạo lịch và bắt đầu đăng ngay" : "Đã lên lịch đăng bài",
                response);
    }

    @Override
    public ApiResponse<ScheduleBatchResponse> createBatch(String email, ScheduleBatchRequest request) {
        User user = currentUser(email);
        List<ScheduleRowResult> rows = new ArrayList<>();
        for (ScheduleBatchRowRequest row : request.getRows()) {
            rows.add(runBatchRow(user, row));
        }
        int succeeded = (int) rows.stream().filter(r -> r.getSchedule() != null).count();
        ScheduleBatchResponse response = postScheduleMapper.toBatchResponse(rows, succeeded, rows.size() - succeeded);
        return ApiResponse.success("Đã xử lý " + rows.size() + " dòng lên lịch (" + succeeded + " thành công)", response);
    }

    // Dòng lỗi KHÔNG làm hỏng dòng khác: mỗi dòng có transaction riêng, lỗi trả code/message của ErrorCode.
    private ScheduleRowResult runBatchRow(User user, ScheduleBatchRowRequest row) {
        try {
            ScheduleMode mode = modeOf(row.getMode());
            if (mode == ScheduleMode.SCHEDULE) {
                requireFuture(row.getScheduledTime());
            }
            PostScheduleResponse schedule = runRow(user, new RowInput(row.getContentVersionId(),
                    row.getPlatformAccountId(), mode, row.getScheduledTime()), normalizeKey(row.getIdempotencyKey()));
            return postScheduleMapper.toRowResult(row.getClientRowId(), 200, "Success", schedule);
        } catch (AppException e) {
            return postScheduleMapper.toRowResult(row.getClientRowId(), e.getErrorCode().getCode(),
                    e.getErrorCode().getMessage(), null);
        } catch (Exception e) {
            log.error("[Schedule] Dòng {} của batch lỗi ngoài dự kiến", row.getClientRowId(), e);
            return postScheduleMapper.toRowResult(row.getClientRowId(), ErrorCode.UNCATEGORIZED_EXCEPTION.getCode(),
                    ErrorCode.UNCATEGORIZED_EXCEPTION.getMessage(), null);
        }
    }

    private PostScheduleResponse runRow(User user, RowInput in, String key) {
        String hash = key == null ? null : sha256(in.contentVersionId() + "|" + in.platformAccountId() + "|" + in.mode()
                + "|" + (in.mode() == ScheduleMode.NOW ? "" : in.scheduledTime().toEpochMilli()));
        try {
            RowOutcome outcome = transactionTemplate.execute(tx -> createInTx(user, in, key, hash));
            dispatchAfterCommit(outcome.jobId());
            return outcome.response();
        } catch (RuntimeException e) {
            // Cùng key vừa thành công ở request song song (hoặc trước khi mất response) → trả lại kết quả cũ.
            PostScheduleResponse replay = key == null ? null
                    : transactionTemplate.execute(tx -> replay(user, IdempotencyOperation.SCHEDULE_CREATE, key, hash).orElse(null));
            if (replay != null) {
                return replay;
            }
            throw e;
        }
    }

    private RowOutcome createInTx(User user, RowInput in, String key, String hash) {
        if (key != null) {
            Optional<PostScheduleResponse> replay = replay(user, IdempotencyOperation.SCHEDULE_CREATE, key, hash);
            if (replay.isPresent()) {
                return new RowOutcome(replay.get(), null);
            }
        }
        requireNotPendingDelete(user);
        requirePlanAllows(user, in);

        // Khóa bài trước khi nạp bản/lịch (thứ tự item → version → schedule) — bản và lịch đọc sau khóa là mới nhất.
        UUID itemId = contentVersionRepository
                .findOwnedContentItemId(in.contentVersionId(), user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_VERSION_NOT_FOUND));
        ContentItem item = statusResolver.lock(itemId);
        ContentVersion version = contentVersionRepository
                .findByIdAndContentItem_BrandProfile_User_IdAndDeletedAtIsNull(in.contentVersionId(), user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_VERSION_NOT_FOUND));
        if (version.getStatus() != ContentVersionStatus.FORMATTED) {
            throw new AppException(ErrorCode.CONTENT_VERSION_NOT_SCHEDULABLE);
        }
        // FR-71: Instagram Content Publishing bắt buộc ảnh/video, MVP chỉ đăng chữ → chặn ngay ở BE.
        if (version.getPlatformName() == Platform.INSTAGRAM) {
            throw new AppException(ErrorCode.SCHEDULE_PLATFORM_UNSUPPORTED);
        }
        requireBrandVoice(user.getId(), version);
        PlatformAccount account = usableAccount(user, in.platformAccountId(), version.getPlatformName());
        if (in.mode() == ScheduleMode.NOW) {
            // Không tạo một lịch giữ đã quá giờ: đăng ngay bài chưa duyệt khi bắt buộc duyệt → báo cần duyệt trước.
            requireApprovedForNow(user, item);
        }
        Instant time = in.mode() == ScheduleMode.NOW ? Instant.now() : in.scheduledTime();

        // 1-1 version↔schedule (cột content_version_id unique): lịch CANCELLED được tái sử dụng
        // khi lên lịch lại thay vì chèn bản ghi mới.
        PostSchedule schedule = postScheduleRepository
                .findByContentVersion_IdAndDeletedAtIsNull(version.getId())
                .map(existing -> {
                    if (existing.getStatus() != ScheduleStatus.CANCELLED) {
                        throw new AppException(ErrorCode.SCHEDULE_ALREADY_EXISTS);
                    }
                    existing.setPlatformAccount(account);
                    existing.setScheduledTime(time);
                    existing.setStatus(ScheduleStatus.SCHEDULED);
                    return existing;
                })
                .orElseGet(() -> postScheduleMapper.toSchedule(version, account, time));
        UUID scheduleId = postScheduleRepository.saveAndFlush(schedule).getId();
        // Bắt buộc duyệt + bài chưa duyệt → lịch tạo ra ở ON_HOLD (PENDING_REVIEW); resolver tính lại trạng thái bài.
        holdService.syncReviewHolds(item);

        UUID jobId = in.mode() == ScheduleMode.NOW ? dispatchNow(scheduleId) : null;
        PostSchedule saved = postScheduleRepository.findById(scheduleId).orElseThrow(); // dispatch có thể đã clear context
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.SCHEDULE_CREATED, user.getEmail(), "PostSchedule", scheduleId.toString(),
                Map.of("scheduledTime", String.valueOf(saved.getScheduledTime()), "mode", in.mode().name())));
        remember(user, IdempotencyOperation.SCHEDULE_CREATE, key, hash, scheduleId, jobId);
        return new RowOutcome(toResponse(saved, jobId), jobId);
    }

    /**
     * Giới hạn gói (V18): số lịch tạo trong kỳ (cả "Đăng ngay"); riêng chế độ hẹn giờ còn cần gói có lên lịch,
     * trong số ngày tối đa và còn chỗ trong hàng chờ. Replay idempotency đã trả trước đó nên không tốn lượt.
     */
    private void requirePlanAllows(User user, RowInput in) {
        planUsageService.requireQuota(user, PlanLimitKey.SCHEDULED_POSTS_PER_PERIOD, null);
        if (in.mode() == ScheduleMode.SCHEDULE) {
            planUsageService.requireIncluded(user, PlanLimitKey.SCHEDULING);
            planUsageService.requireScheduleHorizon(user, in.scheduledTime());
            planUsageService.requireQuota(user, PlanLimitKey.ACTIVE_SCHEDULES, null);
        }
    }

    // ===================================================================== đăng ngay (Calendar)

    @Override
    public ApiResponse<PostScheduleResponse> publishNow(String email, UUID scheduleId, String idempotencyKey) {
        String key = normalizeKey(idempotencyKey);
        User user = currentUser(email);
        String hash = key == null ? null : sha256("publish-now|" + scheduleId);
        try {
            RowOutcome outcome = transactionTemplate.execute(tx -> publishNowInTx(user, scheduleId, key, hash));
            dispatchAfterCommit(outcome.jobId());
            return ApiResponse.success("Đã bắt đầu đăng ngay", outcome.response());
        } catch (RuntimeException e) {
            PostScheduleResponse replay = key == null ? null
                    : transactionTemplate.execute(tx -> replay(user, IdempotencyOperation.PUBLISH_NOW, key, hash).orElse(null));
            if (replay != null) {
                return ApiResponse.success("Đã bắt đầu đăng ngay", replay);
            }
            throw e;
        }
    }

    private RowOutcome publishNowInTx(User user, UUID scheduleId, String key, String hash) {
        if (key != null) {
            Optional<PostScheduleResponse> replay = replay(user, IdempotencyOperation.PUBLISH_NOW, key, hash);
            if (replay.isPresent()) {
                return new RowOutcome(replay.get(), null);
            }
        }
        requireNotPendingDelete(user);
        LockedSchedule locked = lockedOwnedSchedule(user, scheduleId);
        PostSchedule schedule = locked.schedule();
        if (schedule.getStatus() == ScheduleStatus.ON_HOLD) {
            // Còn lý do tạm giữ (chưa duyệt, mất kết nối, IG...) → không đăng; hết lý do (vd duyệt muộn) → đăng được.
            if (!schedule.getHolds().isEmpty()) {
                throw new AppException(ErrorCode.SCHEDULE_HELD_CANNOT_PUBLISH);
            }
        } else if (schedule.getStatus() != ScheduleStatus.SCHEDULED) {
            throw new AppException(ErrorCode.SCHEDULE_NOT_EDITABLE);
        }
        requireApprovedForNow(user, statusResolver.lock(locked.itemId()));
        PlatformAccount account = schedule.getPlatformAccount();
        if (account.getDeletedAt() != null || account.getConnectionStatus() != ConnectionStatus.ACTIVE) {
            throw new AppException(ErrorCode.CONNECTION_NOT_ACTIVE);
        }
        schedule.setScheduledTime(Instant.now());
        schedule.setStatus(ScheduleStatus.SCHEDULED);
        postScheduleRepository.saveAndFlush(schedule);

        UUID jobId = dispatchNow(scheduleId);
        PostSchedule saved = postScheduleRepository.findById(scheduleId).orElseThrow();
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.SCHEDULE_UPDATED, user.getEmail(), "PostSchedule", scheduleId.toString(),
                Map.of("publishNow", "true", "jobId", String.valueOf(jobId))));
        remember(user, IdempotencyOperation.PUBLISH_NOW, key, hash, scheduleId, jobId);
        return new RowOutcome(toResponse(saved, jobId), jobId);
    }

    // Cùng dịch vụ claim với dispatcher: lịch bị chốt chặn giữ lại → báo lỗi (transaction dòng rollback);
    // 0 row claim được = dispatcher/request khác vừa claim → coi như không còn để đăng ngay.
    private UUID dispatchNow(UUID scheduleId) {
        PostingDispatchService.Outcome outcome = dispatchService.dispatch(scheduleId);
        if (outcome.heldFor() != null) {
            throw new AppException(outcome.heldFor() == HoldReason.UNSUPPORTED_MEDIA
                    ? ErrorCode.SCHEDULE_PLATFORM_UNSUPPORTED : ErrorCode.SCHEDULE_HELD_CANNOT_PUBLISH);
        }
        if (outcome.jobId() == null) {
            throw new AppException(ErrorCode.SCHEDULE_NOT_EDITABLE);
        }
        return outcome.jobId();
    }

    private void dispatchAfterCommit(UUID jobId) {
        if (jobId != null) {
            // Gọi SAU khi transaction dòng đã commit — worker @Async đọc thấy job; mất dispatch thì
            // PostingDispatchJob.redispatchStalePending vớt lại (job PENDING > 5 phút).
            postPublishWorkerService.process(jobId);
        }
    }

    // ===================================================================== idempotency

    private Optional<PostScheduleResponse> replay(User user, IdempotencyOperation operation, String key, String hash) {
        return idempotencyRepository.findByOwnerIdAndOperationAndIdempotencyKey(user.getId(), operation, key)
                .map(record -> {
                    if (!record.getRequestHash().equals(hash)) {
                        throw new AppException(ErrorCode.IDEMPOTENCY_KEY_REUSED);
                    }
                    PostSchedule schedule = postScheduleRepository.findById(record.getScheduleId())
                            .orElseThrow(() -> new AppException(ErrorCode.SCHEDULE_NOT_FOUND));
                    return toResponse(schedule, record.getJobId());
                });
    }

    // Chỉ lưu dòng THÀNH CÔNG, trong cùng transaction với lịch: unique (chủ, thao tác, key) chặn request trùng
    // chạy song song — bên thua rollback cả lịch vừa tạo rồi trả lại kết quả của bên thắng.
    private void remember(User user, IdempotencyOperation operation, String key, String hash, UUID scheduleId, UUID jobId) {
        if (key == null) {
            return;
        }
        IdempotencyRecord record = postScheduleMapper.toIdempotencyRecord(user.getId(), operation, key, hash, scheduleId,
                jobId, Instant.now());
        idempotencyRepository.saveAndFlush(record);
    }

    private static String normalizeKey(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        String trimmed = key.trim();
        if (trimmed.length() > 64) {
            throw new AppException(ErrorCode.IDEMPOTENCY_KEY_INVALID);
        }
        return trimmed;
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 không khả dụng", e);
        }
    }

    // ===================================================================== tạm giữ theo vòng đời tài khoản

    @Override
    @Transactional
    public int holdAllForPendingDeletion(UUID userId) {
        List<PostingJobStatus> inFlight = List.of(PostingJobStatus.PENDING, PostingJobStatus.RETRYING);
        // Khóa mọi bài liên quan TRƯỚC khi đổi lịch/job (thứ tự item → schedule → job).
        List<ScheduleStatus> waitingStatuses = List.of(ScheduleStatus.SCHEDULED, ScheduleStatus.ON_HOLD);
        Set<UUID> itemIds = new HashSet<>(postScheduleRepository.findContentItemIdsByUser(userId, waitingStatuses));
        itemIds.addAll(postingJobRepository.findInFlightContentItemIdsByUser(userId, inFlight));
        statusResolver.lockAll(itemIds);

        int held = 0;
        for (PostSchedule schedule : postScheduleRepository.findByPlatformAccount_User_IdAndStatusInAndDeletedAtIsNull(userId, waitingStatuses)) {
            if (itemIds.contains(itemIdOf(schedule)) && holdService.hold(schedule, HoldReason.USER_PENDING_DELETE)) {
                held++;
            }
        }

        // Bài đang giữa chu kỳ đăng (job PENDING chờ chạy / RETRYING chờ thử lại): dừng job, đưa lịch
        // về ON_HOLD như lịch chờ thường — user kích hoạt lại thì dispatcher mở chu kỳ đăng mới.
        Instant now = Instant.now();
        for (PostingJob job : postingJobRepository.findInFlightByUser(userId, inFlight)) {
            PostSchedule schedule = job.getPost().getSchedule();
            if (!itemIds.contains(itemIdOf(schedule))) {
                continue; // job mới sinh sau lúc khóa — lần sau xử lý, không đổi lịch khi chưa khóa bài
            }
            job.setStatus(PostingJobStatus.FAILED);
            job.setEndTime(now);
            job.setErrorMessage(PENDING_DELETE_JOB_STOP_REASON);
            if (schedule.getStatus() == ScheduleStatus.POSTING) {
                schedule.setStatus(ScheduleStatus.ON_HOLD);
                holdService.hold(schedule, HoldReason.USER_PENDING_DELETE);
                held++;
            }
        }
        statusResolver.refreshAll(itemIds);
        return held;
    }

    @Override
    @Transactional
    public int releasePendingDeletionHolds(UUID userId) {
        // Job PENDING/RETRYING còn sót (worker ghi retry đúng lúc user yêu cầu xoá) phải dừng TRƯỚC khi gỡ lý do,
        // nếu không dispatcher sẽ tự đăng lại ngay khi tài khoản được khôi phục.
        holdAllForPendingDeletion(userId);
        return holdService.releaseForUser(userId, HoldReason.USER_PENDING_DELETE, false);
    }

    @Override
    @Transactional(readOnly = true)
    public int countOnHold(UUID userId) {
        return postScheduleRepository
                .findByPlatformAccount_User_IdAndStatusAndDeletedAtIsNullOrderByScheduledTimeAsc(userId, ScheduleStatus.ON_HOLD)
                .size();
    }

    // ===================================================================== đọc / dời / hủy

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
        requireFuture(request.getScheduledTime());
        User user = currentUser(email);
        planUsageService.requireScheduleHorizon(user, request.getScheduledTime());
        LockedSchedule locked = lockedOwnedSchedule(user, scheduleId);
        PostSchedule schedule = locked.schedule();
        // Tài khoản chờ xoá: không kích hoạt lại / dời lịch — khôi phục tài khoản trước.
        requireNotPendingDelete(schedule.getPlatformAccount().getUser());
        if (!EDITABLE_STATUSES.contains(schedule.getStatus())) {
            throw new AppException(ErrorCode.SCHEDULE_NOT_EDITABLE);
        }

        // Chuyển sang tài khoản khác CÙNG nền tảng: gỡ các lý do gắn với tài khoản cũ (đã ngắt / lỗi kết nối).
        UUID targetId = request.getPlatformAccountId();
        if (targetId != null && !targetId.equals(schedule.getPlatformAccount().getId())) {
            PlatformAccount target = usableAccount(user, targetId, schedule.getContentVersion().getPlatformName());
            schedule.setPlatformAccount(target);
            holdService.release(schedule, HoldReason.ACCOUNT_REMOVED, false);
            holdService.release(schedule, HoldReason.ACCOUNT_ISSUE, false);
        }

        schedule.setScheduledTime(request.getScheduledTime());
        // Lịch ON_HOLD: dời giờ = kích hoạt lại, CHỈ khi không còn lý do tạm giữ nào (duyệt, kết nối, IG...)
        // và tài khoản đích còn hoạt động; còn lý do thì chỉ đổi giờ, lịch vẫn giữ.
        PlatformAccount account = schedule.getPlatformAccount();
        if (schedule.getStatus() == ScheduleStatus.ON_HOLD && schedule.getHolds().isEmpty()
                && account.getDeletedAt() == null && account.getConnectionStatus() == ConnectionStatus.ACTIVE) {
            schedule.setStatus(ScheduleStatus.SCHEDULED);
        }
        PostSchedule saved = postScheduleRepository.save(schedule);
        statusResolver.refresh(locked.itemId());

        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.SCHEDULE_UPDATED, email, "PostSchedule", scheduleId.toString(),
                Map.of("scheduledTime", String.valueOf(saved.getScheduledTime()),
                        "status", saved.getStatus().name())));
        PostScheduleResponse response = toResponse(saved, null);
        return ApiResponse.success("Cập nhật lịch đăng bài thành công", response);
    }

    @Override
    @Transactional
    public ApiResponse<PostScheduleResponse> cancel(String email, UUID scheduleId) {
        User user = currentUser(email);
        LockedSchedule locked = lockedOwnedSchedule(user, scheduleId);
        PostSchedule schedule = locked.schedule();
        if (!CANCELLABLE_STATUSES.contains(schedule.getStatus())) {
            throw new AppException(ErrorCode.SCHEDULE_NOT_CANCELLABLE);
        }
        // Lịch FAILED bị huỷ = cách xử lý lần đăng lỗi (vòng đời bài lỗi → CANCELLED), trước khi đổi trạng thái.
        recoveryService.markCancelled(schedule, user.getId());

        // Bản vẫn FORMATTED nên lên lịch lại được (FR-39/FR-58); duyệt nằm ở item, không bị đụng.
        schedule.setStatus(ScheduleStatus.CANCELLED);
        schedule.getHolds().clear(); // lịch hủy không còn bị "giữ"; tái sử dụng khi lên lịch lại sẽ đồng bộ lại
        PostSchedule saved = postScheduleRepository.save(schedule);
        statusResolver.refresh(locked.itemId());

        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.SCHEDULE_CANCELLED, email, "PostSchedule", scheduleId.toString(), null));
        PostScheduleResponse response = postScheduleMapper.toResponse(saved);
        return ApiResponse.success("Đã hủy lịch đăng bài", response);
    }

    // ===================================================================== gợi ý giờ

    // FR-48: mặc định theo nền tảng tới khi user có ≥ 10 bài AIMA có số liệu trên nền tảng đó, sau đó theo dữ liệu.
    @Override
    public ApiResponse<GoldenHourResponse> suggestGoldenHours(String email, Platform platform) {
        User user = currentUser(email);
        planUsageService.requireIncluded(user, PlanLimitKey.GOLDEN_HOURS);
        GoldenHourResponse response = goldenHours(user.getId(), platform);
        return ApiResponse.success("Lấy gợi ý khung giờ vàng thành công", response);
    }

    // Không giữ transaction quanh lời gọi AI (rule #24): dựng `posts` trong transaction ngắn rồi gọi HTTP ở ngoài.
    // Cache in-process 1h theo (user, nền tảng) (mẫu cache thủ công như PlatformVersionServiceImpl), tránh một
    // round-trip AI service mỗi lần user mở modal lên lịch.
    private GoldenHourResponse goldenHours(UUID userId, Platform platform) {
        GoldenHourKey key = new GoldenHourKey(userId, platform);
        CachedGoldenHours cached = goldenHoursCache.get(key);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return cached.response();
        }

        List<AnalyzedPostPayload> posts = transactionTemplate.execute(tx -> goldenHourPosts(userId, platform));
        GoldenHourPayload payload = postScheduleMapper.toGoldenHourPayload(platform, posts == null ? List.of() : posts);
        GoldenHourResultPayload result = aiServiceClient.goldenHours(payload);
        GoldenHourResponse response = postScheduleMapper.toGoldenHourResponse(result);
        goldenHoursCache.put(key, new CachedGoldenHours(response, Instant.now().plus(GOLDEN_HOURS_TTL)));
        return response;
    }

    // Bài AIMA đã đăng của user trên nền tảng, mỗi bài một snapshot ở CÙNG một mốc (24/48/168h — trộn mốc làm
    // bài cũ trông "tốt" hơn); giờ đăng tính theo múi giờ đăng bài của user như khung giờ gợi ý.
    private List<AnalyzedPostPayload> goldenHourPosts(UUID userId, Platform platform) {
        List<Post> posts = postRepository
                .findBySchedule_PlatformAccount_User_IdAndPlatformNameAndStatusAndDeletedAtIsNullOrderByPublishedAtDesc(
                        userId, platform, PostStatus.POSTED,
                        PageRequest.of(0, GOLDEN_HOURS_MAX_POSTS));
        Integer milestone = goldenHourMilestone(posts);
        if (milestone == null) {
            return List.of();
        }
        ZoneId zone = settingsRepository.findById(userId)
                .map(settings -> ZoneId.of(settings.getTimezone()))
                .orElse(PublishingTime.LEGACY_ZONE);
        List<AnalyzedPostPayload> payloads = new ArrayList<>();
        for (Post post : posts) {
            PostAnalytics snapshot = milestoneOf(post, milestone);
            if (snapshot != null) {
                payloads.add(strategyOptimizationMapper.toAnalyzedPostPayload(
                        post, post.getSchedule().getContentVersion(), snapshot, zone));
            }
        }
        return payloads;
    }

    // Mốc DÀI nhất có ≥ GOLDEN_HOURS_MIN_POSTS bài; không mốc nào đủ → mốc nhiều bài nhất (AI sẽ trả mặc định).
    static Integer goldenHourMilestone(List<Post> posts) {
        Integer best = null;
        long bestCount = 0;
        for (int milestone : GOLDEN_HOURS_MILESTONES) {
            long count = posts.stream().filter(p -> milestoneOf(p, milestone) != null).count();
            if (count >= GOLDEN_HOURS_MIN_POSTS) {
                return milestone;
            }
            if (count > bestCount) {
                best = milestone;
                bestCount = count;
            }
        }
        return best;
    }

    private static PostAnalytics milestoneOf(Post post, int milestone) {
        return post.getPostAnalytics().stream()
                .filter(a -> a.getDeletedAt() == null && Integer.valueOf(milestone).equals(a.getMilestoneHours()))
                .findFirst()
                .orElse(null);
    }

    // Khung giờ vàng còn trống của MỘT tài khoản theo múi giờ đăng của user: bỏ giờ đã qua và giờ nằm trong
    // cửa sổ trùng lịch của lịch đang chiếm chỗ. Không tạo lịch, không giữ slot. Không mở transaction (gọi AI).
    @Override
    public ApiResponse<List<SuggestedSlotResponse>> suggestSlots(String email, UUID accountId, Instant from, Integer count) {
        int wanted = count == null ? DEFAULT_SUGGESTED_SLOTS : count;
        if (wanted < 1 || wanted > MAX_SUGGESTED_SLOTS) {
            throw new AppException(ErrorCode.SUGGESTED_SLOT_COUNT_INVALID);
        }
        User user = currentUser(email);
        planUsageService.requireIncluded(user, PlanLimitKey.GOLDEN_HOURS);
        PlatformAccount account = platformAccountRepository.findByIdAndUser_IdAndDeletedAtIsNull(accountId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONNECTION_NOT_FOUND));
        if (account.getConnectionStatus() != ConnectionStatus.ACTIVE) {
            throw new AppException(ErrorCode.CONNECTION_NOT_ACTIVE);
        }
        UserPublishingSettings settings = settingsRepository.findById(user.getId()).orElse(null);
        ZoneId zone = ZoneId.of(settings == null ? "Asia/Ho_Chi_Minh" : settings.getTimezone());
        Duration window = Duration.ofMinutes(settings == null ? DEFAULT_CONFLICT_WINDOW_MINUTES : settings.getConflictWindowMinutes());
        List<Instant> occupied = postScheduleRepository
                .findByPlatformAccount_IdAndStatusInAndDeletedAtIsNull(accountId, OCCUPYING_STATUSES).stream()
                .map(PostSchedule::getScheduledTime).toList();

        List<String> windows = goldenHours(user.getId(), account.getPlatformName()).getSuggestedHours();
        Instant earliest = from != null && from.isAfter(Instant.now()) ? from : Instant.now();
        List<SuggestedSlotResponse> slots = new ArrayList<>();
        LocalDate day = earliest.atZone(zone).toLocalDate();
        for (int d = 0; d <= SUGGESTION_HORIZON_DAYS && slots.size() < wanted; d++, day = day.plusDays(1)) {
            for (String slotWindow : windows == null ? List.<String>of() : windows) {
                LocalTime start = windowStart(slotWindow);
                if (start == null) {
                    continue;
                }
                Instant candidate = day.atTime(start).atZone(zone).toInstant();
                boolean free = occupied.stream().noneMatch(t -> Duration.between(t, candidate).abs().compareTo(window) < 0);
                if (candidate.isAfter(earliest) && free && slots.size() < wanted) {
                    slots.add(postScheduleMapper.toSuggestedSlot(candidate, slotWindow));
                }
            }
        }
        return ApiResponse.success("Lấy khung giờ gợi ý thành công", slots);
    }

    private static LocalTime windowStart(String slotWindow) {
        Matcher m = slotWindow == null ? null : HOUR_MINUTE.matcher(slotWindow);
        if (m == null || !m.find()) {
            return null;
        }
        int hour = Integer.parseInt(m.group(1));
        int minute = Integer.parseInt(m.group(2));
        return hour < 24 && minute < 60 ? LocalTime.of(hour, minute) : null;
    }

    private record CachedGoldenHours(GoldenHourResponse response, Instant expiresAt) {
    }

    private record GoldenHourKey(UUID userId, Platform platform) {
    }

    // ===================================================================== helpers

    private PostScheduleResponse toResponse(PostSchedule schedule, UUID jobId) {
        PostScheduleResponse response = postScheduleMapper.toResponse(schedule);
        response.setJobId(jobId);
        response.setWarnings(conflicts(schedule));
        return response;
    }

    // Cảnh báo (không chặn, không unique): lịch khác cùng tài khoản gần hơn cửa sổ trùng lịch của user.
    private List<ScheduleWarning> conflicts(PostSchedule schedule) {
        int minutes = settingsRepository.findById(schedule.getPlatformAccount().getUser().getId())
                .map(UserPublishingSettings::getConflictWindowMinutes).orElse(DEFAULT_CONFLICT_WINDOW_MINUTES);
        if (minutes <= 0) {
            return List.of();
        }
        Duration window = Duration.ofMinutes(minutes);
        return postScheduleRepository
                .findByPlatformAccount_IdAndStatusInAndDeletedAtIsNull(schedule.getPlatformAccount().getId(), OCCUPYING_STATUSES)
                .stream()
                .filter(other -> !other.getId().equals(schedule.getId()))
                .filter(other -> Duration.between(other.getScheduledTime(), schedule.getScheduledTime()).abs().compareTo(window) < 0)
                .map(postScheduleMapper::toConflictWarning)
                .toList();
    }

    // BR-05: chỉ đăng lên kết nối của chính user, còn hoạt động, đúng nền tảng; Facebook chỉ lên Trang.
    private PlatformAccount usableAccount(User user, UUID accountId, Platform platform) {
        PlatformAccount account = platformAccountRepository
                .findByIdAndUser_IdAndDeletedAtIsNull(accountId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONNECTION_NOT_FOUND));
        if (account.getConnectionStatus() != ConnectionStatus.ACTIVE) {
            throw new AppException(ErrorCode.CONNECTION_NOT_ACTIVE);
        }
        if (account.getPlatformName() != platform) {
            throw new AppException(ErrorCode.SCHEDULE_PLATFORM_MISMATCH);
        }
        // Graph API không cho đăng lên trang cá nhân — kết nối Facebook USER chỉ là gốc để lấy Trang.
        if (account.getPlatformName() == Platform.FACEBOOK && account.getAccountType() != PlatformAccountType.PAGE) {
            throw new AppException(ErrorCode.SCHEDULE_TARGET_NOT_PAGE);
        }
        return account;
    }

    private void requireApprovedForNow(User user, ContentItem item) {
        if (item.getReviewStatus() != ReviewStatus.APPROVED && holdService.requiresApproval(user.getId())) {
            throw new AppException(ErrorCode.REVIEW_REQUIRED_BEFORE_PUBLISH);
        }
    }

    // Người dùng bật chặn brand voice: bản dưới ngưỡng (hoặc chưa chấm) không lên lịch được.
    private void requireBrandVoice(UUID userId, ContentVersion version) {
        settingsRepository.findById(userId)
                .filter(s -> s.isBrandVoiceBlockingEnabled() && s.getBrandVoiceThreshold() != null)
                .ifPresent(s -> {
                    Integer score = version.getVoiceScore();
                    if (score == null || score < s.getBrandVoiceThreshold()) {
                        throw new AppException(ErrorCode.BRAND_VOICE_BELOW_THRESHOLD);
                    }
                });
    }

    private static ScheduleMode modeOf(ScheduleMode mode) {
        return mode == null ? ScheduleMode.SCHEDULE : mode;
    }

    private static UUID itemIdOf(PostSchedule schedule) {
        return schedule.getContentVersion().getContentItem().getId();
    }

    private static void requireNotPendingDelete(User user) {
        if (user.getStatus() == UserStatus.PENDING_DELETE) {
            throw new AppException(ErrorCode.SCHEDULING_BLOCKED_PENDING_DELETE);
        }
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

    private record LockedSchedule(UUID itemId, PostSchedule schedule) {
    }

    // Khóa bài TRƯỚC khi nạp lịch: trạng thái lịch đọc sau khóa không bị worker/dispatcher đổi giữa chừng.
    private LockedSchedule lockedOwnedSchedule(User user, UUID scheduleId) {
        UUID itemId = postScheduleRepository.findOwnedContentItemId(scheduleId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.SCHEDULE_NOT_FOUND));
        statusResolver.lock(itemId);
        PostSchedule schedule = postScheduleRepository.findByIdAndPlatformAccount_User_IdAndDeletedAtIsNull(scheduleId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.SCHEDULE_NOT_FOUND));
        return new LockedSchedule(itemId, schedule);
    }

    private PostSchedule ownedSchedule(String email, UUID scheduleId) {
        User user = currentUser(email);
        return postScheduleRepository.findByIdAndPlatformAccount_User_IdAndDeletedAtIsNull(scheduleId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.SCHEDULE_NOT_FOUND));
    }

    private static void requireFuture(Instant time) {
        if (time == null) throw new AppException(ErrorCode.SCHEDULE_TIME_REQUIRED);
        if (!time.isAfter(Instant.now())) throw new AppException(ErrorCode.SCHEDULE_TIME_IN_PAST);
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
