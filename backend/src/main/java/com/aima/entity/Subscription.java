package com.aima.entity;

import com.aima.enums.PlanSource;
import com.aima.enums.SubscriptionStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * Gói đăng ký hiện hành của một user — NGUỒN SỰ THẬT về gói + chu kỳ tính usage
 * (billing period). {@code User.plan} chỉ còn là nhãn cache đồng bộ theo đây.
 * Mỗi user một bản ghi active (đảm bảo bằng logic {@code SubscriptionService.getOrCreate}
 * + seed {@code SubscriptionDataInitializer}); đổi gói tái sử dụng bản ghi, không tạo mới.
 * Chu kỳ hiện tại = tháng lịch ({@code currentPeriodStart}/{@code currentPeriodEnd} —
 * end là mốc reset, exclusive); thiết kế mở cho chu kỳ khác khi gắn thanh toán (pha sau,
 * payment chỉ stub).
 */
@Entity
@Table(name = "subscriptions", indexes = {
        @Index(name = "idx_subscriptions_user", columnList = "user_id")
})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Subscription extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    Plan plan;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    SubscriptionStatus status = SubscriptionStatus.ACTIVE;

    /**
     * Mốc bắt đầu gói TRẢ TIỀN hiện hành. null = gói Free (không có vòng đời).
     *
     * <p><b>Đừng nhầm với {@link #currentPeriodStart}.</b> Cặp {@code currentPeriod*} là KỲ
     * TÍNH HẠN MỨC TOKEN (tháng lịch, reset đều đặn); cặp {@code planStartedAt}/
     * {@link #planExpiresAt} là VÒNG ĐỜI GÓI đã mua (ngày mua → ngày hết hạn). Hai khái niệm
     * độc lập: một user mua gói ngày 20/9 vẫn reset token vào 01/10 như mọi người.
     */
    @Column(name = "plan_started_at")
    LocalDateTime planStartedAt;

    /**
     * Mốc hết hạn gói trả tiền — cột mà job hạ gói quét. <b>null = KHÔNG hết hạn</b> (gói Free,
     * hoặc gói admin cấp vĩnh viễn), không phải "hết hạn ngay".
     */
    @Column(name = "plan_expires_at")
    LocalDateTime planExpiresAt;

    /**
     * Vì sao user đang ở gói này — phân biệt khách trả tiền với gói admin cấp tay.
     * {@code columnDefinition} có DEFAULT vì {@code subscriptions} đã có dữ liệu: xem lý do
     * đầy đủ ở {@code Payment.expiryGraceCount}.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "plan_source", nullable = false, length = 20,
            columnDefinition = "varchar(20) not null default 'FREE'")
    @Builder.Default
    PlanSource planSource = PlanSource.FREE;

    /** Đầu kỳ hiện tại (inclusive). */
    @Column(name = "current_period_start", nullable = false)
    LocalDateTime currentPeriodStart;

    /** Cuối kỳ hiện tại (exclusive) — chính là mốc reset usage hiển thị cho user. */
    @Column(name = "current_period_end", nullable = false)
    LocalDateTime currentPeriodEnd;
}
