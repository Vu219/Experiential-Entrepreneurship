package com.aima.service.Impl;

import com.aima.dto.request.AdminActionReasonRequest;
import com.aima.dto.request.PublishErrorMappingRequest;
import com.aima.dto.response.AdminFailedPostAttemptResponse;
import com.aima.dto.response.AdminFailedPostDetailResponse;
import com.aima.dto.response.AdminFailedPostResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.FailedPostRetryResponse;
import com.aima.dto.response.PublishErrorMappingResponse;
import com.aima.dto.response.UnclassifiedErrorGroupResponse;
import com.aima.entity.Post;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishErrorMapping;
import com.aima.entity.PublishResult;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.Platform;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.PublishErrorCode;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.AdminMonitorMapper;
import com.aima.mapper.FailedPostMapper;
import com.aima.repository.PostRepository;
import com.aima.repository.PostingJobRepository;
import com.aima.repository.PublishErrorMappingRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.PublishErrorAdminService;
import com.aima.service.PublishErrorNormalizer;
import com.aima.service.PublishRecoveryService;
import com.aima.util.PublishReference;
import com.aima.util.PublishingTime;
import com.aima.util.SensitiveDataRedactor;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Lỗi thô chỉ ra tới admin và LUÔN qua {@link SensitiveDataRedactor} (dữ liệu cũ trước V13 chưa redact lúc ghi).
 * Thử lại thay người dùng đi CÙNG đường {@link PublishRecoveryService} với người dùng (không bypass chốt chặn) và
 * KHÔNG chạy trong transaction của lớp (worker được giao sau commit).
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class PublishErrorAdminServiceImpl implements PublishErrorAdminService {

    /** Trần số lần lỗi quét cho hàng đợi "chưa phân loại" (mới nhất trước). */
    static final int MAX_UNCLASSIFIED_SCAN = 2000;
    static final int MAX_RANGE_DAYS = 366;
    static final int MESSAGE_STEM_LENGTH = 160;

    PostRepository postRepository;
    PostingJobRepository jobRepository;
    PublishErrorMappingRepository mappingRepository;
    UserRepository userRepository;
    PublishRecoveryService recoveryService;
    PublishErrorNormalizer errorNormalizer;
    ActivityLogService activityLogService;
    AdminMonitorMapper adminMonitorMapper;
    FailedPostMapper failedPostMapper;
    TransactionTemplate transactionTemplate;

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<AdminFailedPostDetailResponse> get(UUID postId) {
        Post post = livePost(postId);
        PostingJob lastFailed = recoveryService.lastFailedJob(post);
        PublishResult lastError = recoveryService.lastErrorResult(post);
        PublishErrorCode code = errorNormalizer.resolve(post.getPlatformName(), lastFailed, lastError);
        AdminFailedPostResponse row = adminMonitorMapper.toFailedPost(post, lastFailed, lastError, code);
        String rawError = lastFailed != null && lastFailed.getErrorDetail() != null
                ? SensitiveDataRedactor.redact(lastFailed.getErrorDetail())
                : SensitiveDataRedactor.redact(lastError == null ? null : lastError.getResponseMessage());

        List<AdminFailedPostAttemptResponse> attempts = post.getPostingJobs().stream()
                .sorted(Comparator.comparing(PostingJob::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder()))
                        .thenComparing(PostingJob::getRetryCount))
                .map(job -> {
                    if (job.getStatus() != PostingJobStatus.FAILED) {
                        return adminMonitorMapper.toAdminAttempt(job, null, null);
                    }
                    PublishResult result = job == lastFailed ? lastError : null;
                    return adminMonitorMapper.toAdminAttempt(job,
                            errorNormalizer.resolve(post.getPlatformName(), job, result),
                            errorNormalizer.platformCodeOf(job, result));
                })
                .toList();
        AdminFailedPostDetailResponse response = adminMonitorMapper.toAdminDetail(row, post.getSchedule().getId(),
                post.getSchedule().getContentVersion().getContentItem().getId(),
                recoveryService.describe(post).state(), rawError, attempts);
        return ApiResponse.success("Lấy chi tiết bài lỗi thành công", response);
    }

    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ApiResponse<FailedPostRetryResponse> retry(String adminEmail, UUID postId, AdminActionReasonRequest request) {
        User admin = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        String ownerEmail = transactionTemplate.execute(tx ->
                livePost(postId).getSchedule().getPlatformAccount().getUser().getEmail());

        PublishRecoveryService.RetryOutcome outcome = recoveryService.retry(postId, admin.getId());
        activityLogService.record(ActivityLogService.Entry.byActor(ActivityAction.POST_RETRIED, adminEmail, "Post",
                postId.toString(), Map.of("reason", request.getReason().trim(),
                        "onBehalfOf", String.valueOf(ownerEmail),
                        "jobId", String.valueOf(outcome.jobId()))));
        log.info("[PublishErrorAdmin] Admin {} thử lại bài {} thay {} → job {}", adminEmail, postId, ownerEmail, outcome.jobId());
        FailedPostRetryResponse response = failedPostMapper.toRetryResponse(
                outcome.postId(), outcome.scheduleId(), outcome.jobId(), outcome.heldReason());
        return ApiResponse.success("Đã thử lại bài thay người dùng", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<UnclassifiedErrorGroupResponse>> unclassified(LocalDate from, LocalDate to) {
        validateRange(from, to);
        Instant start = from.atStartOfDay(PublishingTime.LEGACY_ZONE).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(PublishingTime.LEGACY_ZONE).toInstant();

        Map<String, Group> groups = new LinkedHashMap<>();
        for (PostingJob job : jobRepository.findUnclassifiedCandidates(start, end, PageRequest.of(0, MAX_UNCLASSIFIED_SCAN))) {
            Post post = job.getPost();
            Platform platform = post.getPlatformName();
            PublishResult result = job.getErrorCode() == null ? pairedResult(post, job) : null;
            if (errorNormalizer.resolve(platform, job, result) != PublishErrorCode.UNKNOWN) {
                continue; // dòng cũ đã phân loại được (luật mới / ánh xạ admin) — không còn "chưa phân loại"
            }
            String platformCode = errorNormalizer.platformCodeOf(job, result);
            String message = SensitiveDataRedactor.redact(result != null ? result.getResponseMessage() : job.getErrorMessage());
            String key = platform + "|" + platformCode + "|" + job.getPlatformErrorSubcode() + "|" + stem(message);
            // Mới nhất trước → dòng đầu tiên của nhóm là mẫu mới nhất.
            Group group = groups.computeIfAbsent(key, k -> new Group(platform, platformCode, job.getPlatformErrorSubcode(),
                    message, job.getEndTime(), PublishReference.of(job.getId()),
                    SensitiveDataRedactor.redact(job.getErrorDetail())));
            group.count++;
            group.firstSeen = job.getEndTime();
            group.users.add(post.getSchedule().getPlatformAccount().getUser().getId());
        }
        List<UnclassifiedErrorGroupResponse> response = groups.values().stream()
                .sorted(Comparator.comparingLong((Group g) -> g.count).reversed())
                .map(g -> adminMonitorMapper.toUnclassifiedGroup(g.platform, g.platformCode, g.platformSubcode,
                        g.messageSample, g.count, g.users.size(), g.firstSeen, g.lastSeen, g.sampleReference,
                        g.sampleDetail))
                .toList();
        return ApiResponse.success("Lấy lỗi chưa phân loại thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<PublishErrorMappingResponse>> listMappings() {
        List<PublishErrorMappingResponse> response = mappingRepository.findByDeletedAtIsNullOrderByCreatedAtDesc().stream()
                .map(m -> adminMonitorMapper.toMappingResponse(m, 0))
                .toList();
        return ApiResponse.success("Lấy danh sách ánh xạ lỗi thành công", response);
    }

    @Override
    @Transactional
    public ApiResponse<PublishErrorMappingResponse> createMapping(String adminEmail, PublishErrorMappingRequest request) {
        request.setPlatformCode(request.getPlatformCode().trim());
        request.setPlatformSubcode(blankToNull(request.getPlatformSubcode()));
        request.setMessagePattern(blankToNull(request.getMessagePattern()));
        request.setNote(blankToNull(request.getNote()));
        boolean duplicate = mappingRepository.findByDeletedAtIsNullOrderByCreatedAtDesc().stream()
                .anyMatch(m -> m.getPlatform() == request.getPlatform()
                        && m.getPlatformCode().equals(request.getPlatformCode())
                        && Objects.equals(m.getPlatformSubcode(), request.getPlatformSubcode())
                        && Objects.equals(lower(m.getMessagePattern()), lower(request.getMessagePattern())));
        if (duplicate) {
            throw new AppException(ErrorCode.PUBLISH_ERROR_MAPPING_INVALID);
        }

        PublishErrorMapping mapping = adminMonitorMapper.toPublishErrorMapping(request);
        mapping.setUpdatedByEmail(adminEmail);
        PublishErrorMapping saved = mappingRepository.save(mapping);
        int applied = request.isApplyToExisting() ? reclassifyStoredFailures(saved) : 0;
        evictMappingsAfterCommit();

        activityLogService.record(ActivityLogService.Entry.byActor(ActivityAction.PUBLISH_ERROR_MAPPING_UPDATED, adminEmail,
                "PublishErrorMapping", saved.getId().toString(), Map.of("action", "CREATED",
                        "signature", signature(saved), "errorCode", saved.getErrorCode().name(), "applied", applied)));
        PublishErrorMappingResponse response = adminMonitorMapper.toMappingResponse(saved, applied);
        return ApiResponse.success("Đã thêm ánh xạ lỗi", response);
    }

    @Override
    @Transactional
    public ApiResponse<PublishErrorMappingResponse> deleteMapping(String adminEmail, UUID mappingId) {
        PublishErrorMapping mapping = mappingRepository.findByIdAndDeletedAtIsNull(mappingId)
                .orElseThrow(() -> new AppException(ErrorCode.PUBLISH_ERROR_MAPPING_NOT_FOUND));
        mapping.setDeletedAt(LocalDateTime.now());
        evictMappingsAfterCommit();
        activityLogService.record(ActivityLogService.Entry.byActor(ActivityAction.PUBLISH_ERROR_MAPPING_UPDATED, adminEmail,
                "PublishErrorMapping", mappingId.toString(), Map.of("action", "DELETED", "signature", signature(mapping),
                        "errorCode", mapping.getErrorCode().name())));
        PublishErrorMappingResponse response = adminMonitorMapper.toMappingResponse(mapping, 0);
        return ApiResponse.success("Đã xoá ánh xạ lỗi", response);
    }

    /**
     * Áp ánh xạ mới cho các lần lỗi UNKNOWN ĐÃ LƯU cùng chữ ký: đổi mã chuẩn + phân loại thô (bài lỗi chuyển đúng tab
     * POLICY/TECHNICAL). Không đụng retry — các lần này đã thất bại chung cuộc.
     */
    private int reclassifyStoredFailures(PublishErrorMapping mapping) {
        String pattern = lower(mapping.getMessagePattern());
        int applied = 0;
        for (PostingJob job : jobRepository.findUnknownByPlatformCode(mapping.getPlatform(), mapping.getPlatformCode())) {
            if (mapping.getPlatformSubcode() != null && !mapping.getPlatformSubcode().equals(job.getPlatformErrorSubcode())) {
                continue;
            }
            if (pattern != null && (job.getErrorMessage() == null || !lower(job.getErrorMessage()).contains(pattern))) {
                continue;
            }
            job.setErrorCode(mapping.getErrorCode());
            job.setErrorType(mapping.getErrorCode().legacyType());
            applied++;
        }
        return applied;
    }

    // Cache ánh xạ của normalizer chỉ được bỏ SAU commit — bỏ trước thì luồng khác có thể nạp lại bản cũ giữ 5 phút.
    private void evictMappingsAfterCommit() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    errorNormalizer.evictMappings();
                }
            });
        } else {
            errorNormalizer.evictMappings();
        }
    }

    /** publish_result lỗi ghi CÙNG lần thử với job cũ (trước V13 không có liên kết) — gần thời điểm kết thúc nhất. */
    private static PublishResult pairedResult(Post post, PostingJob job) {
        if (job.getEndTime() == null) {
            return null;
        }
        LocalDateTime finishedAt = PublishingTime.toLegacy(job.getEndTime());
        return post.getPublishResults().stream()
                .filter(r -> Boolean.FALSE.equals(r.getIsSuccess()) && r.getCreatedAt() != null)
                .min(Comparator.comparing(r -> Duration.between(r.getCreatedAt(), finishedAt).abs()))
                .orElse(null);
    }

    /** Dạng chuẩn hoá của message để gom nhóm: bỏ chữ số/khoảng trắng thừa (id, thời gian khác nhau giữa các lần). */
    static String stem(String message) {
        if (message == null) {
            return "";
        }
        String stem = message.toLowerCase(Locale.ROOT).replaceAll("\\d+", "#").replaceAll("\\s+", " ").strip();
        return stem.length() > MESSAGE_STEM_LENGTH ? stem.substring(0, MESSAGE_STEM_LENGTH) : stem;
    }

    private Post livePost(UUID postId) {
        return postRepository.findById(postId)
                .filter(p -> p.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(ErrorCode.POST_NOT_FOUND));
    }

    private static void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new AppException(ErrorCode.FAILED_POST_RANGE_INVALID);
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_RANGE_DAYS) {
            throw new AppException(ErrorCode.FAILED_POST_RANGE_TOO_LARGE);
        }
    }

    private static String signature(PublishErrorMapping m) {
        return m.getPlatform() + "/" + m.getPlatformCode()
                + (m.getPlatformSubcode() == null ? "" : "/" + m.getPlatformSubcode())
                + (m.getMessagePattern() == null ? "" : " ~ \"" + m.getMessagePattern() + "\"");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String lower(String value) {
        return value == null ? null : value.toLowerCase(Locale.ROOT);
    }

    /** Bộ đếm một nhóm chữ ký lỗi trong lúc quét. */
    private static final class Group {
        final Platform platform;
        final String platformCode;
        final String platformSubcode;
        final String messageSample;
        final Instant lastSeen;
        final String sampleReference;
        final String sampleDetail;
        final Set<UUID> users = new HashSet<>();
        Instant firstSeen;
        long count;

        Group(Platform platform, String platformCode, String platformSubcode, String messageSample, Instant lastSeen,
              String sampleReference, String sampleDetail) {
            this.platform = platform;
            this.platformCode = platformCode;
            this.platformSubcode = platformSubcode;
            this.messageSample = messageSample;
            this.lastSeen = lastSeen;
            this.firstSeen = lastSeen;
            this.sampleReference = sampleReference;
            this.sampleDetail = sampleDetail;
        }
    }
}
