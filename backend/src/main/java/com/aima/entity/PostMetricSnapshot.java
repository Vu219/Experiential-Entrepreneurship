package com.aima.entity;

import com.aima.enums.MetricSource;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * Số liệu TÍCH LUỸ của một bài tại thời điểm đồng bộ (append-only). Cột metric dùng chung mọi nền tảng,
 * null = nền tảng không cung cấp / chưa có quyền (khác 0). Metric riêng của nền tảng nằm trong {@code raw}.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "post_metric_snapshots")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PostMetricSnapshot extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "platform_media_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    PlatformMedia platformMedia;

    @Column(name = "collected_at", nullable = false)
    Instant collectedAt;

    @Column(name = "views")
    Long views;

    @Column(name = "reach")
    Long reach;

    /** Tổng mọi loại cảm xúc (FB) / lượt thích (IG, Threads). */
    @Column(name = "reactions")
    Long reactions;

    @Column(name = "comments")
    Long comments;

    @Column(name = "shares")
    Long shares;

    @Column(name = "saves")
    Long saves;

    /** Phản hồi gốc của nền tảng (JSON) — để tính lại khi Meta đổi định nghĩa metric. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw", columnDefinition = "jsonb")
    String raw;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 10)
    MetricSource source;
}
