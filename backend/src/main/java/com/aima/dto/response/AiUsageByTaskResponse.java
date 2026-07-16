package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

/** Tổng token/chi phí ước tính của MỘT nghiệp vụ trong tháng. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiUsageByTaskResponse {

    String taskCode;

    Long totalTokens;

    BigDecimal estimatedCost;
}
