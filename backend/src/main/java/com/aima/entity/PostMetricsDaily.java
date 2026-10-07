package com.aima.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

/**
 * Số PHÁT SINH trong một ngày (giờ Việt Nam) của một bài — tính lại toàn bộ từ chuỗi snapshot mỗi lần có
 * snapshot mới ({@code AnalyticsSyncService}). {@code estimated} = có phần được chia đều từ một khoảng
 * nhiều ngày giữa hai snapshot. Unique (platform_media_id, metric_date) trong V7.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "post_metrics_daily")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PostMetricsDaily extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "platform_media_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    PlatformMedia platformMedia;

    @Column(name = "metric_date", nullable = false)
    LocalDate metricDate;

    @Column(name = "views_delta", nullable = false)
    long viewsDelta;

    @Column(name = "reactions_delta", nullable = false)
    long reactionsDelta;

    @Column(name = "comments_delta", nullable = false)
    long commentsDelta;

    @Column(name = "shares_delta", nullable = false)
    long sharesDelta;

    @Column(name = "saves_delta", nullable = false)
    long savesDelta;

    @Column(name = "is_estimated", nullable = false)
    boolean estimated;
}
