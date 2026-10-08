package com.aima.scheduler;

import com.aima.exception.ErrorCode;
import com.aima.repository.ContentRegenerationJobRepository;
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
 * Chốt FAILED (thông điệp {@code AI_TIMEOUT}) các job tạo lại từng phần kịch bản kẹt ở PENDING/RUNNING —
 * quét mỗi phút, cùng mẫu {@link ContentGenerationStuckJob} (một lần gọi AI ~100s nên ngưỡng 5 phút).
 *
 * <p>Không chốt thì job chết chiếm chỗ giới hạn tác vụ AI song song của user vĩnh viễn. Worker về muộn vẫn ghi
 * đè SUCCESS; job còn trong hàng đợi executor thì worker thấy không còn PENDING và bỏ qua.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ContentRegenerationStuckJob {

    static final Duration STUCK_AGE = Duration.ofMinutes(5);

    ContentRegenerationJobRepository jobRepository;
    TransactionTemplate transactionTemplate;

    @Scheduled(fixedDelay = 60_000)
    @SchedulerLock(name = "content-regeneration-stuck", lockAtMostFor = "PT5M", lockAtLeastFor = "PT20S")
    public void run() {
        try {
            LocalDateTime now = LocalDateTime.now();
            Integer failed = transactionTemplate.execute(status -> jobRepository.failStuckJobs(
                    now.minus(STUCK_AGE), now, ErrorCode.AI_TIMEOUT.getMessage()));
            if (failed != null && failed > 0) {
                log.warn("[ContentRegenerationStuck] Chốt FAILED/AI_TIMEOUT {} job kẹt quá {} phút",
                        failed, STUCK_AGE.toMinutes());
            }
        } catch (Exception e) {
            log.error("[ContentRegenerationStuck] Vòng quét job kẹt lỗi: {}", e.getMessage(), e);
        }
    }
}
