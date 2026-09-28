package com.aima.scheduler;

import com.aima.entity.PlatformAccount;
import com.aima.entity.PostSchedule;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.NotificationType;
import com.aima.enums.ScheduleStatus;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.service.MetaOAuthService;
import com.aima.service.NotificationService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * FR-18a: tự làm mới token sắp hết hạn (trong 7 ngày tới). Nếu không refresh được → đánh dấu EXPIRED.
 * Chạy lúc 02:00 mỗi ngày. Resilient: mọi lỗi đều được nuốt + log, không làm crash app.
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class TokenHealthCheckJob {

    PlatformAccountRepository accountRepository;
    PostScheduleRepository scheduleRepository;
    MetaOAuthService metaOAuthService;
    NotificationService notificationService;

    @Scheduled(cron = "0 0 2 * * *")
    @SchedulerLock(name = "token-health-check", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void run() {
        LocalDateTime now = LocalDateTime.now();
        List<PlatformAccount> expiring = accountRepository
                .findByConnectionStatusAndTokenExpiredAtBetweenAndDeletedAtIsNull(
                        ConnectionStatus.ACTIVE, now, now.plusDays(7));

        if (expiring.isEmpty()) {
            log.info("[TokenHealthCheck] Không có token nào sắp hết hạn.");
            return;
        }
        log.info("[TokenHealthCheck] {} token sắp hết hạn, đang xử lý...", expiring.size());

        for (PlatformAccount account : expiring) {
            try {
                metaOAuthService.refresh(account.getId());
                log.info("[TokenHealthCheck] Đã refresh token kết nối {}", account.getId());
            } catch (Exception e) {
                log.warn("[TokenHealthCheck] Refresh thất bại cho {} -> EXPIRED: {}", account.getId(), e.getMessage());
                markExpired(account);
            }
        }
    }

    private void markExpired(PlatformAccount account) {
        try {
            account.setConnectionStatus(ConnectionStatus.EXPIRED);
            accountRepository.save(account);

            // FR-18b: bài SCHEDULED của tài khoản hết hạn → ON_HOLD chờ user kết nối lại.
            List<PostSchedule> waiting = scheduleRepository
                    .findByPlatformAccount_IdAndStatusAndDeletedAtIsNull(account.getId(), ScheduleStatus.SCHEDULED);
            waiting.forEach(s -> s.setStatus(ScheduleStatus.ON_HOLD));
            scheduleRepository.saveAll(waiting);

            // FR-78: nhắc kết nối lại.
            notificationService.notify(account.getUser(), NotificationType.RECONNECT_NEEDED,
                    "Cần kết nối lại tài khoản",
                    "Token của " + account.getAccountName() + " trên " + account.getPlatformName()
                            + " đã hết hạn — " + (waiting.isEmpty() ? "" : waiting.size() + " bài đã lên lịch được tạm giữ (On Hold). ")
                            + "Vui lòng kết nối lại trong phần Cài đặt.",
                    account.getId());
        } catch (Exception e) {
            log.error("[TokenHealthCheck] Không thể đánh dấu EXPIRED cho {}", account.getId(), e);
        }
    }
}
