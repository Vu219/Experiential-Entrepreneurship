package com.aima.scheduler;

import com.aima.entity.PlatformAccount;
import com.aima.enums.ConnectionStatus;
import com.aima.repository.PlatformAccountRepository;
import com.aima.service.MetaOAuthService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
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
    MetaOAuthService metaOAuthService;

    @Scheduled(cron = "0 0 2 * * *")
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
                metaOAuthService.refresh(account);
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
        } catch (Exception e) {
            log.error("[TokenHealthCheck] Không thể đánh dấu EXPIRED cho {}", account.getId(), e);
        }
    }
}
