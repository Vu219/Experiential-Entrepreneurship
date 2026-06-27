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

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Lấy mẫu ~10% kết nối ACTIVE mỗi 6 giờ và ping /me; đặt REVOKED nếu nền tảng từ chối (401/190).
 * Resilient: lỗi từng kết nối không ảnh hưởng các kết nối khác.
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class TokenValidationJob {

    PlatformAccountRepository accountRepository;
    MetaOAuthService metaOAuthService;

    @Scheduled(cron = "0 0 */6 * * *")
    public void run() {
        List<PlatformAccount> active = new ArrayList<>(
                accountRepository.findByConnectionStatusAndDeletedAtIsNull(ConnectionStatus.ACTIVE));
        if (active.isEmpty()) {
            return;
        }
        Collections.shuffle(active);
        int sampleSize = Math.max(1, (int) Math.ceil(active.size() * 0.10));
        List<PlatformAccount> sample = active.subList(0, Math.min(sampleSize, active.size()));

        log.info("[TokenValidation] Kiểm tra mẫu {}/{} kết nối ACTIVE.", sample.size(), active.size());
        for (PlatformAccount account : sample) {
            try {
                metaOAuthService.validate(account);
            } catch (Exception e) {
                log.warn("[TokenValidation] Validate {} lỗi: {}", account.getId(), e.getMessage());
            }
        }
    }
}
