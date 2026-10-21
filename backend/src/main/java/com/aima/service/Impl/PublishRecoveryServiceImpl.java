package com.aima.service.Impl;

import com.aima.dto.publish.PublishFailureFacts;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishResult;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.FailureResolution;
import com.aima.enums.FailureState;
import com.aima.enums.PostSnapshotState;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.PublishErrorAction;
import com.aima.enums.PublishErrorCode;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.PostingJobRepository;
import com.aima.service.ContentItemStatusResolver;
import com.aima.service.PostPublishWorkerService;
import com.aima.service.PostingDispatchService;
import com.aima.service.PublishErrorNormalizer;
import com.aima.service.PublishRecoveryService;
import com.aima.util.PublishReference;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Hồi phục bài lỗi. Thứ tự khóa giữ đúng quy ước resolver (item → schedule → job): khóa bài TRƯỚC khi đọc/ghi
 * lịch và job. "Thử lại ngay" đi CÙNG đường {@link PostingDispatchService} với dispatcher/"Đăng ngay" (chốt chặn tạm
 * giữ, claim có điều kiện, snapshot nội dung mới) và giao worker SAU commit (rule #28) — caller KHÔNG được bọc
 * phương thức này trong transaction khác.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class PublishRecoveryServiceImpl implements PublishRecoveryService {

    /** 1 lần đăng + tối đa 3 lần tự thử lại (FR-56). */
    static final int MAX_ATTEMPTS = PostPublishWorkerServiceImpl.MAX_RETRIES + 1;

    PostRepository postRepository;
    PostScheduleRepository scheduleRepository;
    PostingJobRepository jobRepository;
    PostingDispatchService dispatchService;
    PostPublishWorkerService publishWorker;
    ContentItemStatusResolver statusResolver;
    PublishErrorNormalizer errorNormalizer;
    TransactionTemplate transactionTemplate;

    @Override
    public PublishFailureFacts describe(Post post) {
        PostSchedule schedule = post.getSchedule();
        PostingJob lastFailed = lastFailedJob(post);
        PostingJob pendingRetry = post.getPostingJobs().stream()
                .filter(j -> j.getStatus() == PostingJobStatus.RETRYING)
                .max(Comparator.comparing(PostingJob::getRetryCount))
                .orElse(null);
        PublishResult lastError = lastErrorResult(post);

        PublishErrorCode code = lastFailed == null && lastError == null
                ? PublishErrorCode.UNKNOWN
                : errorNormalizer.resolve(post.getPlatformName(), lastFailed, lastError);
        FailureState state = stateOf(schedule, lastFailed, pendingRetry);
        int attempt = pendingRetry != null ? pendingRetry.getRetryCount()
                : lastFailed == null ? 0 : lastFailed.getRetryCount() + 1;
        boolean contentChanged = contentChanged(post, schedule.getContentVersion());
        PlatformAccount account = schedule.getPlatformAccount();
        boolean accountReady = account.getDeletedAt() == null && account.getConnectionStatus() == ConnectionStatus.ACTIVE;

        return new PublishFailureFacts(code,
                errorNormalizer.platformCodeOf(lastFailed, lastError),
                lastFailed == null ? null : lastFailed.getPlatformErrorSubcode(),
                state, attempt,
                code.isAutoRetry() ? MAX_ATTEMPTS : null,
                pendingRetry == null ? null : pendingRetry.getNextRetryAt(),
                lastFailed == null ? null : lastFailed.getEndTime(),
                lastFailed == null ? null : PublishReference.of(lastFailed.getId()),
                actionsOf(code, state, contentChanged),
                contentChanged, accountReady);
    }

    @Override
    public PostingJob lastFailedJob(Post post) {
        return post.getPostingJobs().stream()
                .filter(j -> j.getStatus() == PostingJobStatus.FAILED)
                .max(Comparator.comparing(PostingJob::getEndTime, Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElse(null);
    }

    @Override
    public PublishResult lastErrorResult(Post post) {
        return post.getPublishResults().stream()
                .filter(r -> Boolean.FALSE.equals(r.getIsSuccess()))
                .max(Comparator.comparing(PublishResult::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElse(null);
    }

    @Override
    public RetryOutcome retry(UUID postId, UUID actorId) {
        RetryOutcome outcome = transactionTemplate.execute(tx -> retryInTx(postId, actorId));
        // Đã commit: giao worker (claim nguyên tử chống chạy trùng nếu dispatcher cũng nhặt được).
        if (outcome != null && outcome.jobId() != null) {
            publishWorker.process(outcome.jobId());
        }
        return outcome;
    }

    private RetryOutcome retryInTx(UUID postId, UUID actorId) {
        Post post = lockedPost(postId);
        PostSchedule schedule = post.getSchedule();
        if (schedule.getStatus() != ScheduleStatus.FAILED) {
            throw new AppException(ErrorCode.FAILED_POST_NOT_ACTIONABLE);
        }
        if (schedule.getPlatformAccount().getUser().getStatus() == UserStatus.PENDING_DELETE) {
            throw new AppException(ErrorCode.SCHEDULING_BLOCKED_PENDING_DELETE);
        }
        PublishFailureFacts facts = describe(post);
        PublishErrorCode code = facts.code();
        if (code.isManualRetryBlocked()) {
            throw new AppException(ErrorCode.FAILED_POST_NOT_RETRYABLE);
        }
        if (!facts.accountReady()) {
            throw new AppException(ErrorCode.FAILED_POST_ACCOUNT_NOT_READY);
        }
        if (code.isRequiresContentChange() && !facts.contentChanged()) {
            throw new AppException(ErrorCode.FAILED_POST_EDIT_REQUIRED);
        }

        resolve(lastFailedJob(post), FailureResolution.RETRIED, actorId);
        schedule.setScheduledTime(Instant.now());
        schedule.setStatus(ScheduleStatus.SCHEDULED);
        // Flush TRƯỚC dispatch: claim là bulk update clearAutomatically — thay đổi chưa flush sẽ bị bỏ.
        scheduleRepository.saveAndFlush(schedule);

        PostingDispatchService.Outcome dispatched = dispatchService.dispatch(schedule.getId(), true);
        if (dispatched.jobId() == null && dispatched.heldFor() == null) {
            throw new AppException(ErrorCode.FAILED_POST_NOT_ACTIONABLE);
        }
        log.info("[PublishRecovery] Bài {} thử lại theo yêu cầu {} [{}] → job {} / tạm giữ {}",
                postId, actorId, code, dispatched.jobId(), dispatched.heldFor());
        return new RetryOutcome(postId, schedule.getId(), dispatched.jobId(), dispatched.heldFor());
    }

    @Override
    public void dismiss(UUID postId, UUID actorId) {
        transactionTemplate.executeWithoutResult(tx -> {
            Post post = lockedPost(postId);
            if (post.getSchedule().getStatus() != ScheduleStatus.FAILED) {
                throw new AppException(ErrorCode.FAILED_POST_NOT_ACTIONABLE);
            }
            PostingJob lastFailed = lastFailedJob(post);
            if (lastFailed == null) {
                throw new AppException(ErrorCode.FAILED_POST_NOT_ACTIONABLE);
            }
            if (lastFailed.getResolution() != FailureResolution.DISMISSED) {
                resolve(lastFailed, FailureResolution.DISMISSED, actorId);
            }
        });
    }

    @Override
    public void markCancelled(PostSchedule schedule, UUID actorId) {
        if (schedule.getStatus() != ScheduleStatus.FAILED || schedule.getPost() == null) {
            return;
        }
        PostingJob lastFailed = lastFailedJob(schedule.getPost());
        if (lastFailed != null && lastFailed.getResolution() == null) {
            resolve(lastFailed, FailureResolution.CANCELLED, actorId);
        }
    }

    private void resolve(PostingJob job, FailureResolution resolution, UUID actorId) {
        if (job == null) {
            return;
        }
        job.setResolution(resolution);
        job.setResolvedAt(Instant.now());
        job.setResolvedBy(actorId);
        jobRepository.saveAndFlush(job);
    }

    // Khóa bài TRƯỚC khi đọc lịch/job (thứ tự item → schedule → job của resolver).
    private Post lockedPost(UUID postId) {
        UUID itemId = postRepository.findContentItemId(postId)
                .orElseThrow(() -> new AppException(ErrorCode.POST_NOT_FOUND));
        statusResolver.lock(itemId);
        return postRepository.findById(postId).orElseThrow(() -> new AppException(ErrorCode.POST_NOT_FOUND));
    }

    private static FailureState stateOf(PostSchedule schedule, PostingJob lastFailed, PostingJob pendingRetry) {
        if (schedule.getStatus() == ScheduleStatus.POSTING && pendingRetry != null) {
            return FailureState.AUTO_RETRYING;
        }
        if (schedule.getStatus() == ScheduleStatus.FAILED) {
            return lastFailed != null && lastFailed.getResolution() == FailureResolution.DISMISSED
                    ? FailureState.DISMISSED : FailureState.NEEDS_ACTION;
        }
        return FailureState.RESOLVED;
    }

    /**
     * Bản nền tảng đã được sửa sau lần đăng lỗi: revision hiện tại > revision trong snapshot của chu kỳ lỗi.
     * Post trước V4 (không có snapshot) không so được → coi như đã sửa (không chặn người dùng oan).
     */
    static boolean contentChanged(Post post, ContentVersion version) {
        if (post.getSnapshotState() != PostSnapshotState.CAPTURED || post.getSnapshotRevision() == null) {
            return true;
        }
        return version.getRevision() > post.getSnapshotRevision();
    }

    /** Hành động khả dụng NGAY: theo catalog, rồi lọc theo vòng đời và việc nội dung đã được sửa hay chưa. */
    static List<PublishErrorAction> actionsOf(PublishErrorCode code, FailureState state, boolean contentChanged) {
        if (state == FailureState.AUTO_RETRYING || state == FailureState.RESOLVED) {
            return List.of();
        }
        List<PublishErrorAction> actions = new ArrayList<>(code.actions());
        if (code.isRequiresContentChange() && contentChanged && !code.isManualRetryBlocked()
                && !actions.contains(PublishErrorAction.RETRY_NOW)) {
            // Đã sửa nội dung → "Đăng lại" thành bước chính, ngay sau "Sửa nội dung".
            int afterEdit = actions.indexOf(PublishErrorAction.EDIT_CONTENT) + 1;
            actions.add(afterEdit, PublishErrorAction.RETRY_NOW);
        }
        if (state == FailureState.DISMISSED) {
            actions.remove(PublishErrorAction.DISMISS);
        }
        return List.copyOf(actions);
    }
}
