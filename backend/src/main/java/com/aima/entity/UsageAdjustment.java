package com.aima.entity;

import com.aima.enums.UsageAdjustmentSource;
import com.aima.enums.UsageAdjustmentType;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/**
 * Điều chỉnh usage token của một user trong một kỳ — kiêm luôn AUDIT LOG cho thao tác
 * admin cấp thêm token / reset thủ công (pha admin per-user). Append-only, không sửa/xóa.
 * Mức dùng hiệu lực = SUM(ai_usage trong kỳ, sau mốc RESET gần nhất) − SUM(GRANT).
 */
@Entity
@Table(name = "usage_adjustments", indexes = {
        @Index(name = "idx_usage_adjustments_user", columnList = "user_id"),
        @Index(name = "idx_usage_adjustments_created_at", columnList = "created_at")
})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UsageAdjustment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User user;

    /** Admin thực hiện thao tác. null = hệ thống (vd PROMO tự động sau này). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_user_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User actor;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 10)
    UsageAdjustmentType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20)
    @Builder.Default
    UsageAdjustmentSource source = UsageAdjustmentSource.ADMIN_GRANT;

    /** Số token cấp thêm (GRANT). null với RESET. */
    @Column(name = "delta_tokens")
    Long deltaTokens;

    @Column(name = "reason", length = 500)
    String reason;

    /** Kỳ áp dụng ("yyyy-MM") — chốt lúc ghi, khớp {@code AiUsage.billingPeriod}. */
    @Column(name = "billing_period", nullable = false, length = 7)
    String billingPeriod;

    /** Tham chiếu thanh toán khi source = PURCHASE — stub, chưa có bảng payment (pha sau). */
    @Column(name = "payment_id")
    UUID paymentId;
}
