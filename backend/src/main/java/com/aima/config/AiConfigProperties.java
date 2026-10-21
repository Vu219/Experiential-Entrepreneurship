package com.aima.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Cấu hình AI theo DB (provider/model/routing do admin quản lý).
 * Map từ block {@code ai-config.*} trong application.yml.
 *
 * <p>{@code fromDb} = feature flag rollback: false (mặc định) → payload gửi AI service
 * KHÔNG kèm llm_config, AI service chạy bằng env của nó như trước — hành vi không đổi.</p>
 */
@ConfigurationProperties(prefix = "ai-config")
public record AiConfigProperties(
        boolean fromDb,
        // "Kiểm tra model" (generateContent tối thiểu) cho các model đang định tuyến khi backend khởi động — chỉ khi
        // fromDb. Thiếu property (vd test) = false.
        boolean probeOnStartup,
        // @DefaultValue: không có property ai-config.seed.* (vd môi trường test) vẫn
        // khởi tạo record rỗng thay vì null — initializer không phải null-check.
        @DefaultValue Seed seed
) {
    /** Giá trị seed 1 lần từ env (copy từ ai/.env) — chỉ áp khi TẠO MỚI row, không ghi đè. */
    public record Seed(
            String anthropicApiKey,
            String anthropicModel,
            String googleApiKey,
            String googleModel
    ) {
    }
}
