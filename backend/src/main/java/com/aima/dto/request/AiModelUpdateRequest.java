package com.aima.dto.request;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

/** Cập nhật một AI model (partial — field null = giữ nguyên; modelCode/provider bất biến). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiModelUpdateRequest {

    String displayName;

    Boolean enabled;

    BigDecimal inputPricePer1m;

    BigDecimal outputPricePer1m;
}
