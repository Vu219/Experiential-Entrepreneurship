package com.aima.entity;

import com.aima.enums.Platform;
import com.aima.enums.SuitabilityLevel;
import com.aima.enums.TrendMomentum;
import com.aima.enums.TrendType;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * A trend discovered within a {@link TrendResearchSession}.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "trends")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Trend extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "research_session_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    TrendResearchSession researchSession;

    @Column(name = "trend_name", nullable = false, length = 255)
    String trendName;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 20)
    Platform platform;

    @Column(name = "relevance_score", precision = 5, scale = 2)
    BigDecimal relevanceScore;

    @Column(name = "description", columnDefinition = "text")
    String description;

    // Mức phù hợp High/Medium/Low do AI chấm (FR-21) — trước đây chỉ lưu điểm số.
    @Enumerated(EnumType.STRING)
    @Column(name = "relevance", length = 20)
    SuitabilityLevel relevance;

    @Enumerated(EnumType.STRING)
    @Column(name = "trend_type", length = 20)
    TrendType trendType;

    @Enumerated(EnumType.STRING)
    @Column(name = "momentum", length = 20)
    TrendMomentum momentum;

    // Hạn đăng để còn bắt kịp trend (sự kiện: ngày diễn ra) — null = không gấp.
    @Column(name = "act_by")
    LocalDate actBy;

    // Độ tin cậy theo số nguồn độc lập (AI tính bằng code, không do model tự chấm).
    @Enumerated(EnumType.STRING)
    @Column(name = "confidence", length = 20)
    SuitabilityLevel confidence;

    // JSON ["#a", ...] — đọc/ghi qua util/JsonColumns.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "hashtags", columnDefinition = "jsonb")
    String hashtags;

    // JSON [{title, url, source}] — nguồn bằng chứng thật (web/google_trends/calendar/...).
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "evidence", columnDefinition = "jsonb")
    String evidence;

    // Cùng lý do SQLRestriction ở TrendResearchSession.trends: idea của trend đã xóa
    // (soft delete cascade) không xuất hiện trong response/counts.
    @OneToMany(mappedBy = "trend", cascade = CascadeType.ALL, orphanRemoval = true)
    @org.hibernate.annotations.SQLRestriction("deleted_at is null")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    List<ContentIdea> contentIdeas = new ArrayList<>();
}
