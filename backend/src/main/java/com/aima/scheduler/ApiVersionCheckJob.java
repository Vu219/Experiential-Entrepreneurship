package com.aima.scheduler;

import com.aima.service.PlatformVersionService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Kiểm tra version API mới hàng tuần (Thứ Hai 03:00). Cập nhật latestVersion/status cho từng nền tảng.
 * Có thể trigger thủ công qua admin endpoint {@code POST /admin/api-versions/check-now}.
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class ApiVersionCheckJob {

    PlatformVersionService versionService;

    @Scheduled(cron = "0 0 3 * * MON")
    public void run() {
        try {
            log.info("[ApiVersionCheck] Bắt đầu kiểm tra version API hàng tuần...");
            versionService.runVersionCheck();
        } catch (Exception e) {
            log.error("[ApiVersionCheck] Kiểm tra version thất bại", e);
        }
    }
}
