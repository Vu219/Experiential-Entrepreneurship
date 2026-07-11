package com.aima.entity;

import com.aima.enums.AppliedStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Adjustment to a {@link ContentStrategy} derived from an {@link OptimizationInsight}.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "strategy_adjustments")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class StrategyAdjustment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "strategy_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    ContentStrategy strategy;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "insight_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    OptimizationInsight insight;

    @Column(name = "adjustment_content", nullable = false, columnDefinition = "text")
    String adjustmentContent;

    // FR-65: lý do AI đưa ra đề xuất (từ StrategyAdjustment.rationale phía AI service).
    @Column(name = "rationale", columnDefinition = "text")
    String rationale;

    @Enumerated(EnumType.STRING)
    @Column(name = "applied_status", nullable = false, length = 20)
    AppliedStatus appliedStatus;

    // FR-68: thời điểm user chấp nhận/từ chối; null khi còn PENDING.
    @Column(name = "decided_at")
    java.time.LocalDateTime decidedAt;
}
