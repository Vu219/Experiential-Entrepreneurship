package com.aima.scheduler;

import com.aima.service.UsageAlertService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Quét 9 rule cảnh báo bất thường usage mỗi 5 phút (pha 5A — alert-only, chưa tự chặn).
 * Logic detection + chống bão (upsert OPEN, cooldown sau ACK) nằm ở {@code UsageAlertService};
 * mỗi rule fail riêng chỉ log — không phá lượt quét (rule #27).
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UsageAlertJob {

    UsageAlertService usageAlertService;

    @Scheduled(fixedDelay = 5 * 60 * 1000, initialDelay = 3 * 60 * 1000)
    public void scan() {
        try {
            usageAlertService.runDetection();
        } catch (Exception e) {
            log.error("[UsageAlertJob] Lượt quét thất bại: {}", e.getMessage());
        }
    }
}
