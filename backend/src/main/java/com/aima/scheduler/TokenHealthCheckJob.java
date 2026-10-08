package com.aima.scheduler;

import com.aima.entity.PlatformAccount;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.HoldReason;
import com.aima.enums.NotificationType;
import com.aima.repository.PlatformAccountRepository;
import com.aima.service.MetaOAuthService;
import com.aima.service.NotificationService;
import com.aima.service.ScheduleHoldService;
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
 * FR-18a: tự làm mới token sắp hết hạn (trong 7 ngày tới). Chỉ đánh dấu EXPIRED khi token thật sự chết
 * (Graph 190 — {@link MetaOAuthService#refresh} tự xử lý) hoặc đã quá {@code tokenExpiredAt}; lỗi tạm thời
 * (timeout, 5xx, rate limit) chỉ log, lượt chạy sau thử lại.
 * Chạy lúc 02:00 mỗi ngày. Resilient: mọi lỗi đều được nuốt + log, không làm crash app.
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class TokenHealthCheckJob {

    PlatformAccountRepository accountRepository;
    ScheduleHoldService holdService;
    MetaOAuthService metaOAuthService;
    NotificationService notificationService;

    @Scheduled(cron = "0 0 2 * * *")
    @SchedulerLock(name = "token-health-check", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void run() {
        LocalDateTime now = LocalDateTime.now();
        List<PlatformAccount> expiring = accountRepository
                .findByConnectionStatusAndTokenExpiredAtLessThanEqualAndDeletedAtIsNull(
                        ConnectionStatus.ACTIVE, now.plusDays(7));

        if (expiring.isEmpty()) {
            log.info("[TokenHealthCheck] Không có token nào sắp hết hạn.");
            return;
        }
        log.info("[TokenHealthCheck] {} token sắp hết hạn, đang xử lý...", expiring.size());

        for (PlatformAccount account : expiring) {
            try {
                PlatformAccount refreshed = metaOAuthService.refresh(account.getId());
                if (refreshed.getConnectionStatus() == ConnectionStatus.ACTIVE) {
                    log.info("[TokenHealthCheck] Đã refresh token kết nối {}", account.getId());
                } else {
                    // Graph 190: refresh đã đánh dấu EXPIRED + tạm giữ lịch + nhắc kết nối lại.
                    log.warn("[TokenHealthCheck] Token kết nối {} không còn hợp lệ -> {}",
                            account.getId(), refreshed.getConnectionStatus());
                }
            } catch (Exception e) {
                if (account.getTokenExpiredAt() != null && !account.getTokenExpiredAt().isAfter(LocalDateTime.now())) {
                    log.warn("[TokenHealthCheck] Refresh thất bại và token {} đã quá hạn -> EXPIRED: {}",
                            account.getId(), e.getMessage());
                    markExpired(account);
                } else {
                    // Lỗi tạm thời (timeout/5xx/rate limit): giữ ACTIVE, lượt sau thử lại.
                    log.warn("[TokenHealthCheck] Refresh thất bại cho {} (thử lại lượt sau): {}",
                            account.getId(), e.getMessage());
                }
            }
        }
    }

    private void markExpired(PlatformAccount account) {
        try {
            account.setConnectionStatus(ConnectionStatus.EXPIRED);
            accountRepository.save(account);

            // FR-18b: bài SCHEDULED của tài khoản hết hạn → ON_HOLD chờ user kết nối lại.
            int held = holdService.holdForAccounts(List.of(account.getId()), HoldReason.ACCOUNT_ISSUE);

            // FR-78: nhắc kết nối lại.
            notificationService.notify(account.getUser(), NotificationType.RECONNECT_NEEDED,
                    "Cần kết nối lại tài khoản",
                    "Token của " + account.getAccountName() + " trên " + account.getPlatformName()
                            + " đã hết hạn — " + (held == 0 ? "" : held + " bài đã lên lịch được tạm giữ (On Hold). ")
                            + "Vui lòng kết nối lại trong phần Cài đặt.",
                    account.getId());
        } catch (Exception e) {
            log.error("[TokenHealthCheck] Không thể đánh dấu EXPIRED cho {}", account.getId(), e);
        }
    }
}
