package com.aima.dto.response;

import com.aima.enums.DurationUnit;
import com.aima.enums.PlanSource;
import com.aima.enums.SubscriptionChangeCategory;
import com.aima.enums.SubscriptionHistoryAction;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/** Một dòng lịch sử gói. {@code actorEmail} null = hệ thống (thanh toán / hết hạn). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SubscriptionHistoryResponse {
    UUID id;
    SubscriptionHistoryAction action;
    SubscriptionChangeCategory category;
    String fromPlanCode;
    String toPlanCode;
    LocalDateTime fromExpiresAt;
    LocalDateTime toExpiresAt;
    PlanSource fromSource;
    PlanSource toSource;
    Integer extendAmount;
    DurationUnit extendUnit;
    String actorEmail;
    String reason;
    LocalDateTime createdAt;
}
