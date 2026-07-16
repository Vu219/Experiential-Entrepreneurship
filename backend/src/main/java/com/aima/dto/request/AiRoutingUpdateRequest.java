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

import java.util.UUID;

/**
 * Cập nhật định tuyến model cho một nghiệp vụ (PUT — thay TOÀN BỘ cấu hình của dòng routing:
 * fallbackModelId/temperature/maxTokens gửi null nghĩa là XÓA giá trị đó, không phải giữ nguyên).
 * taskCode bất biến.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiRoutingUpdateRequest {

    @NotNull(message = "AI_ROUTING_PRIMARY_MODEL_REQUIRED")
    UUID primaryModelId;

    /** null = không dùng fallback. */
    UUID fallbackModelId;

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
