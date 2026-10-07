package com.aima.entity;

import com.aima.enums.InstagramLinkStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Trạng thái đồng bộ CẤP TÀI KHOẢN của một kênh đăng (analytics giai đoạn 2, Flyway V8): quét danh sách bài
 * (import bài ngoài AIMA) + insights theo ngày + Trang có liên kết Instagram Business hay không.
 * {@code nextSyncAt} null = không tự đồng bộ; tài khoản chưa có dòng nào được coi là đến hạn ngay.
 * Unique (platform_account_id) là index một phần trong V8.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "account_sync_state")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AccountSyncState extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "platform_account_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    PlatformAccount platformAccount;

    @Column(name = "next_sync_at")
    Instant nextSyncAt;

    @Column(name = "last_synced_at")
    Instant lastSyncedAt;

    @Column(name = "consecutive_failures", nullable = false)
    int consecutiveFailures;

    /** Lỗi lần quét danh sách bài gần nhất ("PERMISSION:200"...); null = lần gần nhất thành công. */
    @Column(name = "posts_error_code", length = 50)
    String postsErrorCode;

    /** Lỗi lần lấy insights gần nhất; null = thành công (kể cả khi nền tảng trả rỗng). */
    @Column(name = "insights_error_code", length = 50)
    String insightsErrorCode;

    @Column(name = "last_error_at")
    Instant lastErrorAt;

    /** Chỉ Trang Facebook; null = chưa kiểm tra. */
    @Enumerated(EnumType.STRING)
    @Column(name = "instagram_link_status", length = 20)
    InstagramLinkStatus instagramLinkStatus;

    /** Trang đã đăng ký nhận webhook "feed" (subscribed_apps) lúc nào (V9); null = chưa / thất bại. */
    @Column(name = "webhook_subscribed_at")
    Instant webhookSubscribedAt;

    /** Lỗi lần đăng ký webhook gần nhất, vd "PERMISSION:200" khi thiếu pages_manage_metadata. */
    @Column(name = "webhook_error_code", length = 50)
    String webhookErrorCode;
}
