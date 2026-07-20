package com.aima.entity;

import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;
import com.aima.enums.AiUsageStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Bản ghi token usage chi tiết theo từng lần gọi AI (task/provider/model) — nguồn cho trang
 * admin "Sử dụng & chi phí". Bổ sung cho {@code users.tokens_used} (tổng theo tháng,
 * TokenUsageService) chứ không thay thế. Append-only.
 */
@Entity
@Table(name = "ai_usage", indexes = {
        @Index(name = "idx_ai_usage_user", columnList = "user_id"),
        @Index(name = "idx_ai_usage_task_code", columnList = "task_code"),
        @Index(name = "idx_ai_usage_created_at", columnList = "created_at"),
        @Index(name = "idx_ai_usage_billing_period", columnList = "billing_period"),
        // Bảng nhật ký ở TRANG CHI TIẾT USER luôn lọc user_id rồi sắp theo thời gian giảm dần —
        // hai index rời ở trên không phục vụ được cùng lúc cả lọc lẫn sắp xếp.
        @Index(name = "idx_ai_usage_user_created", columnList = "user_id, created_at DESC")
})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiUsage extends BaseEntity {

    /** User sở hữu request. null = job hệ thống không gắn user. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "task_code", nullable = false, length = 40)
    AiTaskCode taskCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider_code", nullable = false, length = 30)
    AiProviderCode providerCode;

    @Column(name = "model_code", nullable = false, length = 100)
    String modelCode;

    /** Breakdown từ usage_metadata AI service; null ở bản ghi trước khi tách input/output. */
    @Column(name = "input_tokens")
    Long inputTokens;

    @Column(name = "output_tokens")
    Long outputTokens;

    /** Phần input đọc từ prompt cache (thuộc inputTokens); null khi provider không báo. */
    @Column(name = "cached_tokens")
    Long cachedTokens;

    @Column(name = "total_tokens", nullable = false)
    Long totalTokens;

    /** Chi phí ƯỚC TÍNH (USD) theo đơn giá trên ai_models tại thời điểm ghi. */
    @Column(name = "estimated_cost", precision = 14, scale = 6)
    BigDecimal estimatedCost;

    /**
     * Kỳ tính usage ("yyyy-MM") chốt lúc ghi — nguồn gộp theo kỳ cho trang usage
     * user/admin (đối chiếu hạn mức Plan.monthlyTokenLimit). null ở các bản ghi
     * trước khi thêm cột.
     */
    @Column(name = "billing_period", length = 7)
    String billingPeriod;

    /** null (row cũ) = SUCCESS — coalesce ở tầng query, không backfill. */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 10)
    AiUsageStatus status;

    /** Thời gian cuộc gọi AI (ms), đo quanh HTTP call. null ở row cũ. */
    @Column(name = "latency_ms")
    Long latencyMs;

    /**
     * Token quy đổi TRỪ VÀO HẠN MỨC (đã nhân hệ số billing_rates, chốt lúc ghi).
     * Row cũ null → đọc coalesce(billable_units, total_tokens). Row ERROR/TIMEOUT = 0
     * (không trừ hạn mức cho request lỗi).
     */
    @Column(name = "billable_units")
    Long billableUnits;

    /**
     * Phần billable_units được trả bằng TOKEN MUA THÊM (token_credits) — chỉ > 0 khi kỳ đã
     * vượt hạn mức gói. planUsed = SUM(billable) − SUM(credit_units) − SUM(GRANT).
     * Tổng tiêu thụ thật = planUsed + SUM(credit_units). null ở row cũ = 0.
     */
    @Column(name = "credit_units")
    Long creditUnits;

    /**
     * Phần vượt hạn mức mà credit KHÔNG đủ trả (event đã gọi AI xong — cho phép âm, không
     * rollback; lần checkQuota sau chặn). Tổng theo kỳ = lượng "rò" qua chỗ chặn.
     */
    @Column(name = "credit_shortfall")
    Long creditShortfall;

    /** Mã gói của user tại thời điểm gọi (nhãn User.plan) — soi lại lịch sử khi user đổi gói. */
    @Column(name = "plan_at_time", length = 20)
    String planAtTime;

    /** Id job/session phát sinh cuộc gọi (correlation với bảng job). null = ngoài luồng job. */
    @Column(name = "request_id")
    UUID requestId;

    /** IP/User-Agent chốt lúc user TẠO job (copy từ bảng job) — null với job hệ thống. */
    @Column(name = "client_ip", length = 45)
    String clientIp;

    @Column(name = "user_agent", length = 300)
    String userAgent;

    /**
     * Chống double-count: "{requestId}:{taskCode}[:{label}]" — unique partial index
     * (UsageDataInitializer). Chỉ set ở event SUCCESS; event lỗi ghi mỗi lần thử một dòng.
     */
    @Column(name = "idempotency_key", length = 120)
    String idempotencyKey;
}
