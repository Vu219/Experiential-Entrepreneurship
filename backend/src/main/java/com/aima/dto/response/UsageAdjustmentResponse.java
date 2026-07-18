package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/** Một bản ghi điều chỉnh usage (GRANT/RESET) — lịch sử/audit ở modal chi tiết user. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UsageAdjustmentResponse {

    UUID id;

    /** GRANT / RESET. */
    String type;

    /** ADMIN_GRANT / PURCHASE / PROMO. */
    String source;

    /** Số token cấp thêm (GRANT); null với RESET. */
    Long deltaTokens;

    String reason;

    /** Admin thao tác; null = hệ thống. */
    String actorEmail;

    String billingPeriod;

    LocalDateTime createdAt;
}
