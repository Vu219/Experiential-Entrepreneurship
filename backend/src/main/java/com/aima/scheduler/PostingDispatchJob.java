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
import com.aima.dto.response.PlatformIncidentResponse;
import com.aima.enums.Platform;
import com.aima.service.PlatformIncidentService;
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

    // User không được đăng bài: chờ xoá (tài khoản sắp bị xoá) hoặc bị khoá (admin).
    static final List<UserStatus> EXCLUDED_USER_STATUSES = List.of(UserStatus.PENDING_DELETE, UserStatus.LOCKED);

    // Job RUNNING quá lâu = worker chết giữa chừng (Meta WebClient có timeout nên job sống không kéo dài tới mức này).
    static final Duration STUCK_RUNNING_AGE = Duration.ofMinutes(10);

    PostScheduleRepository scheduleRepository;
    PostingJobRepository jobRepository;
    PostPublishWorkerService postPublishWorkerService;
    PostingDispatchService dispatchService;
    TransactionTemplate transactionTemplate;
    PlatformIncidentService incidentService;

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
                .findByStatusAndScheduledTimeLessThanEqualAndDeletedAtIsNullAndPlatformAccount_User_StatusNotIn(
                        ScheduleStatus.SCHEDULED, now, EXCLUDED_USER_STATUSES); // tài khoản chờ xoá/bị khoá: không đăng
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
        // Nền tảng đang sự cố diện rộng: HOÃN retry (job giữ RETRYING, không tiêu lượt) tới khi sự cố qua.
        List<Platform> deferred = incidentService.activeIncidents().stream()
                .map(PlatformIncidentResponse::getPlatform).toList();
        if (!deferred.isEmpty()) {
            log.warn("[PostingDispatch] Hoãn retry của {} — nền tảng đang có sự cố", deferred);
        }
        List<PostingJob> retries = deferred.isEmpty()
                ? jobRepository.findByStatusAndNextRetryAtLessThanEqualAndDeletedAtIsNullAndPost_Schedule_PlatformAccount_User_StatusNotIn(
                        PostingJobStatus.RETRYING, now, EXCLUDED_USER_STATUSES)
                : jobRepository.findByStatusAndNextRetryAtLessThanEqualAndDeletedAtIsNullAndPost_Schedule_PlatformAccount_User_StatusNotInAndPost_PlatformNameNotIn(
                        PostingJobStatus.RETRYING, now, EXCLUDED_USER_STATUSES, deferred);
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
                .findByStatusAndCreatedAtLessThanEqualAndDeletedAtIsNullAndPost_Schedule_PlatformAccount_User_StatusNotIn(
                        PostingJobStatus.PENDING, com.aima.util.PublishingTime.toLegacy(now.minus(STALE_PENDING_AGE)), EXCLUDED_USER_STATUSES);
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
