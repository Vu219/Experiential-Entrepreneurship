package com.aima.scheduler;

import com.aima.repository.SubscriptionRepository;
import com.aima.service.SubscriptionService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Hạ về gói Free các subscription đã hết hạn — chạy 00:05 mỗi ngày.
 *
 * <p><b>Đây là đường DỰ PHÒNG, không phải đường duy nhất.</b> Việc hạ gói còn được kiểm ngay
 * trong {@code SubscriptionService.getOrCreate}, tức mọi lần {@code checkQuota} chạy. Hai đường
 * cố ý làm trùng nhau: chỉ dựa vào cron thì một lần scheduler không chạy (restart, deploy) là
 * user tiếp tục xài hạn mức của gói đã hết hạn tới tận hôm sau; chỉ dựa vào lazy thì user không
 * đăng nhập sẽ không bao giờ được hạ và báo cáo quản trị sai số.</p>
 *
 * <p>Mỗi subscription là MỘT transaction ngắn riêng, gọi qua proxy của {@code SubscriptionService}
 * (bean khác) — một bản ghi hỏng chỉ bị log rồi bỏ qua, không kéo đổ cả vòng quét (rule #27).</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SubscriptionExpiryJob {

    SubscriptionRepository subscriptionRepository;
    SubscriptionService subscriptionService;

    @Scheduled(cron = "${payment.plan-expiry-cron:0 5 0 * * *}")
    public void run() {
        LocalDateTime now = LocalDateTime.now();
        List<UUID> ids;
        try {
            ids = subscriptionRepository.findExpiredPlanIds(now);
        } catch (Exception e) {
            log.error("[SubscriptionExpiry] Không đọc được danh sách gói hết hạn: {}", e.getMessage(), e);
            return;
        }
        if (ids.isEmpty()) {
            return;
        }

        int downgraded = 0;
        for (UUID id : ids) {
            try {
                if (subscriptionService.expireToFreePlan(id, now)) {
                    downgraded++;
                }
            } catch (Exception e) {
                log.warn("[SubscriptionExpiry] Hạ gói cho subscription {} lỗi: {}", id, e.getMessage());
            }
        }
        log.info("[SubscriptionExpiry] {} gói hết hạn — đã hạ về Free {}", ids.size(), downgraded);
    }
}
