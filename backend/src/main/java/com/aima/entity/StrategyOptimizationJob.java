package com.aima.entity;

import com.aima.enums.GenerationJobStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import lombok.experimental.FieldDefaults;

/**
 * Một lần chạy tối ưu chiến lược (FR-65..FR-68, NFR-04 async): worker gom analytics của brand,
 * gọi AI /analyze rồi /optimize, lưu các {@link StrategyAdjustment} PROPOSED cho user duyệt.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "strategy_optimization_jobs")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class StrategyOptimizationJob extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "content_strategy_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    ContentStrategy contentStrategy;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    GenerationJobStatus status = GenerationJobStatus.PENDING;

    @Column(name = "error_message", columnDefinition = "text")
    String errorMessage;

    // FR-66: các cải tiến cho bài viết tương lai — mỗi dòng một mục ('\n' phân tách).
    @Column(name = "future_improvements", columnDefinition = "text")
    String futureImprovements;
}
