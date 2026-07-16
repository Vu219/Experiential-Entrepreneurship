package com.aima.dto.response;

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
public class AiModelResponse {

    UUID id;

    UUID providerId;

    String providerCode;

    String modelCode;

    String displayName;

    Boolean enabled;

    BigDecimal inputPricePer1m;

    BigDecimal outputPricePer1m;
}
