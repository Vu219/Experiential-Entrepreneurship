package com.aima.config.init;

import com.aima.config.AiConfigProperties;
import com.aima.service.AiModelProbeService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Deploy xong → "Kiểm tra model" mọi model đang định tuyến, chạy NỀN (không chặn khởi động): model đã bị provider gỡ
 * (404) bị cho nghỉ UNAVAILABLE + báo admin ngay, thay vì đợi người dùng đầu tiên tạo nội dung thất bại.
 * Chỉ khi {@code ai-config.from-db=true} và {@code ai-config.probe-on-startup=true}. Best-effort: lỗi chỉ log.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AiModelProbeOnStartup {

    AiConfigProperties properties;
    AiModelProbeService probeService;

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        if (!properties.fromDb() || !properties.probeOnStartup()) {
            return;
        }
        Thread.ofVirtual().name("ai-model-probe").start(() -> {
            try {
                probeService.probeRoutedModels();
            } catch (Exception e) {
                log.warn("[AiModelProbe] Kiểm tra model lúc khởi động thất bại (bỏ qua): {}", e.getMessage());
            }
        });
    }
}
