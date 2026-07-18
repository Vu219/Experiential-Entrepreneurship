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
 * Rollup THEO GIỜ của event log {@code ai_usage} — heatmap/biểu đồ admin đọc từ đây,
 * không query thẳng event. Ghi bởi {@code UsageRollupJob} (delete + insert theo bucket,
 * idempotent); KHÔNG ghi tay.
 * <p>
 * QUY ƯỚC TIMEZONE: {@code hourBucket} = date_trunc('hour', created_at) trên cột timestamp
 * lưu GIỜ VIỆT NAM (JDBC ghi LocalDateTime theo APP_TIMEZONE=Asia/Ho_Chi_Minh) — bucket
 * "03:00" nghĩa là 3h sáng giờ VN, đúng ngữ nghĩa heatmap "user hoạt động 3h sáng".
 * <p>
 * {@code userId} là cột UUID trần (không FK) — dữ liệu gộp thống kê, giữ được cả sau khi
 * user bị hard-delete (GDPR). {@code latencyCount} đếm event có latency ≠ NULL — trung bình
 * = latencySumMs / latencyCount, KHÔNG coalesce NULL về 0.
 */
@Entity
@Table(name = "usage_hourly", indexes = {
        @Index(name = "idx_usage_hourly_bucket", columnList = "hour_bucket"),
        @Index(name = "idx_usage_hourly_user_bucket", columnList = "user_id, hour_bucket")
})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UsageHourly extends BaseEntity {

    @Column(name = "hour_bucket", nullable = false)
    LocalDateTime hourBucket;

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

    /** Số event ERROR + TIMEOUT (tỉ lệ lỗi = errors / requests). */
    @Column(name = "errors", nullable = false)
    Long errors;

    @Column(name = "total_tokens")
    Long totalTokens;

    @Column(name = "billable_units")
    Long billableUnits;

    /** Phần trả bằng token mua thêm (tách token gói / token lẻ cho báo cáo doanh thu). */
    @Column(name = "credit_units")
    Long creditUnits;

    @Column(name = "cost_usd", precision = 14, scale = 6)
    BigDecimal costUsd;

    /** Tổng latency của các event CÓ latency (NULL bị loại, không coalesce 0). */
    @Column(name = "latency_sum_ms")
    Long latencySumMs;

    @Column(name = "latency_count")
    Long latencyCount;
}
