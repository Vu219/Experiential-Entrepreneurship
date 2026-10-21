package com.aima.service.Impl;

import com.aima.service.JobEventService;
import com.aima.util.NotificationParams;
import com.aima.enums.NotificationRefType;
import com.aima.dto.notification.NotificationDraft;
import com.aima.dto.publish.NormalizedPublishError;
import com.aima.dto.publish.PublishFailureNotice;
import com.aima.dto.publish.PublishTarget;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishResult;
import com.aima.enums.ActivityAction;
import com.aima.enums.ActivityResult;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.HoldReason;
import com.aima.enums.MetricsErrorType;
import com.aima.enums.NotificationType;
import com.aima.enums.Platform;
import com.aima.enums.PostSnapshotState;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.PublishErrorCode;
import com.aima.enums.PublishErrorType;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.exception.MetricsFetchException;
import com.aima.exception.PublishException;
import com.aima.mapper.PostPublishMapper;
import com.aima.repository.PostingJobRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.ContentItemStatusResolver;
import com.aima.service.MetaApiClient;
import com.aima.service.NotificationService;
import com.aima.service.PlatformIncidentService;
import com.aima.service.PlatformPublisher;
import com.aima.service.PostPublishWorkerService;
import com.aima.service.PublishErrorNormalizer;
import com.aima.service.PublishFailureNotifier;
import com.aima.service.ScheduleHoldService;
import com.aima.service.PlatformAvailabilityService;
import com.aima.service.ScheduleHeldNotifier;
import com.aima.enums.PlatformLockReason;
import com.aima.service.SystemLogService;
import com.aima.util.PlatformTextLimits;
import com.aima.util.PublishErrorRules;
import com.aima.util.PublishReference;
import com.aima.util.SensitiveDataRedactor;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Worker đăng bài (FR-53/FR-54/FR-55/FR-56): claim job nguyên tử → gọi nền tảng NGOÀI transaction
 * (rule #24/#28) → lưu kết quả + cập nhật state machine (WORKFLOWS.md). Lỗi tạm thời retry
 * 3 lần (5/15/30 phút); lỗi vi phạm chính sách/vĩnh viễn dừng ngay, giữ mã lỗi gốc (BR-07/BR-08).
 */
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class PostPublishWorkerServiceImpl implements PostPublishWorkerService {

    // FR-56: tối đa 3 lần retry, giãn cách 5/15/30 phút.
    static final int MAX_RETRIES = 3;
    static final List<Duration> RETRY_DELAYS =
            List.of(Duration.ofMinutes(5), Duration.ofMinutes(15), Duration.ofMinutes(30));

    // Lý do dừng job khi tài khoản đích đã ngắt kết nối / không còn ACTIVE lúc worker nhận job.
    // Lý do dừng job khi nền tảng bị khoá toàn hệ thống / không còn thuộc gói lúc worker nhận job.
    static final String PLATFORM_BLOCKED_STOP_REASON =
            "Nền tảng đang tạm khoá hoặc không còn thuộc gói — lịch được tạm giữ, không đăng";

    static final String ACCOUNT_UNAVAILABLE_STOP_REASON =
            "Tài khoản đăng bài đã bị ngắt kết nối hoặc không còn hiệu lực — lịch được tạm giữ";

    /** Trần độ dài message kỹ thuật (đã redact) lưu vào job / publish_result — chỉ admin đọc. */
    static final int ADMIN_MESSAGE_MAX_LENGTH = 2000;

    // Retry: jitter cộng thêm vào lịch FR-56 + trần thời gian chờ theo yêu cầu của nền tảng.
    static final long RETRY_JITTER_MAX_SECONDS = 30;
    static final Duration MAX_PLATFORM_WAIT = Duration.ofHours(6);

    // Lỗi mà nền tảng có thể đã nhận bài (request đã gửi, không biết kết quả) → kiểm tra trước khi đăng lại.
    static final Set<PublishErrorCode> AMBIGUOUS_CODES = EnumSet.of(PublishErrorCode.NETWORK_TIMEOUT,
            PublishErrorCode.PUBLISH_INTERRUPTED, PublishErrorCode.PLATFORM_TEMPORARY, PublishErrorCode.PLATFORM_OUTAGE);
    // 7 ngày: "Thử lại ngay" sau một ngày của một lần lỗi mơ hồ vẫn được kiểm tra trước khi đăng.
    static final Duration VERIFY_LOOKBACK = Duration.ofDays(7);
    static final Duration VERIFY_CLOCK_SKEW = Duration.ofMinutes(2);

    // FR-70 (khớp FR-18b): token chết (Graph 190 và các subcode) → kết nối EXPIRED, tạm giữ các lịch chờ.
    static final Set<PublishErrorCode> EXPIRES_ACCOUNT = EnumSet.of(PublishErrorCode.AUTH_TOKEN_EXPIRED,
            PublishErrorCode.AUTH_PASSWORD_CHANGED, PublishErrorCode.AUTH_APP_REMOVED,
            PublishErrorCode.AUTH_PAGE_ROLE_MISSING);

    // FR-73: tài khoản bị nền tảng chặn/hạn chế → kết nối ERROR, tạm giữ các lịch chờ (đăng tiếp chỉ làm nặng thêm).
    static final Set<PublishErrorCode> RESTRICTS_ACCOUNT = EnumSet.of(PublishErrorCode.POLICY_TEMPORARY_BLOCK,
            PublishErrorCode.ACCOUNT_RESTRICTED, PublishErrorCode.ACCOUNT_CHECKPOINT);

    /** Việc làm SAU commit kết quả thất bại: tạm giữ lịch của tài khoản + thông báo (null = không có). */
    record FailureEffects(UUID accountToHold, PublishFailureNotice notice) {
        static final FailureEffects NONE = new FailureEffects(null, null);
    }

    PostingJobRepository jobRepository;
    PostPublishMapper postPublishMapper;
    TransactionTemplate transactionTemplate;
    TransactionTemplate readOnlyTransactionTemplate;
    NotificationService notificationService;
    SystemLogService systemLogService;
    ActivityLogService activityLogService;
    ContentItemStatusResolver statusResolver;
    ScheduleHoldService holdService;
    PlatformAvailabilityService platformAvailabilityService;
    ScheduleHeldNotifier heldNotifier;
    PublishErrorNormalizer errorNormalizer;
    PublishFailureNotifier failureNotifier;
    PlatformIncidentService incidentService;
    JobEventService jobEventService;
    Map<Platform, PlatformPublisher> publishers;

    public PostPublishWorkerServiceImpl(PostingJobRepository jobRepository,
                                        PostPublishMapper postPublishMapper,
                                        TransactionTemplate transactionTemplate,
                                        NotificationService notificationService,
                                        SystemLogService systemLogService,
                                        ActivityLogService activityLogService,
                                        ContentItemStatusResolver statusResolver,
                                        ScheduleHoldService holdService,
                                        PlatformAvailabilityService platformAvailabilityService,
                                        ScheduleHeldNotifier heldNotifier,
                                        PublishErrorNormalizer errorNormalizer,
                                        PublishFailureNotifier failureNotifier,
                                        PlatformIncidentService incidentService,
                                        JobEventService jobEventService,
                                        List<PlatformPublisher> publisherList) {
        this.jobRepository = jobRepository;
        this.postPublishMapper = postPublishMapper;
        this.transactionTemplate = transactionTemplate;
        // Cùng transaction manager, chỉ thêm cờ read-only cho bước nạp dữ liệu trước khi gọi nền tảng.
        this.readOnlyTransactionTemplate = new TransactionTemplate(transactionTemplate.getTransactionManager());
        this.readOnlyTransactionTemplate.setReadOnly(true);
        this.notificationService = notificationService;
        this.systemLogService = systemLogService;
        this.activityLogService = activityLogService;
        this.statusResolver = statusResolver;
        this.holdService = holdService;
        this.platformAvailabilityService = platformAvailabilityService;
        this.heldNotifier = heldNotifier;
        this.errorNormalizer = errorNormalizer;
        this.failureNotifier = failureNotifier;
        this.incidentService = incidentService;
        this.jobEventService = jobEventService;
        this.publishers = publisherList.stream()
                .collect(Collectors.toUnmodifiableMap(PlatformPublisher::platform, Function.identity()));
    }

    @Override
    @Async("postPublishExecutor")
    public void process(UUID jobId) {
        boolean claimed = false;
        String platformPostId = null;
        try {
            // Tx ngắn 1 (ghi): claim nguyên tử + chuyển pipeline sang POSTING (poller thấy ngay).
            claimed = Boolean.TRUE.equals(transactionTemplate.execute(tx -> claimAndMarkPosting(jobId)));
            if (!claimed) {
                return;
            }
            // Tx ngắn 2 (read-only): JOIN FETCH rồi chụp mọi giá trị cần dùng ra DTO bất biến —
            // từ đây trở đi không đụng entity nào nữa (session đã đóng).
            PublishTarget target = readOnlyTransactionTemplate.execute(tx -> loadTarget(jobId));
            log.info("[PostPublish] Job {} bắt đầu đăng: post {}, {} kênh {} (platform_account {})",
                    jobId, target.postId(), target.platform(), target.accountType(), target.accountId());

            // Gọi nền tảng NGOÀI transaction (rule #24). Lần thử trước lỗi mơ hồ → kiểm tra bài đã lên chưa trước.
            PlatformPublisher publisher = publisherFor(target.platform());
            Optional<String> alreadyPublished = alreadyPublished(publisher, target);
            MetaApiClient.MetaPostResult result = alreadyPublished.isPresent()
                    ? new MetaApiClient.MetaPostResult(alreadyPublished.get())
                    : publisher.publish(target);
            platformPostId = result.platformPostId();
            log.info("[PostPublish] Job {} nền tảng đã nhận bài: post {} → platform post id {}",
                    jobId, target.postId(), platformPostId);

            // Tx ngắn 3 (ghi): lưu kết quả theo jobId.
            transactionTemplate.executeWithoutResult(tx -> saveSuccess(jobId, result));
        } catch (PublishException e) {
            log.warn("[PostPublish] Job {} thất bại [{} - mã {}]: {}",
                    jobId, e.getErrorType(), e.getResponseCode(), e.getMessage());
            recordFailure(jobId, claimed, e);
        } catch (Exception e) {
            // Lỗi không đến từ nền tảng (lazy proxy, NPE, giải mã token...) = lỗi code: chạy lại cũng
            // chết đúng chỗ đó → INTERNAL, không retry, log ERROR đủ stacktrace (rule #28e).
            log.error("[PostPublish] Job {} lỗi nội bộ (INTERNAL — không retry)", jobId, e);
            recordFailure(jobId, claimed, internalError(e, platformPostId));
        }
    }

    // Không bao giờ để job kẹt RUNNING vì lỗi ghi kết quả: log ERROR; nếu vẫn kẹt thì
    // PostingDispatchJob.recoverStuckRunning vớt sau STUCK_RUNNING_AGE.
    private void recordFailure(UUID jobId, boolean claimed, PublishException e) {
        if (!claimed) {
            // Claim chưa commit (vd DB chập chờn) → job vẫn PENDING/RETRYING, lần quét sau tự dispatch lại.
            log.error("[PostPublish] Job {} lỗi trước khi claim — giữ nguyên trạng thái để dispatch lại", jobId, e);
            return;
        }
        FailureEffects effects;
        try {
            effects = transactionTemplate.execute(tx -> saveFailure(jobId, e));
        } catch (Exception saveError) {
            log.error("[PostPublish] Job {} không ghi được kết quả thất bại — job còn RUNNING tới khi bị vớt",
                    jobId, saveError);
            return;
        }
        applyFailureEffects(effects);
    }

    // Sau commit: tạm giữ lịch của tài khoản (token hết hạn / bị hạn chế) rồi mới báo user (kèm số lịch bị giữ).
    // Cả hai đều chạy NGOÀI transaction ghi kết quả: tạm giữ đụng nhiều bài khác (khóa chúng trong transaction đang
    // giữ khóa bài hiện tại dễ deadlock), thông báo có dedupe unique (hai bài cùng tài khoản lỗi cùng lúc).
    private void applyFailureEffects(FailureEffects effects) {
        if (effects == null) {
            return;
        }
        int held = holdAccountSchedules(effects.accountToHold());
        if (effects.notice() != null) {
            failureNotifier.notifyFailure(effects.notice(), held);
        }
    }

    private int holdAccountSchedules(UUID accountId) {
        if (accountId == null) {
            return 0;
        }
        try {
            int held = holdService.holdForAccounts(List.of(accountId), HoldReason.ACCOUNT_ISSUE);
            log.warn("[PostPublish] Tài khoản {} — chuyển {} lịch chờ sang ON_HOLD", accountId, held);
            return held;
        } catch (Exception holdError) {
            log.error("[PostPublish] Không tạm giữ được lịch chờ của tài khoản {}", accountId, holdError);
            return 0;
        }
    }

    /**
     * Chống đăng trùng: lần thử trước của bài lỗi MƠ HỒ (timeout/gián đoạn/5xx — nền tảng có thể đã nhận bài) → hỏi
     * nền tảng có bài khớp nội dung từ lúc đó chưa (app đã có pages_read_engagement). Không kiểm tra được → KHÔNG
     * đăng mù: {@link #verifyFailure} quyết định lỗi quyền / token / tạm thời.
     */
    private Optional<String> alreadyPublished(PlatformPublisher publisher, PublishTarget target) {
        if (target.verifySince() == null) {
            return Optional.empty();
        }
        try {
            Optional<String> existing = publisher.findPublished(target);
            existing.ifPresent(id -> log.warn("[PostPublish] Job {}: bài đã có trên {} (id {}) từ lần thử trước — "
                    + "ghi nhận thành công, KHÔNG đăng lại", target.jobId(), target.platform(), id));
            return existing;
        } catch (MetricsFetchException e) {
            throw verifyFailure(target, e.getErrorType(), e.getResponseCode(), e);
        } catch (AppException e) {
            throw verifyFailure(target, e.getErrorCode() == ErrorCode.META_TOKEN_INVALID
                    ? MetricsErrorType.TOKEN_INVALID : MetricsErrorType.TEMPORARY, e.getErrorCode().name(), e);
        } catch (RuntimeException e) {
            throw verifyFailure(target, MetricsErrorType.TEMPORARY, PublishErrorRules.CODE_NETWORK, e);
        }
    }

    /**
     * Không kiểm tra được bài đã lên nền tảng → KHÔNG đăng mù (có thể đăng trùng). Thiếu quyền đọc bài của Trang
     * (token cấp trước khi app có pages_read_engagement) → lỗi quyền, không retry, người dùng kết nối lại; token chết
     * → hết hạn kết nối; còn lại (mạng, 5xx, rate limit) → lỗi tạm thời, thử lại theo FR-56 và lần sau lại kiểm tra.
     */
    static PublishException verifyFailure(PublishTarget target, MetricsErrorType type, String code, Exception cause) {
        String detail = SensitiveDataRedactor.redact(cause.getMessage());
        return switch (type) {
            case PERMISSION -> {
                log.error("[PostPublish] Job {}: {} {} từ chối đọc bài đã đăng (mã {}, thiếu quyền — token cấp trước khi app "
                                + "có pages_read_engagement?) — KHÔNG đăng lại mù, bài chuyển Cần xử lý: {}",
                        target.jobId(), target.platform(), target.platformAccountId(), code, detail);
                yield new PublishException(PublishErrorType.PERMANENT, PublishErrorRules.CODE_VERIFY_PERMISSION,
                        "Không kiểm tra được bài đã đăng: thiếu quyền đọc bài của tài khoản (mã " + code + ")", cause);
            }
            case TOKEN_INVALID -> {
                log.warn("[PostPublish] Job {}: token {} không còn hiệu lực khi kiểm tra bài đã đăng (mã {})",
                        target.jobId(), target.platform(), code);
                yield new PublishException(PublishErrorType.PERMANENT, PublishErrorRules.CODE_TOKEN_EXPIRED,
                        "Token hết hạn khi kiểm tra bài đã đăng (mã " + code + ")", cause);
            }
            default -> {
                log.warn("[PostPublish] Job {}: chưa kiểm tra được bài đã đăng trên {} (mã {}) — KHÔNG đăng mù, thử lại sau: {}",
                        target.jobId(), target.platform(), code, detail);
                yield new PublishException(PublishErrorType.TEMPORARY, PublishErrorRules.CODE_VERIFY_UNAVAILABLE,
                        "Chưa kiểm tra được bài đã đăng (mã " + code + ")", cause);
            }
        };
    }

    // Message chỉ dành cho admin/log (job.error_message, error_detail) — user chỉ thấy mã INTERNAL_ERROR.
    private static PublishException internalError(Exception e, String platformPostId) {
        String detail = e.getClass().getSimpleName() + ": " + e.getMessage();
        String message = platformPostId == null
                ? "Lỗi nội bộ khi đăng bài — " + detail
                // Nền tảng ĐÃ nhận bài: ghi rõ để user/admin không lên lịch lại gây đăng trùng.
                : "Nền tảng đã nhận bài (id " + platformPostId + ") nhưng lưu kết quả thất bại — " + detail;
        return new PublishException(PublishErrorType.INTERNAL, PublishErrorRules.CODE_INTERNAL, message, e);
    }

    @Override
    public void recoverStuck(UUID jobId, Instant startedBefore) {
        FailureEffects effects = transactionTemplate.execute(tx -> {
            lockItemOf(jobId);
            if (jobRepository.releaseStuck(jobId, startedBefore) == 0) {
                return FailureEffects.NONE; // worker vừa ghi kết quả / instance khác đã vớt
            }
            // Không biết Meta đã nhận bài hay chưa (worker chết giữa chừng) → coi như lỗi tạm thời
            // giống lỗi mạng (FR-56): retry theo lịch 5/15/30 phút, hết lượt thì FAILED + báo user.
            log.warn("[PostPublish] Job {} kẹt RUNNING từ trước {} — ghi thất bại tạm thời để retry", jobId, startedBefore);
            return saveFailure(jobId, new PublishException(PublishErrorType.TEMPORARY, PublishErrorRules.CODE_STUCK_RUNNING,
                    "Tiến trình đăng bài bị gián đoạn (máy chủ khởi động lại) — hệ thống sẽ thử lại"));
        });
        applyFailureEffects(effects);
    }

    // Thứ tự khóa item → schedule → job: khóa bài của job TRƯỚC khi claim/ghi lịch, post, job.
    private UUID lockItemOf(UUID jobId) {
        UUID itemId = jobRepository.findContentItemId(jobId).orElseThrow();
        statusResolver.lock(itemId);
        return itemId;
    }

    private boolean claimAndMarkPosting(UUID jobId) {
        if (jobRepository.findContentItemId(jobId).isEmpty()) {
            log.warn("[PostPublish] Job {} không tồn tại — bỏ qua", jobId);
            return false;
        }
        UUID itemId = lockItemOf(jobId);
        int claimed = jobRepository.claim(jobId, Instant.now());
        if (claimed == 0) {
            log.info("[PostPublish] Job {} đã được worker khác xử lý — bỏ qua", jobId);
            return false;
        }
        PostingJob job = jobRepository.findById(jobId).orElseThrow();
        Post post = job.getPost();
        PostSchedule schedule = post.getSchedule();

        // Tài khoản đích bị ngắt kết nối / mất hiệu lực sau lúc dispatch (job PENDING, chu kỳ retry) → KHÔNG đăng:
        // dừng job, đưa lịch về ON_HOLD với lý do tương ứng (như holdAllForPendingDeletion).
        // Kiểm tra CUỐI quyền dùng nền tảng — đọc trạng thái hệ thống THẲNG từ DB (không qua cache 30s): admin vừa khoá
        // nền tảng / gói vừa đổi sau lúc dispatch thì job dừng (không retry), lịch ON_HOLD, không gọi nền tảng.
        PlatformAccount target = schedule.getPlatformAccount();
        PlatformLockReason lock = platformAvailabilityService.lockReasonNow(target.getUser(), target.getPlatformName());
        if (lock != null) {
            job.setStatus(PostingJobStatus.FAILED);
            job.setEndTime(Instant.now());
            job.setErrorMessage(PLATFORM_BLOCKED_STOP_REASON);
            job.setErrorType(PublishErrorCode.PLATFORM_UNSUPPORTED.legacyType());
            job.setErrorCode(PublishErrorCode.PLATFORM_UNSUPPORTED);
            job.setPlatformErrorCode(PublishErrorRules.CODE_PLATFORM_BLOCKED);
            schedule.setStatus(ScheduleStatus.ON_HOLD); // lịch đang POSTING (đã claim) — về ON_HOLD rồi gắn lý do
            boolean newlyHeld = holdService.hold(schedule, lock.holdReason());
            statusResolver.refresh(itemId);
            if (newlyHeld) {
                heldNotifier.notifySchedule(schedule, lock.holdReason());
            }
            log.warn("[PostPublish] Job {} dừng — nền tảng {} không dùng được ({}), lịch {} → ON_HOLD",
                    jobId, target.getPlatformName(), lock, schedule.getId());
            return false;
        }

        HoldReason accountBlocker = accountBlockerOf(schedule.getPlatformAccount());
        if (accountBlocker != null) {
            job.setStatus(PostingJobStatus.FAILED);
            job.setEndTime(Instant.now());
            job.setErrorMessage(ACCOUNT_UNAVAILABLE_STOP_REASON);
            job.setErrorType(PublishErrorCode.ACCOUNT_DISCONNECTED.legacyType());
            job.setErrorCode(PublishErrorCode.ACCOUNT_DISCONNECTED);
            job.setPlatformErrorCode(PublishErrorRules.CODE_ACCOUNT_UNAVAILABLE);
            schedule.setStatus(ScheduleStatus.ON_HOLD);
            holdService.hold(schedule, accountBlocker);
            statusResolver.refresh(itemId);
            log.warn("[PostPublish] Job {} dừng — tài khoản {} không khả dụng ({}), lịch {} → ON_HOLD",
                    jobId, schedule.getPlatformAccount().getId(), accountBlocker, schedule.getId());
            return false;
        }

        // FR-55: Scheduled/Retrying → Posting; trạng thái tổng của bài suy ra từ lịch.
        post.setStatus(PostStatus.POSTING);
        schedule.setStatus(ScheduleStatus.POSTING);
        statusResolver.refresh(itemId);
        jobEventService.postUpdated(schedule);
        return true;
    }

    // Cùng chốt chặn tài khoản với PostingDispatchServiceImpl.blockerOf.
    private static HoldReason accountBlockerOf(PlatformAccount account) {
        if (account.getDeletedAt() != null) {
            return HoldReason.ACCOUNT_REMOVED;
        }
        return account.getConnectionStatus() != ConnectionStatus.ACTIVE ? HoldReason.ACCOUNT_ISSUE : null;
    }

    // Chạy trong transaction read-only: token được EncryptedStringConverter giải mã lúc nạp,
    // lỗi giải mã nổ ở đây (→ INTERNAL) chứ không nổ giữa lúc gọi nền tảng.
    private PublishTarget loadTarget(UUID jobId) {
        PostingJob job = jobRepository.findForPublish(jobId).orElseThrow();
        Post post = job.getPost();
        PostSchedule schedule = post.getSchedule();
        ContentVersion version = schedule.getContentVersion();
        // Mọi lần thử của chu kỳ dùng snapshot chụp lúc dispatch; Post cũ (UNKNOWN_LEGACY) mới đọc bản hiện tại.
        PlatformPublisher publisher = publisherFor(version.getPlatformName());
        String message = post.getSnapshotState() == PostSnapshotState.CAPTURED
                ? publisher.buildMessage(post.getSnapshotCaption(), post.getSnapshotHashtag())
                : publisher.buildMessage(version.getFormattedCaption(), version.getFormattedHashtag());
        // Gửi nội dung quá dài thì nền tảng từ chối / cắt — đăng lại vẫn y nguyên nên PERMANENT, không retry.
        String violation = PlatformTextLimits.violation(version.getPlatformName(), message);
        if (violation != null) {
            throw new PublishException(PublishErrorType.PERMANENT, PublishErrorRules.CODE_TEXT_LIMIT, violation);
        }
        // Pre-flight: token đã quá hạn thì nền tảng chắc chắn trả 190 — không gọi, xử lý như token hết hạn ngay.
        PlatformAccount account = schedule.getPlatformAccount();
        if (account.getTokenExpiredAt() != null && account.getTokenExpiredAt().isBefore(LocalDateTime.now())) {
            throw new PublishException(PublishErrorType.PERMANENT, PublishErrorRules.CODE_TOKEN_EXPIRED,
                    "Token của kết nối đã hết hạn lúc " + account.getTokenExpiredAt() + " — không gọi nền tảng");
        }
        return postPublishMapper.toPublishTarget(job, account, version, message, verifySince(post));
    }

    /**
     * Mốc kiểm tra bài đã lên nền tảng: lần thử MƠ HỒ sớm nhất của bài trong {@link #VERIFY_LOOKBACK} (trừ
     * {@link #VERIFY_CLOCK_SKEW} cho lệch giờ); không có lần nào như vậy → null (không cần kiểm tra).
     */
    private static Instant verifySince(Post post) {
        Instant cutoff = Instant.now().minus(VERIFY_LOOKBACK);
        return post.getPostingJobs().stream()
                .filter(j -> j.getStatus() == PostingJobStatus.FAILED && j.getStartTime() != null
                        && j.getStartTime().isAfter(cutoff) && isAmbiguous(j))
                .map(PostingJob::getStartTime)
                .min(Comparator.naturalOrder())
                .map(t -> t.minus(VERIFY_CLOCK_SKEW))
                .orElse(null);
    }

    // Lỗi mà nền tảng có thể ĐÃ nhận bài. Dòng cũ trước V13 (chưa có mã): mọi lỗi tạm thời — kiểm tra thừa vô hại.
    private static boolean isAmbiguous(PostingJob job) {
        return job.getErrorCode() != null
                ? AMBIGUOUS_CODES.contains(job.getErrorCode())
                : job.getErrorType() == PublishErrorType.TEMPORARY;
    }

    /**
     * FR-56: 5/15/30 phút + jitter 0–30s (tránh mọi bài lỗi cùng lúc dồn retry cùng một giây); nền tảng yêu cầu chờ lâu
     * hơn (Retry-After / BUC estimated_time_to_regain_access) → chờ theo nền tảng, tối đa {@link #MAX_PLATFORM_WAIT}.
     */
    static Duration retryDelay(int retryCount, Duration platformWait) {
        Duration delay = RETRY_DELAYS.get(Math.min(retryCount, RETRY_DELAYS.size() - 1))
                .plusSeconds(ThreadLocalRandom.current().nextLong(RETRY_JITTER_MAX_SECONDS + 1));
        if (platformWait != null && platformWait.compareTo(delay) > 0) {
            delay = platformWait.compareTo(MAX_PLATFORM_WAIT) > 0 ? MAX_PLATFORM_WAIT : platformWait;
        }
        return delay;
    }

    private PlatformPublisher publisherFor(Platform platform) {
        PlatformPublisher publisher = publishers.get(platform);
        if (publisher == null) {
            throw new PublishException(PublishErrorType.PERMANENT, PublishErrorRules.CODE_NO_PUBLISHER,
                    "Chưa hỗ trợ đăng bài cho nền tảng " + platform);
        }
        return publisher;
    }

    private void saveSuccess(UUID jobId, MetaApiClient.MetaPostResult result) {
        UUID itemId = lockItemOf(jobId);
        PostingJob job = jobRepository.findById(jobId).orElseThrow();
        Instant now = Instant.now();
        job.setStatus(PostingJobStatus.SUCCESS);
        job.setEndTime(now);

        Post post = job.getPost();
        post.setStatus(PostStatus.POSTED);
        post.setPlatformPostId(result.platformPostId());
        post.setPublishedAt(now);
        PublishResult publishResult =
                postPublishMapper.toPublishResult(post, true, "200", "Đăng bài thành công");
        post.getPublishResults().add(publishResult);

        PostSchedule schedule = post.getSchedule();
        schedule.setStatus(ScheduleStatus.POSTED);
        // Hai nền tảng của cùng bài xong cùng lúc: khóa bài tuần tự hoá hai lần ghi, lần sau thấy kết quả lần trước.
        statusResolver.refresh(itemId);
        jobEventService.postUpdated(schedule);

        // FR-75: báo đăng thành công.
        PlatformAccount account = schedule.getPlatformAccount();
        notificationService.send(account.getUser(), NotificationDraft.builder()
                .type(NotificationType.POST_PUBLISHED)
                .title("Đã đăng bài thành công")
                .message("Bài viết đã được đăng lên " + post.getPlatformName() + " (" + account.getAccountName() + ").")
                .refType(NotificationRefType.SCHEDULE).refId(schedule.getId())
                .params(NotificationParams.of("platform", post.getPlatformName(), "accountName", account.getAccountName(),
                        "postId", post.getId()))
                .build());

        // Worker nền: không có request context nên ip/userAgent để null (đúng bản chất — hệ thống
        // tự đăng theo lịch, không phải thao tác trực tiếp của user).
        activityLogService.record(ActivityLogService.Entry.of(
                ActivityAction.POST_PUBLISHED, account.getUser().getId(), account.getUser().getEmail(),
                "Post", post.getId().toString()));

        log.info("[PostPublish] Đã đăng bài {} lên {} (post id {})",
                post.getId(), post.getPlatformName(), result.platformPostId());
    }

    /**
     * Ghi kết quả thất bại (đã chuẩn hoá mã lỗi) và quyết định retry. Trả việc cần làm SAU commit: tài khoản cần
     * tạm giữ các lịch chờ + thông báo (thất bại chung cuộc) — {@link FailureEffects#NONE} khi đang tự thử lại.
     */
    private FailureEffects saveFailure(UUID jobId, PublishException e) {
        UUID itemId = lockItemOf(jobId);
        PostingJob job = jobRepository.findById(jobId).orElseThrow();
        Post post = job.getPost();
        NormalizedPublishError normalized = errorNormalizer.normalize(post.getPlatformName(), e);
        PublishErrorCode code = normalized.code();
        // Lỗi tạm thời trong lúc nền tảng đang sự cố diện rộng → PLATFORM_OUTAGE (retry bị hoãn tới khi sự cố qua).
        if ((code == PublishErrorCode.PLATFORM_TEMPORARY || code == PublishErrorCode.NETWORK_TIMEOUT)
                && incidentService.isActive(post.getPlatformName())) {
            code = PublishErrorCode.PLATFORM_OUTAGE;
        }
        // Message KỸ THUẬT (nền tảng / nội bộ) — chỉ admin & log đọc, luôn qua redactor.
        String adminMessage = SensitiveDataRedactor.redact(e.getMessage(), ADMIN_MESSAGE_MAX_LENGTH);

        job.setStatus(PostingJobStatus.FAILED);
        job.setEndTime(Instant.now());
        job.setErrorMessage(adminMessage);
        job.setErrorType(code.legacyType());
        job.setErrorCode(code);
        job.setPlatformErrorCode(normalized.platformCode());
        job.setPlatformErrorSubcode(normalized.platformSubcode());
        job.setErrorDetail(normalized.detailJson());

        post.setStatus(PostStatus.FAILED);
        // FR-35/BR-07: giữ nguyên mã lỗi GỐC của nền tảng (message đã redact).
        PublishResult publishResult =
                postPublishMapper.toPublishResult(post, false, e.getResponseCode(), adminMessage);
        post.getPublishResults().add(publishResult);

        boolean retryable = code.isAutoRetry() && job.getRetryCount() < MAX_RETRIES;
        PostSchedule heldSchedule = post.getSchedule();
        if (retryable && heldSchedule.getPlatformAccount().getUser().getStatus() == UserStatus.PENDING_DELETE) {
            // Chủ tài khoản đang chờ xoá: không tạo retry (khôi phục tài khoản sẽ tự đăng lại) — tạm giữ như
            // holdAllForPendingDeletion, user tự kích hoạt lại sau khi khôi phục.
            heldSchedule.setStatus(ScheduleStatus.ON_HOLD);
            holdService.hold(heldSchedule, HoldReason.USER_PENDING_DELETE);
            statusResolver.refresh(itemId);
            log.info("[PostPublish] Job {} lỗi tạm thời nhưng chủ tài khoản chờ xoá — không retry, lịch {} → ON_HOLD",
                    jobId, heldSchedule.getId());
            return FailureEffects.NONE;
        }
        if (retryable) {
            // FR-56: đặt lịch retry — schedule/version/item giữ POSTING (Failed → Retrying → Posted).
            Duration delay = retryDelay(job.getRetryCount(), normalized.retryAfter());
            PostingJob retryJob = postPublishMapper.toPostingJob(
                    post, job.getRetryCount() + 1, Instant.now().plus(delay), PostingJobStatus.RETRYING);
            post.getPostingJobs().add(retryJob);
            log.info("[PostPublish] Job {} [{}] sẽ retry lần {} sau {} phút",
                    jobId, code, job.getRetryCount() + 1, delay.toMinutes());
            jobEventService.postUpdated(heldSchedule); // RETRYING + attempt + nextRetryAt
            return FailureEffects.NONE;
        }

        // Thất bại chung cuộc (BR-07/BR-08): dừng pipeline, lưu lỗi, báo user (FR-57/FR-76) sau commit.
        PostSchedule schedule = post.getSchedule();
        schedule.setStatus(ScheduleStatus.FAILED);
        statusResolver.refresh(itemId);
        jobEventService.postUpdated(schedule);
        String reference = PublishReference.of(jobId);
        log.warn("[PostPublish] Bài {} thất bại chung cuộc trên {} [{} / mã gốc {}] ({}): {}",
                post.getId(), post.getPlatformName(), code, e.getResponseCode(), reference, adminMessage);
        // FR-74: lưu lỗi đăng bài chung cuộc vào log hệ thống cho admin (FR-83/FR-84).
        systemLogService.error("posting.worker",
                "Bài " + post.getId() + " thất bại chung cuộc trên " + post.getPlatformName()
                        + " [" + code + " - mã " + e.getResponseCode() + "] (" + reference + "): " + adminMessage, e);

        PlatformAccount account = schedule.getPlatformAccount();
        activityLogService.record(new ActivityLogService.Entry(
                ActivityAction.POST_FAILED, account.getUser().getId(), account.getUser().getEmail(),
                "Post", post.getId().toString(), ActivityResult.FAILURE,
                Map.of("platform", String.valueOf(post.getPlatformName()), "errorCode", code.name(),
                        "errorType", String.valueOf(code.legacyType()),
                        "responseCode", String.valueOf(e.getResponseCode()), "reference", reference)));
        PublishFailureNotice notice = new PublishFailureNotice(account.getUser().getId(), account.getId(),
                account.getAccountName(), post.getPlatformName(), post.getId(), jobId, code);

        if (account.getDeletedAt() != null) {
            // kết nối đã ngắt (DISCONNECTED, lịch đã được giữ lúc ngắt) — không ghi đè trạng thái
            return new FailureEffects(null, notice);
        }
        if (EXPIRES_ACCOUNT.contains(code)) {
            // FR-70 (khớp FR-18b): token hết hạn → tài khoản EXPIRED, các lịch SCHEDULED khác → ON_HOLD (sau commit).
            account.setConnectionStatus(ConnectionStatus.EXPIRED);
            log.warn("[PostPublish] Token {} của tài khoản {} không còn hiệu lực ({}) — tạm giữ các lịch chờ",
                    account.getPlatformName(), account.getId(), code);
            return new FailureEffects(account.getId(), notice);
        }
        if (RESTRICTS_ACCOUNT.contains(code)) {
            // FR-73: tài khoản bị nền tảng chặn/hạn chế → dừng đăng các lịch còn lại + báo user.
            account.setConnectionStatus(ConnectionStatus.ERROR);
            log.warn("[PostPublish] Tài khoản {} ({}) bị hạn chế ({}) — tạm giữ các lịch chờ",
                    account.getId(), account.getPlatformName(), code);
            return new FailureEffects(account.getId(), notice);
        }
        return new FailureEffects(null, notice);
    }
}
