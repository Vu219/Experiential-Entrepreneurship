package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

/** Tổng token/chi phí ước tính của MỘT model trong tháng. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiUsageByModelResponse {

    String providerCode;

    String modelCode;

    Long totalTokens;

    BigDecimal estimatedCost;
}
