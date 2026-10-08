package com.aima.scheduler;

import com.aima.repository.TrendResearchSessionRepository;
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
 * Chốt FAILED các phiên nghiên cứu xu hướng kẹt — quét mỗi phút (cùng mẫu {@link ContentGenerationStuckJob}).
 *
 * <p>Phiên chỉ kẹt khi worker chết / hàng đợi trong bộ nhớ mất (restart, deploy). Không chốt thì guard
 * "1 phiên PENDING/RUNNING mỗi user" chặn "Research ngay" của user VĨNH VIỄN. Một phiên bình thường tối đa
 * ~{@code AI_RESEARCH_TIMEOUT_SECONDS} (200s); phiên tự động 2:00 AM có thể chờ lâu trong hàng đợi riêng
 * nên ngưỡng PENDING của chúng dài hơn.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TrendResearchStuckJob {

    static final Duration STUCK_AGE = Duration.ofMinutes(10);
    static final Duration SCHEDULED_QUEUE_AGE = Duration.ofHours(12);
    static final String MESSAGE = "Phiên nghiên cứu bị gián đoạn, vui lòng thử lại";

    TrendResearchSessionRepository sessionRepository;
    TransactionTemplate transactionTemplate;

    @Scheduled(fixedDelay = 60_000)
    @SchedulerLock(name = "trend-research-stuck", lockAtMostFor = "PT5M", lockAtLeastFor = "PT20S")
    public void run() {
        try {
            LocalDateTime now = LocalDateTime.now();
            Integer failed = transactionTemplate.execute(status -> sessionRepository.failStuckSessions(
                    now.minus(STUCK_AGE), now.minus(SCHEDULED_QUEUE_AGE), now, MESSAGE));
            if (failed != null && failed > 0) {
                log.warn("[TrendResearchStuck] Chốt FAILED {} phiên nghiên cứu kẹt", failed);
            }
        } catch (Exception e) {
            log.error("[TrendResearchStuck] Vòng quét phiên kẹt lỗi: {}", e.getMessage(), e);
        }
    }
}
