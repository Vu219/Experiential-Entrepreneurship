package com.aima.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.UUID;

/**
 * Cập nhật định tuyến model cho một nghiệp vụ (PUT — thay TOÀN BỘ cấu hình của dòng routing:
 * temperature/maxTokens gửi null nghĩa là XÓA giá trị đó, không phải giữ nguyên).
 * Chuỗi dự phòng: {@code fallbackModelIds} (thứ tự = thứ tự thử); client cũ chỉ gửi
 * {@code fallbackModelId} vẫn chạy (chuỗi 1 model). taskCode bất biến.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiRoutingUpdateRequest {

    @NotNull(message = "AI_ROUTING_PRIMARY_MODEL_REQUIRED")
    UUID primaryModelId;

    /** LEGACY (client cũ): chỉ dùng khi {@code fallbackModelIds} = null. null = không dùng fallback. */
    UUID fallbackModelId;

    /**
     * Chuỗi model dự phòng theo thứ tự thử; [] = không dùng. Không trùng nhau, không chứa model
     * chính (AI_ROUTING_FALLBACK_INVALID), tối đa {@code MAX_FALLBACKS} model. null = đọc
     * {@code fallbackModelId}.
     */
    List<UUID> fallbackModelIds;

    /** null = dùng mặc định của provider. */
    @DecimalMin(value = "0.0", message = "AI_TEMPERATURE_INVALID")
    @DecimalMax(value = "2.0", message = "AI_TEMPERATURE_INVALID")
    Double temperature;

    /** null = dùng mặc định của AI service. */
    @Positive(message = "AI_MAX_TOKENS_INVALID")
    Integer maxTokens;

    @NotNull(message = "AI_ROUTING_ENABLED_REQUIRED")
    Boolean enabled;
}
