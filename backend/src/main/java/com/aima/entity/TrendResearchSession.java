package com.aima.entity;

import com.aima.enums.Platform;
import com.aima.enums.ResearchStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Trend-research session for a brand profile. Runs as an async background job (NFR-04).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "trend_research_sessions")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TrendResearchSession extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "brand_profile_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    BrandProfile brandProfile;

    @Column(name = "industry", nullable = false, length = 100)
    String industry;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 20)
    Platform platform;

    @Column(name = "research_time", nullable = false)
    LocalDateTime researchTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    ResearchStatus status = ResearchStatus.PENDING;

    // Tóm tắt phiên do AI trả về (ResearchResponse.summary) — FR-23 lưu phiên nghiên cứu.
    @Column(name = "summary", columnDefinition = "text")
    String summary;

    @Column(name = "error_message", columnDefinition = "text")
    String errorMessage;

    @OneToMany(mappedBy = "researchSession", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    List<Trend> trends = new ArrayList<>();
}
