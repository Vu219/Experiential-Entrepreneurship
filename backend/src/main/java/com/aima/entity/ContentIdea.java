package com.aima.entity;

import java.time.LocalDateTime;
import com.aima.enums.Platform;
import com.aima.enums.SuitabilityLevel;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.List;

/**
 * Content idea generated from a {@link Trend}.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "content_ideas")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ContentIdea extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trend_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    Trend trend;

    /** Người dùng bấm "Lưu ý tưởng" lúc nào (V19); null = chưa lưu. */
    @Column(name = "saved_at")
    LocalDateTime savedAt;

    @Column(name = "idea_title", nullable = false, length = 255)
    String ideaTitle;

    @Column(name = "idea_description", columnDefinition = "text")
    String ideaDescription;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 20)
    Platform platform;

    @Enumerated(EnumType.STRING)
    @Column(name = "suitability_level", length = 20)
    SuitabilityLevel suitabilityLevel;

    // Gợi ý triển khai + mục tiêu brand mà ý tưởng phục vụ (FR-22) — JSON ["...", ...].
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "execution_suggestions", columnDefinition = "jsonb")
    String executionSuggestions;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "related_goals", columnDefinition = "jsonb")
    String relatedGoals;

    // Cha phụ của ContentItem (cha sở hữu là BrandProfile): KHÔNG cascade ở đây.
    @OneToMany(mappedBy = "contentIdea")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    List<ContentItem> contentItems = new ArrayList<>();
}
