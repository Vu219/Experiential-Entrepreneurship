package com.aima.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiModelCreateRequest {

    @NotNull(message = "AI_MODEL_PROVIDER_REQUIRED")
    UUID providerId;

    /** Model ID gửi sang AI service, vd "claude-sonnet-4-6". */
    @NotBlank(message = "AI_MODEL_CODE_REQUIRED")
    String modelCode;

    String displayName;

    /** null = bật (mặc định). */
    Boolean enabled;

    BigDecimal inputPricePer1m;

    BigDecimal outputPricePer1m;
}
