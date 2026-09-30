package com.aima.scheduler;

import com.aima.entity.PostSchedule;
import com.aima.entity.PostingJob;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.UserStatus;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.PostingJobRepository;
import com.aima.service.PostPublishWorkerService;
import com.aima.service.PostingDispatchService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
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

    // Job RUNNING quá lâu = worker chết giữa chừng (Meta WebClient có timeout nên job sống không kéo dài tới mức này).
    static final Duration STUCK_RUNNING_AGE = Duration.ofMinutes(10);

    PostScheduleRepository scheduleRepository;
    PostingJobRepository jobRepository;
    PostPublishWorkerService postPublishWorkerService;
    PostingDispatchService dispatchService;
    TransactionTemplate transactionTemplate;

    @Scheduled(fixedDelay = 60_000)
    @SchedulerLock(name = "posting-dispatch", lockAtMostFor = "PT5M", lockAtLeastFor = "PT20S")
    public void run() {
        Instant now = Instant.now();
        dispatchDueSchedules(now);
        dispatchDueRetries(now);
        redispatchStalePending(now);
        recoverStuckRunning(now);
    }

    private void dispatchDueSchedules(Instant now) {
        List<PostSchedule> due = scheduleRepository
                .findByStatusAndScheduledTimeLessThanEqualAndDeletedAtIsNullAndPlatformAccount_User_StatusNot(
                        ScheduleStatus.SCHEDULED, now, UserStatus.PENDING_DELETE); // tài khoản chờ xoá: không đăng
        for (PostSchedule schedule : due) {
            try {
                // Transaction ngắn tạo Post + Job; dispatch worker SAU khi commit (rule #28).
                UUID jobId = transactionTemplate.execute(tx -> dispatchService.dispatch(schedule.getId()).jobId());
                if (jobId != null) {
                    log.info("[PostingDispatch] Lịch {} đến hạn → tạo job {}, giao worker", schedule.getId(), jobId);
                    postPublishWorkerService.process(jobId);
                }
            } catch (Exception e) {
                log.error("[PostingDispatch] Bỏ qua lịch {} do lỗi khi dispatch", schedule.getId(), e);
            }
        }
    }

    private void dispatchDueRetries(Instant now) {
        List<PostingJob> retries = jobRepository
                .findByStatusAndNextRetryAtLessThanEqualAndDeletedAtIsNullAndPost_Schedule_PlatformAccount_User_StatusNot(
                        PostingJobStatus.RETRYING, now, UserStatus.PENDING_DELETE);
        for (PostingJob job : retries) {
            try {
                postPublishWorkerService.process(job.getId()); // claim nguyên tử chống dispatch trùng
            } catch (Exception e) {
                log.error("[PostingDispatch] Bỏ qua retry job {} do lỗi khi dispatch", job.getId(), e);
            }
        }
    }

    private void recoverStuckRunning(Instant now) {
        Instant threshold = now.minus(STUCK_RUNNING_AGE);
        for (PostingJob job : jobRepository.findByStatusAndStartTimeLessThanEqualAndDeletedAtIsNull(
                PostingJobStatus.RUNNING, threshold)) {
            try {
                postPublishWorkerService.recoverStuck(job.getId(), threshold);
            } catch (Exception e) {
                log.error("[PostingDispatch] Bỏ qua job kẹt {} do lỗi khi vớt", job.getId(), e);
            }
        }
    }

    private void redispatchStalePending(Instant now) {
        List<PostingJob> stale = jobRepository
                .findByStatusAndCreatedAtLessThanEqualAndDeletedAtIsNullAndPost_Schedule_PlatformAccount_User_StatusNot(
                        PostingJobStatus.PENDING, com.aima.util.PublishingTime.toLegacy(now.minus(STALE_PENDING_AGE)), UserStatus.PENDING_DELETE);
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
