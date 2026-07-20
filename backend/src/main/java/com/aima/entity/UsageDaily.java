package com.aima.entity;

import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Rollup THEO NGÀY của event log {@code ai_usage} — cùng quy ước với {@link UsageHourly}
 * ({@code dayBucket} theo GIỜ VIỆT NAM; userId UUID trần; latency loại NULL). Là ĐIỀU KIỆN
 * purge retention: {@code LogRetentionJob} chỉ xoá event thô của những ngày ĐÃ có row ở
 * đây (rollup chết âm thầm thì dữ liệu thô được giữ lại, không mất vĩnh viễn).
 */
@Entity
@Table(name = "usage_daily", indexes = {
        @Index(name = "idx_usage_daily_bucket", columnList = "day_bucket"),
        @Index(name = "idx_usage_daily_user_bucket", columnList = "user_id, day_bucket")
})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UsageDaily extends BaseEntity {

    @Column(name = "day_bucket", nullable = false)
    LocalDateTime dayBucket;

    /** null = event hệ thống không gắn user. */
    @Column(name = "user_id")
    UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "task_code", nullable = false, length = 40)
    AiTaskCode taskCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider_code", nullable = false, length = 30)
    AiProviderCode providerCode;

    @Column(name = "model_code", nullable = false, length = 100)
    String modelCode;

    @Column(name = "requests", nullable = false)
    Long requests;

    @Column(name = "errors", nullable = false)
    Long errors;

    @Column(name = "total_tokens")
    Long totalTokens;

    @Column(name = "billable_units")
    Long billableUnits;

    @Column(name = "credit_units")
    Long creditUnits;

    @Column(name = "cost_usd", precision = 14, scale = 6)
    BigDecimal costUsd;

    @Column(name = "latency_sum_ms")
    Long latencySumMs;

    @Column(name = "latency_count")
    Long latencyCount;
}
