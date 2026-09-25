package com.aima.entity;

import com.aima.enums.DurationUnit;
import com.aima.enums.PlanSource;
import com.aima.enums.SubscriptionChangeCategory;
import com.aima.enums.SubscriptionHistoryAction;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Lịch sử thay đổi gói của một user — APPEND-ONLY, không sửa/xoá (ngoài purge GDPR theo User).
 * Ghi ĐỒNG BỘ trong cùng transaction với việc đổi {@code subscriptions}, khác
 * {@code activity_logs} (bất đồng bộ, best-effort) — đây là nguồn audit "ai tặng gì, khi nào,
 * vì sao".
 *
 * <p>Gói lưu dạng MÃ (snapshot) chứ không FK tới {@code plans}: gói bị xoá mềm/đổi tên sau này
 * không làm sai lịch sử. Actor cũng chỉ lưu id + email snapshot, KHÔNG FK — xoá cứng tài khoản
 * admin không được làm vỡ lịch sử của user khác.</p>
 */
@Entity
@Table(name = "subscription_history", indexes = {
        @Index(name = "idx_subscription_history_user_created", columnList = "user_id, created_at")
})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SubscriptionHistory extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 30)
    SubscriptionHistoryAction action;

    /** Nhãn phân loại — chỉ có với thao tác admin; null với sự kiện tự động. */
    @Enumerated(EnumType.STRING)
    @Column(name = "category", length = 20)
    SubscriptionChangeCategory category;

    @Column(name = "from_plan_code", length = 50)
    String fromPlanCode;

    @Column(name = "to_plan_code", length = 50)
    String toPlanCode;

    /** null = không hết hạn (Free hoặc cấp vĩnh viễn). */
    @Column(name = "from_expires_at")
    LocalDateTime fromExpiresAt;

    @Column(name = "to_expires_at")
    LocalDateTime toExpiresAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_source", length = 20)
    PlanSource fromSource;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_source", length = 20)
    PlanSource toSource;

    /** Thời hạn admin nhập (gia hạn / đổi gói). null khi không áp dụng. */
    @Column(name = "extend_amount")
    Integer extendAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "extend_unit", length = 10)
    DurationUnit extendUnit;

    /** Admin thao tác. null = hệ thống (thanh toán, hết hạn). */
    @Column(name = "actor_user_id")
    UUID actorUserId;

    @Column(name = "actor_email", length = 255)
    String actorEmail;

    @Column(name = "reason", length = 500)
    String reason;
}
