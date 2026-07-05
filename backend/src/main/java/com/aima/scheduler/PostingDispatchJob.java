package com.aima.scheduler;

import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostingJob;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.mapper.PostPublishMapper;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.PostingJobRepository;
import com.aima.service.PostPublishWorkerService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * FR-52: quét mỗi phút — lịch đến hạn thì tạo Post + PostingJob rồi giao cho worker nền;
 * đồng thời chạy lại các retry đến hạn (FR-56) và vớt job PENDING bị mất dispatch (app crash).
 * Resilient: lỗi từng lịch/job chỉ log và bỏ qua, không làm vỡ cả lần quét (rule #27).
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class PostingDispatchJob {

    // Job PENDING quá lâu = dispatch bị mất (crash giữa tạo job và chạy worker) — vớt lại.
    static final Duration STALE_PENDING_AGE = Duration.ofMinutes(5);

    PostScheduleRepository scheduleRepository;
    PostRepository postRepository;
    PostingJobRepository jobRepository;
    PostPublishMapper postPublishMapper;
    PostPublishWorkerService postPublishWorkerService;
    TransactionTemplate transactionTemplate;

    @Scheduled(fixedDelay = 60_000)
    public void run() {
        LocalDateTime now = LocalDateTime.now();
        dispatchDueSchedules(now);
        dispatchDueRetries(now);
        redispatchStalePending(now);
    }

    private void dispatchDueSchedules(LocalDateTime now) {
        List<PostSchedule> due = scheduleRepository
                .findByStatusAndScheduledTimeLessThanEqualAndDeletedAtIsNull(ScheduleStatus.SCHEDULED, now);
        for (PostSchedule schedule : due) {
            try {
                // Transaction ngắn tạo Post + Job; dispatch worker SAU khi commit (rule #28).
                UUID jobId = transactionTemplate.execute(tx -> createPostAndJob(schedule.getId()));
                if (jobId != null) {
                    postPublishWorkerService.process(jobId);
                }
            } catch (Exception e) {
                log.error("[PostingDispatch] Bỏ qua lịch {} do lỗi khi dispatch", schedule.getId(), e);
            }
        }
    }

    private UUID createPostAndJob(UUID scheduleId) {
        PostSchedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
        // Guard trong transaction: lịch có thể vừa bị hủy/giữ lại giữa hai lần quét.
        if (schedule == null || schedule.getDeletedAt() != null || schedule.getStatus() != ScheduleStatus.SCHEDULED) {
            return null;
        }
        schedule.setStatus(ScheduleStatus.POSTING);

        Post post = schedule.getPost();
        if (post == null) {
            post = postPublishMapper.toPost(schedule);
            schedule.setPost(post);
        } else {
            // Lịch được tái sử dụng sau lần FAILED + hủy trước đó — mở chu kỳ đăng mới trên cùng Post.
            post.setStatus(PostStatus.POSTING);
        }
        Post savedPost = postRepository.save(post);

        PostingJob job = postPublishMapper.toPostingJob(savedPost, 0, null, PostingJobStatus.PENDING);
        savedPost.getPostingJobs().add(job);
        PostingJob savedJob = jobRepository.save(job);
        return savedJob.getId();
    }

    private void dispatchDueRetries(LocalDateTime now) {
        List<PostingJob> retries = jobRepository
                .findByStatusAndNextRetryAtLessThanEqualAndDeletedAtIsNull(PostingJobStatus.RETRYING, now);
        for (PostingJob job : retries) {
            try {
                postPublishWorkerService.process(job.getId()); // claim nguyên tử chống dispatch trùng
            } catch (Exception e) {
                log.error("[PostingDispatch] Bỏ qua retry job {} do lỗi khi dispatch", job.getId(), e);
            }
        }
    }

    private void redispatchStalePending(LocalDateTime now) {
        List<PostingJob> stale = jobRepository
                .findByStatusAndCreatedAtLessThanEqualAndDeletedAtIsNull(
                        PostingJobStatus.PENDING, now.minus(STALE_PENDING_AGE));
        for (PostingJob job : stale) {
            try {
                log.info("[PostingDispatch] Vớt lại job PENDING {} (mất dispatch)", job.getId());
                postPublishWorkerService.process(job.getId());
            } catch (Exception e) {
                log.error("[PostingDispatch] Bỏ qua job {} do lỗi khi dispatch lại", job.getId(), e);
            }
        }
    }
}
