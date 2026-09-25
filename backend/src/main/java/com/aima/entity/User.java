package com.aima.entity;

import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class User extends BaseEntity {

    @Column(name = "user_name", nullable = false, unique = true)
    String username;

    @Column(name = "password")
    String password;

    @Column(name = "full_name", nullable = false, length = 100)
    String fullName;

    @Column(name = "email", nullable = false, unique = true)
    String email;

    @Column(name = "phone")
    String phone;

    @Column(name = "date_of_birth")
    LocalDate dateOfBirth;

    @Column(name = "provider", length = 20)
    String provider;

    @Column(name = "google_id", unique = true)
    String googleId;

    @ManyToOne
    @JoinColumn(name = "role_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    Role role;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    UserStatus status;

    // Nhãn gói (FR-80). columnDefinition default 'FREE' để ddl-auto=update thêm cột
    // NOT NULL vào bảng có sẵn dữ liệu mà không vỡ (các dòng cũ được backfill FREE).
    @Enumerated(EnumType.STRING)
    @Column(name = "plan", length = 20)
    @Builder.Default
    private UserPlan plan = UserPlan.FREE;

    // Token LLM đã dùng trong tháng tokenUsageMonth (quota theo Plan.monthlyTokenLimit).
    // Reset "lazy" đầu mỗi tháng: TokenUsageService so tokenUsageMonth ("yyyy-MM") với
    // tháng hiện tại — khác tháng thì coi như 0 (không cần scheduler reset).
    @Column(name = "tokens_used")
    @Builder.Default
    Long tokensUsed = 0L;

    @Column(name = "token_usage_month", length = 7)
    String tokenUsageMonth;

    @Column(name = "deletion_date")
    LocalDateTime deletionDate;

    // Đã gửi email cảnh báo "còn 7 ngày trước khi xóa" chưa (tránh gửi lặp mỗi ngày).
    @Column(name = "deletion_warning_sent_at")
    LocalDateTime deletionWarningSentAt;

    @Column(name = "avatar_url", length = 500)
    String avatarUrl;

    @Column(name = "last_active_at")
    LocalDateTime lastActiveAt;

    @Column(name = "last_password_change_at")
    LocalDateTime lastPasswordChangeAt;

    @Column(name = "profile_completed")
    Boolean profileCompleted;

    // Xóa user (purge sau 30 ngày) phải dọn theo dữ liệu phụ thuộc để không vi phạm khóa ngoại.
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    List<BrandProfile> brandProfiles = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    List<PlatformAccount> platformAccounts = new ArrayList<>();

    // Thông báo in-app tham chiếu user trực tiếp (không đi qua brand) — phải cascade để
    // xóa cứng tài khoản không vi phạm khóa ngoại.
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    List<Notification> notifications = new ArrayList<>();

    // Gói đăng ký + điều chỉnh usage token tham chiếu user trực tiếp — cascade để purge
    // GDPR không vi phạm khóa ngoại (cùng lý do notifications).
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    List<Subscription> subscriptions = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    List<UsageAdjustment> usageAdjustments = new ArrayList<>();

    // Lịch sử đổi gói — cùng lý do cascade như subscriptions (purge GDPR không vỡ FK).
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    List<SubscriptionHistory> subscriptionHistory = new ArrayList<>();
}
