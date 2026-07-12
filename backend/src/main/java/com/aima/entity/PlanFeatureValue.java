package com.aima.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Giá trị một Ô của bảng so sánh: (feature, plan) → tick boolean HOẶC text hạn mức.
 * boolValue != null ⇒ ô dạng tick (✓/—); ngược lại dùng textVi/textEn.
 */
@Entity
@Table(name = "plan_feature_values",
        uniqueConstraints = @UniqueConstraint(name = "uk_plan_feature_values_feature_plan",
                columnNames = {"feature_id", "plan_id"}))
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PlanFeatureValue extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "feature_id", nullable = false)
    PlanFeature feature;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    Plan plan;

    /** Ô dạng tick: true = ✓, false = —; null = ô dạng text. */
    @Column(name = "bool_value")
    Boolean boolValue;

    @Column(name = "text_vi", length = 200)
    String textVi;

    @Column(name = "text_en", length = 200)
    String textEn;
}
