package com.aima.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.ArrayList;
import java.util.List;

/**
 * Một DÒNG trong bảng so sánh gói (ma trận feature × plan) — admin thêm/sửa/xóa tự do.
 * Giá trị từng ô theo gói nằm ở {@link PlanFeatureValue} (cascade từ đây).
 * groupVi/groupEn (tùy chọn) gom các dòng cùng nhóm dưới một tiêu đề trên landing.
 */
@Entity
@Table(name = "plan_features")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PlanFeature extends BaseEntity {

    @Column(name = "group_vi", length = 100)
    String groupVi;

    @Column(name = "group_en", length = 100)
    String groupEn;

    @Column(name = "name_vi", nullable = false, length = 200)
    String nameVi;

    @Column(name = "name_en", nullable = false, length = 200)
    String nameEn;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    Integer displayOrder = 0;

    @OneToMany(mappedBy = "feature", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    List<PlanFeatureValue> values = new ArrayList<>();
}
