package com.aima.entity;

import com.aima.enums.MediaOrigin;
import com.aima.enums.MetricsSyncStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformMediaStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Một bài trên nền tảng mà AIMA theo dõi số liệu (docs/analytics-real-data-plan.md). Giai đoạn 0 chỉ dùng
 * trạng thái đồng bộ: {@code AnalyticsCollectionJob} bỏ qua dòng {@code STOPPED} hoặc chưa tới
 * {@code nextSyncAt}. Unique (tài khoản, id nền tảng) và (post_id) là index một phần trong V6.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "platform_media")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PlatformMedia extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "platform_account_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    PlatformAccount platformAccount;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform_name", nullable = false, length = 20)
    Platform platformName;

    @Column(name = "platform_media_id", nullable = false, length = 255)
    String platformMediaId;

    /** Bài AIMA tương ứng; null với bài người dùng tự đăng ngoài AIMA (giai đoạn 2, origin = EXTERNAL). */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    Post post;

    @Enumerated(EnumType.STRING)
    @Column(name = "origin", nullable = false, length = 10)
    MediaOrigin origin;

    @Column(name = "published_at")
    Instant publishedAt;

    /** Loại nội dung theo nền tảng báo, chuẩn hoá IMAGE/VIDEO/TEXT/OTHER (V8). Bài AIMA dùng content_versions. */
    @Column(name = "media_type", length = 20)
    String mediaType;

    @Column(name = "permalink", length = 2048)
    String permalink;

    /** Trích đoạn caption cho bài ngoài AIMA (không có content_versions). */
    @Column(name = "caption_excerpt", length = 300)
    String captionExcerpt;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform_status", nullable = false, length = 20)
    PlatformMediaStatus platformStatus = PlatformMediaStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "sync_status", nullable = false, length = 20)
    MetricsSyncStatus syncStatus = MetricsSyncStatus.ACTIVE;

    /** Null = đến hạn ngay khi bài qua mốc; có giá trị = đang backoff sau lỗi. */
    @Column(name = "next_sync_at")
    Instant nextSyncAt;

    @Column(name = "last_synced_at")
    Instant lastSyncedAt;

    @Column(name = "consecutive_failures", nullable = false)
    int consecutiveFailures;

    /** Loại lỗi + mã Graph gốc, ví dụ "PERMISSION:200", "NOT_FOUND:100/33". */
    @Column(name = "last_error_code", length = 50)
    String lastErrorCode;

    @Column(name = "last_error_at")
    Instant lastErrorAt;
}
