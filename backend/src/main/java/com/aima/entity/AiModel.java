package com.aima.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Một model của một AI provider (vd claude-sonnet-4-6, gemini-2.5-pro) — catalog cho
 * trang admin "Model & định tuyến". Unique theo (provider, model_code) qua partial index
 * {@code uk_ai_models_provider_model} (WHERE deleted_at IS NULL, tạo ở AiConfigDataInitializer).
 */
@Entity
@Table(name = "ai_models", indexes = {
        @Index(name = "idx_ai_models_provider_model", columnList = "provider_id, model_code")
})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiModel extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    AiProvider provider;

    /** Model ID gửi sang AI service, vd "claude-sonnet-4-6"; không đổi sau khi tạo. */
    @Column(name = "model_code", nullable = false, length = 100, updatable = false)
    String modelCode;

    @Column(name = "display_name", length = 150)
    String displayName;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    Boolean enabled = true;

    /** Đơn giá USD / 1M token input — chỉ để ƯỚC TÍNH chi phí ở trang "Sử dụng & chi phí". */
    @Column(name = "input_price_per_1m", precision = 12, scale = 4)
    BigDecimal inputPricePer1m;

    /** Đơn giá USD / 1M token output — chỉ để ƯỚC TÍNH chi phí. */
    @Column(name = "output_price_per_1m", precision = 12, scale = 4)
    BigDecimal outputPricePer1m;

    /**
     * Trần tham số max_tokens của model (metadata tham khảo, auto-fill từ catalog provider,
     * admin ghi đè được). Chỉ dùng để CẢNH BÁO khi routing đặt max_tokens vượt trần —
     * không chặn cứng (trần có thể thay đổi). null = không rõ, bỏ qua cảnh báo.
     */
    @Column(name = "max_tokens")
    Integer maxTokens;

    /**
     * Kết quả lần "Kiểm tra model" gần nhất (generateContent tối thiểu qua AI service /probe-models):
     * "ok" hoặc loại lỗi ("model_not_found", "provider_overloaded"…). null = chưa kiểm tra.
     */
    @Column(name = "last_probe_status", length = 40)
    String lastProbeStatus;

    @Column(name = "last_probed_at")
    LocalDateTime lastProbedAt;
}
