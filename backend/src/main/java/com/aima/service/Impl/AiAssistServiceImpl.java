package com.aima.service.Impl;

import com.aima.dto.publish.PublishFailureFacts;
import com.aima.dto.request.AiFixApplyRequest;
import com.aima.dto.request.AiFixStartRequest;
import com.aima.dto.request.ContentVersionUpdateRequest;
import com.aima.dto.request.PolicyCheckRequest;
import com.aima.dto.response.AiAssistJobResponse;
import com.aima.dto.response.AiAssistUsageResponse;
import com.aima.dto.response.AiFixApplyResponse;
import com.aima.dto.response.AiFixSuggestionResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.FailedPostRetryResponse;
import com.aima.dto.response.PolicyAiAssessmentResponse;
import com.aima.dto.response.PolicyCheckResponse;
import com.aima.entity.AiAssistJob;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.Post;
import com.aima.entity.User;
import com.aima.entity.UserPublishingSettings;
import com.aima.enums.AiAssistKind;
import com.aima.enums.AiFixApplyAction;
import com.aima.enums.FailureState;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.enums.PolicyCheckAiStatus;
import com.aima.enums.PublishErrorCode;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.AiAssistMapper;
import com.aima.repository.AiAssistJobRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.UserPublishingSettingsRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AiAssistService;
import com.aima.service.AiAssistWorkerService;
import com.aima.service.ContentItemService;
import com.aima.service.FailedPostService;
import com.aima.service.PlanLimitService;
import com.aima.service.PolicyRuleEngine;
import com.aima.service.PublishRecoveryService;
import com.aima.service.TokenUsageService;
import com.aima.util.PlatformTextLimits;
import com.aima.util.RequestMeta;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * AI sửa bài vi phạm + kiểm tra chính sách trước khi đăng — tiết kiệm token theo quyết định của chủ dự án:
 * sửa bài chỉ chạy khi người dùng bấm (giới hạn lần/bản), kiểm tra chỉ gọi AI khi bộ luật miễn phí có nghi vấn,
 * có lượt theo gói và cache theo hash nội dung. Hết "Token AI tháng này" → báo rõ, KHÔNG gọi AI.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AiAssistServiceImpl implements AiAssistService {

    /** Job PENDING/RUNNING quá lâu (worker chết / hàng đợi mất) coi như lỗi — không chặn kiểm tra mới mãi mãi. */
    static final Duration STALE_JOB_AFTER = Duration.ofMinutes(10);

    UserRepository userRepository;
    ContentVersionRepository contentVersionRepository;
    PostRepository postRepository;
    UserPublishingSettingsRepository settingsRepository;
    AiAssistJobRepository jobRepository;
    AiAssistMapper mapper;
    AiAssistWorkerService workerService;
    PolicyRuleEngine ruleEngine;
    PublishRecoveryService recoveryService;
    TokenUsageService tokenUsageService;
    PlanLimitService planLimitService;
    ContentItemService contentItemService;
    FailedPostService failedPostService;
    ObjectMapper objectMapper;
    TransactionTemplate transactionTemplate;

    @NonFinal
    @Value("${aima.ai-assist.policy-check.cache-days:30}")
    int cacheDays;

    // ===== A1 — AI sửa bài =====

    @Override
    @Transactional
    public ApiResponse<AiAssistJobResponse> startFix(String email, AiFixStartRequest request) {
        User user = currentUser(email);
        ContentVersion version = ownedVersion(user, request.getContentVersionId());
        if (ContentItemServiceImpl.isPostingLocked(version)) {
            throw new AppException(ErrorCode.CONTENT_VERSION_POSTING_LOCKED);
        }
        String message = message(version);

        Post post = null;
        PublishErrorCode errorCode = null;
        if (request.getPostId() != null) {
            post = postRepository.findByIdAndSchedule_PlatformAccount_User_IdAndDeletedAtIsNull(request.getPostId(), user.getId())
                    .orElseThrow(() -> new AppException(ErrorCode.POST_NOT_FOUND));
            if (post.getSchedule() == null || post.getSchedule().getContentVersion() == null
                    || !post.getSchedule().getContentVersion().getId().equals(version.getId())) {
                throw new AppException(ErrorCode.CONTENT_VERSION_NOT_FOUND);
            }
            PublishFailureFacts facts = recoveryService.describe(post);
            if (facts == null || facts.code() == null || !facts.code().isAiFixable()
                    || (facts.state() != FailureState.NEEDS_ACTION && facts.state() != FailureState.DISMISSED)) {
                throw new AppException(ErrorCode.AI_FIX_NOT_ELIGIBLE);
            }
            errorCode = facts.code();
        } else if (ruleEngine.check(message).isEmpty()) {
            // Sửa từ cảnh báo trước khi đăng: chỉ khi bộ luật thấy nghi vấn — không để nút AI thành "viết lại hộ".
            throw new AppException(ErrorCode.AI_FIX_NOTHING_TO_FIX);
        }

        Long fixLimit = planLimitService.resolve(user).aiFixPerVersion(); // null = không giới hạn
        if (fixLimit != null && fixLimit <= 0) {
            throw new AppException(ErrorCode.AI_FIX_NOT_IN_PLAN);
        }
        long used = jobRepository.countByContentVersion_IdAndKindAndStatusNotAndDeletedAtIsNull(
                version.getId(), AiAssistKind.POLICY_FIX, GenerationJobStatus.FAILED);
        if (fixLimit != null && used >= fixLimit) {
            throw new AppException(ErrorCode.AI_FIX_LIMIT_REACHED);
        }
        tokenUsageService.checkQuota(user);           // hết "Token AI tháng này" → TOKEN_QUOTA_EXCEEDED, không gọi AI
        tokenUsageService.checkConcurrentAiJobs(user);

        AiAssistJob job = jobRepository.save(mapper.toJob(user, version, post, AiAssistKind.POLICY_FIX, errorCode,
                contentHash(version.getPlatformName(), message), message, RequestMeta.clientIp(), RequestMeta.userAgent()));
        dispatchAfterCommit(job.getId());
        log.info("[AiAssist] User {} yêu cầu AI sửa bản {} (bài lỗi {}, mã {}) — job {}",
                user.getId(), version.getId(), request.getPostId(), errorCode, job.getId());
        return ApiResponse.success("Đã bắt đầu AI sửa nội dung", mapper.toJobResponse(job, null, null, false));
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<AiAssistJobResponse> getJob(String email, UUID jobId) {
        User user = currentUser(email);
        AiAssistJob job = jobRepository.findByIdAndUser_IdAndDeletedAtIsNull(jobId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.AI_ASSIST_JOB_NOT_FOUND));
        return ApiResponse.success("Lấy trạng thái tác vụ AI thành công", toResponse(job));
    }

    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ApiResponse<AiFixApplyResponse> applyFix(String email, UUID jobId, AiFixApplyRequest request) {
        record Target(UUID itemId, UUID versionId, UUID postId) {
        }
        User user = currentUser(email);
        Target target = transactionTemplate.execute(tx -> {
            AiAssistJob job = jobRepository.findByIdAndUser_IdAndDeletedAtIsNull(jobId, user.getId())
                    .orElseThrow(() -> new AppException(ErrorCode.AI_ASSIST_JOB_NOT_FOUND));
            if (job.getKind() != AiAssistKind.POLICY_FIX || job.getStatus() != GenerationJobStatus.SUCCESS) {
                throw new AppException(ErrorCode.AI_FIX_NOT_READY);
            }
            if (request.getAction() == AiFixApplyAction.RETRY_NOW && job.getPost() == null) {
                throw new AppException(ErrorCode.AI_FIX_NO_FAILED_POST);
            }
            ContentVersion version = job.getContentVersion();
            return new Target(version.getContentItem().getId(), version.getId(),
                    job.getPost() == null ? null : job.getPost().getId());
        });

        // Cùng luồng sửa tay (giới hạn ký tự/hashtag, revision, bỏ duyệt cũ, giữ lịch chờ duyệt lại).
        contentItemService.updateVersion(email, target.itemId(), target.versionId(), ContentVersionUpdateRequest.builder()
                .caption(request.getCaption().strip())
                .hashtags(request.getHashtags() == null ? List.of() : request.getHashtags().stream()
                        .map(t -> t == null ? "" : t.strip().replaceFirst("^#+", ""))
                        .filter(t -> !t.isEmpty()).distinct().toList())
                .build());
        transactionTemplate.executeWithoutResult(tx -> jobRepository.findById(jobId).ifPresent(job -> {
            job.setAppliedAt(Instant.now());
            jobRepository.save(job);
        }));

        FailedPostRetryResponse retry = null;
        if (request.getAction() == AiFixApplyAction.RETRY_NOW) {
            retry = failedPostService.retry(email, target.postId()).getResult();
        }
        log.info("[AiAssist] User {} áp dụng gợi ý {} ({})", user.getId(), jobId, request.getAction());
        FailedPostRetryResponse retried = retry;
        AiFixApplyResponse response = transactionTemplate.execute(tx ->
                mapper.toApplyResponse(contentVersionRepository.findById(target.versionId()).orElseThrow(), retried));
        return ApiResponse.success(request.getAction() == AiFixApplyAction.RETRY_NOW
                ? "Đã áp dụng gợi ý và thử đăng lại" : "Đã áp dụng gợi ý của AI", response);
    }

    // ===== A2 — kiểm tra chính sách trước khi đăng =====

    @Override
    @Transactional // không readOnly: PlanLimitService → getOrCreate có thể tạo subscription / lăn kỳ
    public ApiResponse<AiAssistUsageResponse> getUsage(String email) {
        User user = currentUser(email);
        AiAssistUsageResponse usage = mapper.toUsageResponse(planLimitService.resolve(user), usedPolicyChecks(user),
                monthStart().plusMonths(1));
        return ApiResponse.success("Lấy lượt AI hỗ trợ chính sách thành công", usage);
    }

    @Override
    @Transactional
    public ApiResponse<PolicyCheckResponse> checkPolicy(String email, PolicyCheckRequest request) {
        User user = currentUser(email);
        ContentVersion version = ownedVersion(user, request.getContentVersionId());
        String message = message(version);
        String hash = contentHash(version.getPlatformName(), message);
        Long limit = planLimitService.resolve(user).policyCheckAiMonthly(); // null = không giới hạn
        long used = usedPolicyChecks(user);

        boolean enabled = settingsRepository.findById(user.getId()).map(UserPublishingSettings::isPolicyCheckEnabled)
                .orElse(true);
        if (!enabled) {
            return checked(mapper.toPolicyCheck(version.getId(), hash, false, List.of(),
                    PolicyCheckAiStatus.DISABLED, null, null, used, limit));
        }
        List<PolicyRuleEngine.Hit> hits = ruleEngine.check(message);
        if (hits.isEmpty()) {
            return checked(mapper.toPolicyCheck(version.getId(), hash, true, hits,
                    PolicyCheckAiStatus.NOT_NEEDED, null, null, used, limit));
        }

        // Cache theo hash: cùng nội dung + nền tảng đã kiểm tra (hoặc đang kiểm tra) → không gọi AI lần nữa.
        AiAssistJob cached = jobRepository
                .findFirstByUser_IdAndKindAndContentHashAndCreatedAtGreaterThanEqualAndDeletedAtIsNullOrderByCreatedAtDesc(
                        user.getId(), AiAssistKind.POLICY_CHECK, hash, LocalDateTime.now().minusDays(cacheDays))
                .orElse(null);
        if (cached != null) {
            boolean old = cached.getCreatedAt() != null
                    && cached.getCreatedAt().isBefore(LocalDateTime.now().minus(STALE_JOB_AFTER));
            switch (cached.getStatus()) {
                case SUCCESS -> {
                    return checked(mapper.toPolicyCheck(version.getId(), hash, true, hits, PolicyCheckAiStatus.DONE,
                            cached.getId(), readCheck(cached), used, limit));
                }
                case PENDING, RUNNING -> {
                    if (!old) {
                        return checked(mapper.toPolicyCheck(version.getId(), hash, true, hits,
                                cached.getStatus() == GenerationJobStatus.RUNNING
                                        ? PolicyCheckAiStatus.RUNNING : PolicyCheckAiStatus.PENDING,
                                cached.getId(), null, used, limit));
                    }
                    cached.setStatus(GenerationJobStatus.FAILED); // kẹt quá lâu → chốt lỗi, cho kiểm tra lại
                    cached.setErrorMessage("Hết thời gian chờ kết quả kiểm tra");
                    jobRepository.save(cached);
                }
                case FAILED -> {
                    if (!old) {
                        // Vừa lỗi: không tự gọi lại ngay (FE đang poll sẽ tạo vòng lặp tốn token).
                        return checked(mapper.toPolicyCheck(version.getId(), hash, true, hits,
                                PolicyCheckAiStatus.FAILED, cached.getId(), null, used, limit));
                    }
                }
            }
        }

        if (limit != null && limit <= 0) {
            return checked(mapper.toPolicyCheck(version.getId(), hash, true, hits,
                    PolicyCheckAiStatus.PLAN_NOT_INCLUDED, null, null, used, limit));
        }
        if (limit != null && used >= limit) {
            return checked(mapper.toPolicyCheck(version.getId(), hash, true, hits,
                    PolicyCheckAiStatus.LIMIT_REACHED, null, null, used, limit));
        }
        if (tokenUsageService.state(user).exceeded()) {
            return checked(mapper.toPolicyCheck(version.getId(), hash, true, hits,
                    PolicyCheckAiStatus.QUOTA_EXCEEDED, null, null, used, limit));
        }

        AiAssistJob job = jobRepository.save(mapper.toJob(user, version, null, AiAssistKind.POLICY_CHECK, null, hash,
                message, RequestMeta.clientIp(), RequestMeta.userAgent()));
        dispatchAfterCommit(job.getId());
        log.info("[AiAssist] Bộ luật thấy {} nghi vấn ở bản {} — gọi AI kiểm tra (job {}, lượt {}/{})",
                hits.size(), version.getId(), job.getId(), used + 1, limit);
        return checked(mapper.toPolicyCheck(version.getId(), hash, true, hits, PolicyCheckAiStatus.PENDING,
                job.getId(), null, used + 1, limit));
    }

    // ===== Helpers =====

    private AiAssistJobResponse toResponse(AiAssistJob job) {
        ContentVersion version = job.getContentVersion();
        boolean stale = version != null && !contentHash(version.getPlatformName(), message(version)).equals(job.getContentHash());
        AiFixSuggestionResponse fix = null;
        PolicyAiAssessmentResponse check = null;
        if (job.getStatus() == GenerationJobStatus.SUCCESS && job.getResult() != null) {
            if (job.getKind() == AiAssistKind.POLICY_FIX) {
                fix = read(job, AiFixSuggestionResponse.class);
            } else {
                check = readCheck(job);
            }
        }
        return mapper.toJobResponse(job, fix, check, stale);
    }

    private PolicyAiAssessmentResponse readCheck(AiAssistJob job) {
        return read(job, PolicyAiAssessmentResponse.class);
    }

    private <T> T read(AiAssistJob job, Class<T> type) {
        try {
            return objectMapper.readValue(job.getResult(), type);
        } catch (Exception e) {
            log.warn("[AiAssist] Không đọc được kết quả job {}: {}", job.getId(), e.getMessage());
            return null;
        }
    }

    /** Lượt AI kiểm tra đã dùng trong tháng lịch (job lỗi không tính). */
    private long usedPolicyChecks(User user) {
        return jobRepository.countByUser_IdAndKindAndStatusNotAndCreatedAtGreaterThanEqualAndDeletedAtIsNull(
                user.getId(), AiAssistKind.POLICY_CHECK, GenerationJobStatus.FAILED, monthStart());
    }

    private static LocalDateTime monthStart() {
        return LocalDate.now().withDayOfMonth(1).atStartOfDay();
    }

    private static ApiResponse<PolicyCheckResponse> checked(PolicyCheckResponse response) {
        return ApiResponse.success("Đã kiểm tra chính sách", response);
    }

    /** Nội dung đăng thật của bản nền tảng (caption + hashtag) — cùng cách worker đăng bài ghép. */
    static String message(ContentVersion version) {
        return PlatformTextLimits.compose(version.getFormattedCaption(), version.getFormattedHashtag());
    }

    static List<String> hashtags(ContentVersion version) {
        String csv = version.getFormattedHashtag();
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        return Arrays.stream(csv.split(",")).map(String::strip).filter(s -> !s.isEmpty())
                .map(s -> s.replaceFirst("^#+", "")).toList();
    }

    /** sha256(nền tảng + nội dung) — khoá cache kiểm tra và dấu hiệu gợi ý đã cũ. */
    static String contentHash(Platform platform, String message) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((platform + "\n" + (message == null ? "" : message.strip()))
                    .getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private ContentVersion ownedVersion(User user, UUID versionId) {
        ContentVersion version = contentVersionRepository
                .findByIdAndContentItem_BrandProfile_User_IdAndDeletedAtIsNull(versionId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_VERSION_NOT_FOUND));
        ContentItem item = version.getContentItem();
        if (item == null || item.getDeletedAt() != null || item.getBrandProfile().getDeletedAt() != null) {
            throw new AppException(ErrorCode.CONTENT_VERSION_NOT_FOUND);
        }
        return version;
    }

    /** Dispatch worker SAU commit (rule #28a); hàng đợi đầy → chốt FAILED trong transaction riêng. */
    private void dispatchAfterCommit(UUID jobId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dispatch(jobId);
                }
            });
        } else {
            dispatch(jobId);
        }
    }

    private void dispatch(UUID jobId) {
        try {
            workerService.process(jobId);
        } catch (TaskRejectedException e) {
            log.error("[AiAssist] Hàng đợi worker đầy — chốt FAILED job {}", jobId, e);
            TransactionTemplate requiresNew = new TransactionTemplate(Objects.requireNonNull(transactionTemplate.getTransactionManager()));
            requiresNew.setPropagationBehavior(TransactionTemplate.PROPAGATION_REQUIRES_NEW);
            requiresNew.executeWithoutResult(status -> jobRepository.findById(jobId).ifPresent(job -> {
                job.setStatus(GenerationJobStatus.FAILED);
                job.setErrorMessage(ErrorCode.AI_JOB_QUEUE_FULL.getMessage());
                jobRepository.save(job);
            }));
        }
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
