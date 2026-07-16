package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Một bản ghi ai_usage (một lần gọi AI) — trang admin "Sử dụng & chi phí". */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiUsageResponse {

    UUID id;

    /** Email user sở hữu request; null = job hệ thống. */
    String userEmail;

    String taskCode;

    String providerCode;

    String modelCode;

    Long totalTokens;

    BigDecimal estimatedCost;

    LocalDateTime createdAt;
}
