package com.aima.scheduler;

import com.aima.repository.NotificationRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;

/**
 * Dọn thông báo cũ (D6) — 03:45 mỗi ngày: đã đọc > 90 ngày, mọi thông báo > 180 ngày, đã xoá mềm > 30 ngày (tính theo
 * {@code created_at} / {@code deleted_at}). <b>HARD DELETE</b> — ngoại lệ đã chốt của rule soft-delete: hộp thư
 * thông báo không phải dữ liệu nghiệp vụ cần khôi phục. Số ngày cấu hình qua {@code aima.retention.notification-*}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class NotificationRetentionJob {

    NotificationRepository notificationRepository;
    TransactionTemplate transactionTemplate;

    @NonFinal
    @Value("${aima.retention.notification-read-days:90}")
    int readDays;

    @NonFinal
    @Value("${aima.retention.notification-all-days:180}")
    int allDays;

    @NonFinal
    @Value("${aima.retention.notification-deleted-days:30}")
    int deletedDays;

    @Scheduled(cron = "0 45 3 * * *")
    @SchedulerLock(name = "notification-retention", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void run() {
        try {
            LocalDateTime now = LocalDateTime.now();
            Integer purged = transactionTemplate.execute(status -> notificationRepository.purgeExpired(
                    now.minusDays(readDays), now.minusDays(allDays), now.minusDays(deletedDays)));
            if (purged != null && purged > 0) {
                log.info("[NotificationRetention] Đã xoá {} thông báo cũ", purged);
            }
        } catch (Exception e) {
            log.error("[NotificationRetention] Dọn thông báo cũ lỗi: {}", e.getMessage(), e);
        }
    }
}
