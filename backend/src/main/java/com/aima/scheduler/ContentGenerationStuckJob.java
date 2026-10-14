package com.aima.scheduler;

import java.util.UUID;
import java.util.List;
import com.aima.service.JobEventService;
import com.aima.exception.ErrorCode;
import com.aima.repository.ContentGenerationJobRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Chốt FAILED (mã {@code AI_TIMEOUT}) các job tạo nội dung kẹt ở PENDING/RUNNING — quét mỗi phút.
 *
 * <p>Job chỉ kẹt khi worker chết giữa chừng (server restart/deploy): một lượt chạy bình thường
 * tối đa ~{@code AI_SERVICE_TIMEOUT_SECONDS} (100s). Không chốt thì chống trùng theo
 * (bài, nền tảng) sẽ trả mãi job chết đó và user không tạo lại được.</p>
 *
 * <p>Worker vẫn về muộn sau khi bị chốt? {@code saveSuccess} ghi đè SUCCESS — kết quả không mất;
 * job còn trong hàng đợi executor thì worker thấy không còn PENDING và bỏ qua.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ContentGenerationStuckJob {

    static final Duration STUCK_AGE = Duration.ofMinutes(5);

    ContentGenerationJobRepository jobRepository;
    TransactionTemplate transactionTemplate;
    JobEventService jobEventService;

    @Scheduled(fixedDelay = 60_000)
    @SchedulerLock(name = "content-generation-stuck", lockAtMostFor = "PT5M", lockAtLeastFor = "PT20S")
    public void run() {
        try {
            LocalDateTime now = LocalDateTime.now();
            Integer failed = transactionTemplate.execute(status -> {
                List<UUID> stuck = jobRepository.findStuckIds(now.minus(STUCK_AGE));
                int count = jobRepository.failStuckJobs(now.minus(STUCK_AGE), now, ErrorCode.AI_TIMEOUT.name(),
                        ErrorCode.AI_TIMEOUT.getMessage());
                stuck.forEach(jobEventService::generationFailed); // báo user + job.updated sau commit
                return count;
            });
            if (failed != null && failed > 0) {
                log.warn("[ContentGenerationStuck] Chốt FAILED/AI_TIMEOUT {} job kẹt quá {} phút",
                        failed, STUCK_AGE.toMinutes());
            }
        } catch (Exception e) {
            log.error("[ContentGenerationStuck] Vòng quét job kẹt lỗi: {}", e.getMessage(), e);
        }
    }
}
