package com.aima.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Performance metrics collected for a {@link Post} (BR-09), gathered repeatedly.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
// Các truy vấn gộp lấy MỘT snapshot/bài bằng DISTINCT ON (post_id) ORDER BY milestone_hours DESC —
// index này khớp đúng thứ tự đó nên Postgres không phải sort lại. ddl-auto=update tự tạo khi thiếu.
@Table(name = "post_analytics", indexes = {
        @Index(name = "idx_post_analytics_post_milestone", columnList = "post_id, milestone_hours")
})
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PostAnalytics extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    Post post;

    @Column(name = "views")
    Long views;

    @Column(name = "likes")
    Long likes;

    @Column(name = "comments")
    Long comments;

    @Column(name = "shares")
    Long shares;

    @Column(name = "saves")
    Long saves;

    @Column(name = "ctr", precision = 7, scale = 4)
    BigDecimal ctr;

    @Column(name = "conversion", precision = 7, scale = 4)
    BigDecimal conversion;

    @Column(name = "watch_time")
    Long watchTime;

    // FR-59: mốc thu thập tính từ lúc đăng — 24 / 48 / 168 (7 ngày) giờ.
    @Column(name = "milestone_hours")
    Integer milestoneHours;

    @Column(name = "collected_at", nullable = false)
    LocalDateTime collectedAt;

    @OneToMany(mappedBy = "analytics", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    List<OptimizationInsight> optimizationInsights = new ArrayList<>();
}
