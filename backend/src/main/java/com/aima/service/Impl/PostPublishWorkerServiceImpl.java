package com.aima.service.Impl;

import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishResult;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentLifecycle;
import com.aima.enums.NotificationType;
import com.aima.enums.Platform;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.PublishErrorType;
import com.aima.enums.ScheduleStatus;
import com.aima.exception.PublishException;
import com.aima.mapper.PostPublishMapper;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.PostingJobRepository;
import com.aima.service.MetaApiClient;
import com.aima.service.NotificationService;
import com.aima.service.PlatformPublisher;
import com.aima.service.PostPublishWorkerService;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    // Mã lỗi Graph 190 = token hết hạn/không hợp lệ → FR-70/FR-18b.
    static final String TOKEN_EXPIRED_CODE = "190";

    PostingJobRepository jobRepository;
    PostScheduleRepository scheduleRepository;
    PostPublishMapper postPublishMapper;
    TransactionTemplate transactionTemplate;
    NotificationService notificationService;
    Map<Platform, PlatformPublisher> publishers;

    public PostPublishWorkerServiceImpl(PostingJobRepository jobRepository,
                                        PostScheduleRepository scheduleRepository,
                                        PostPublishMapper postPublishMapper,
                                        TransactionTemplate transactionTemplate,
                                        NotificationService notificationService,
                                        List<PlatformPublisher> publisherList) {
        this.jobRepository = jobRepository;
        this.scheduleRepository = scheduleRepository;
        this.postPublishMapper = postPublishMapper;
        this.transactionTemplate = transactionTemplate;
        this.notificationService = notificationService;
        this.publishers = publisherList.stream()
                .collect(Collectors.toUnmodifiableMap(PlatformPublisher::platform, Function.identity()));
    }

    @Override
    @Async("postPublishExecutor")
    public void process(UUID jobId) {
        // Transaction ngắn 1: claim + chuyển pipeline sang POSTING (poller thấy ngay).
        PublishTask task = transactionTemplate.execute(tx -> claimAndPrepare(jobId));
        if (task == null) {
            return;
        }

        try {
            PlatformPublisher publisher = publishers.get(task.platform());
            if (publisher == null) {
                throw new PublishException(PublishErrorType.PERMANENT, "NO_PUBLISHER",
                        "Chưa hỗ trợ đăng bài cho nền tảng " + task.platform());
            }
            // Gọi nền tảng NGOÀI transaction (rule #24).
            MetaApiClient.MetaPostResult result = publisher.publish(task.account(), task.version());
            transactionTemplate.executeWithoutResult(tx -> saveSuccess(jobId, result));
        } catch (PublishException e) {
            log.warn("[PostPublish] Job {} thất bại [{} - mã {}]: {}",
                    jobId, e.getErrorType(), e.getResponseCode(), e.getMessage());
            transactionTemplate.executeWithoutResult(tx -> saveFailure(jobId, e));
        } catch (Exception e) {
            // Không để thread worker chết im lặng (rule #28e) — lỗi lạ coi là tạm thời để còn retry.
            log.error("[PostPublish] Job {} lỗi không lường trước", jobId, e);
            PublishException wrapped =
                    new PublishException(PublishErrorType.TEMPORARY, "UNEXPECTED", e.getMessage());
            transactionTemplate.executeWithoutResult(tx -> saveFailure(jobId, wrapped));
        }
    }

    /** Dữ liệu cần cho cuộc gọi nền tảng — nạp sẵn trong transaction, dùng ngoài transaction. */
    record PublishTask(Platform platform, PlatformAccount account, ContentVersion version) {
    }

    private PublishTask claimAndPrepare(UUID jobId) {
        int claimed = jobRepository.claim(jobId, LocalDateTime.now());
        if (claimed == 0) {
            log.info("[PostPublish] Job {} đã được worker khác xử lý — bỏ qua", jobId);
            return null;
        }
        PostingJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            return null;
        }

        Post post = job.getPost();
        PostSchedule schedule = post.getSchedule();
        ContentVersion version = schedule.getContentVersion();

        // FR-55: Scheduled/Retrying → Posting trên toàn pipeline.
        post.setStatus(PostStatus.POSTING);
        schedule.setStatus(ScheduleStatus.POSTING);
        version.setStatus(ContentLifecycle.POSTING);
        version.getContentItem().setStatus(ContentLifecycle.POSTING);

        return new PublishTask(version.getPlatformName(), schedule.getPlatformAccount(), version);
    }

    private void saveSuccess(UUID jobId, MetaApiClient.MetaPostResult result) {
        PostingJob job = jobRepository.findById(jobId).orElseThrow();
        LocalDateTime now = LocalDateTime.now();
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
        ContentVersion version = schedule.getContentVersion();
        version.setStatus(ContentLifecycle.POSTED);
        version.getContentItem().setStatus(ContentLifecycle.POSTED);

        // FR-75: báo đăng thành công.
        PlatformAccount account = schedule.getPlatformAccount();
        notificationService.notify(account.getUser(), NotificationType.POST_PUBLISHED,
                "Đã đăng bài thành công",
                "Bài viết đã được đăng lên " + post.getPlatformName() + " (" + account.getAccountName() + ").",
                post.getId());

        log.info("[PostPublish] Đã đăng bài {} lên {} (post id {})",
                post.getId(), post.getPlatformName(), result.platformPostId());
    }

    private void saveFailure(UUID jobId, PublishException e) {
        PostingJob job = jobRepository.findById(jobId).orElseThrow();
        job.setStatus(PostingJobStatus.FAILED);
        job.setEndTime(LocalDateTime.now());
        job.setErrorMessage(e.getMessage());
        job.setErrorType(e.getErrorType());

        Post post = job.getPost();
        post.setStatus(PostStatus.FAILED);
        // FR-35/BR-07: giữ nguyên mã lỗi + message GỐC của nền tảng.
        PublishResult publishResult =
                postPublishMapper.toPublishResult(post, false, e.getResponseCode(), e.getMessage());
        post.getPublishResults().add(publishResult);

        boolean retryable = e.getErrorType() == PublishErrorType.TEMPORARY && job.getRetryCount() < MAX_RETRIES;
        if (retryable) {
            // FR-56: đặt lịch retry — schedule/version/item giữ POSTING (Failed → Retrying → Posted).
            Duration delay = RETRY_DELAYS.get(Math.min(job.getRetryCount(), RETRY_DELAYS.size() - 1));
            PostingJob retryJob = postPublishMapper.toPostingJob(
                    post, job.getRetryCount() + 1, LocalDateTime.now().plus(delay), PostingJobStatus.RETRYING);
            post.getPostingJobs().add(retryJob);
            log.info("[PostPublish] Job {} sẽ retry lần {} sau {} phút",
                    jobId, job.getRetryCount() + 1, delay.toMinutes());
            return;
        }

        // Thất bại chung cuộc (BR-07/BR-08): dừng pipeline, lưu lỗi; notification (FR-57) chưa có — log.
        PostSchedule schedule = post.getSchedule();
        schedule.setStatus(ScheduleStatus.FAILED);
        ContentVersion version = schedule.getContentVersion();
        version.setStatus(ContentLifecycle.FAILED);
        ContentItem item = version.getContentItem();
        item.setStatus(ContentLifecycle.FAILED);
        log.warn("[PostPublish] Bài {} thất bại chung cuộc trên {} [{}]: {}",
                post.getId(), post.getPlatformName(), e.getErrorType(), e.getMessage());

        // FR-70 (khớp FR-18b): token hết hạn → tài khoản EXPIRED, các lịch SCHEDULED khác → ON_HOLD.
        if (TOKEN_EXPIRED_CODE.equals(e.getResponseCode())) {
            PlatformAccount account = schedule.getPlatformAccount();
            account.setConnectionStatus(ConnectionStatus.EXPIRED);
            List<PostSchedule> waiting = scheduleRepository
                    .findByPlatformAccount_IdAndStatusAndDeletedAtIsNull(account.getId(), ScheduleStatus.SCHEDULED);
            waiting.forEach(s -> s.setStatus(ScheduleStatus.ON_HOLD));
            log.warn("[PostPublish] Token {} hết hạn — chuyển {} lịch chờ sang ON_HOLD",
                    account.getPlatformName(), waiting.size());
        }
    }
}
