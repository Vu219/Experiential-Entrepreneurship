package com.aima.scheduler;

import com.aima.exception.ErrorCode;
import com.aima.repository.ContentFormattingJobRepository;
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
 * Chốt FAILED (thông điệp {@code AI_TIMEOUT}) các job định dạng kẹt ở PENDING/RUNNING — quét mỗi phút,
 * cùng mẫu {@link ContentGenerationStuckJob}.
 *
 * <p>Ngưỡng 15 phút (dài hơn job tạo nội dung): worker gọi AI tuần tự TỪNG nền tảng (tối đa 3 × ~100s) mà
 * {@code updatedAt} của job chỉ đổi lúc chốt RUNNING. Không chốt thì chống trùng theo (bài, nền tảng) trả mãi
 * job chết và giới hạn tác vụ AI song song của user bị chiếm chỗ vĩnh viễn.</p>
 *
 * <p>Worker về muộn sau khi bị chốt vẫn ghi đè SUCCESS — kết quả không mất; job còn trong hàng đợi executor thì
 * worker thấy không còn PENDING và bỏ qua.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ContentFormattingStuckJob {

    static final Duration STUCK_AGE = Duration.ofMinutes(15);

    ContentFormattingJobRepository jobRepository;
    TransactionTemplate transactionTemplate;

    @Scheduled(fixedDelay = 60_000)
    @SchedulerLock(name = "content-formatting-stuck", lockAtMostFor = "PT5M", lockAtLeastFor = "PT20S")
    public void run() {
        try {
            LocalDateTime now = LocalDateTime.now();
            Integer failed = transactionTemplate.execute(status -> jobRepository.failStuckJobs(
                    now.minus(STUCK_AGE), now, ErrorCode.AI_TIMEOUT.getMessage()));
            if (failed != null && failed > 0) {
                log.warn("[ContentFormattingStuck] Chốt FAILED/AI_TIMEOUT {} job kẹt quá {} phút",
                        failed, STUCK_AGE.toMinutes());
            }
        } catch (Exception e) {
            log.error("[ContentFormattingStuck] Vòng quét job kẹt lỗi: {}", e.getMessage(), e);
        }
    }
}
