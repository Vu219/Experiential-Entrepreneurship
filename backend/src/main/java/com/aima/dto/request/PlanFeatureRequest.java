package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Một dòng của bảng so sánh gói + giá trị từng ô theo mã gói. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanFeatureRequest", description = "Dòng tính năng của bảng so sánh + giá trị theo từng gói.")
public class PlanFeatureRequest {

    @Schema(description = "Tên nhóm (vi) — các dòng cùng nhóm hiển thị chung tiêu đề; để trống nếu không nhóm.",
            example = "Nội dung & AI")
    String groupVi;

    @Schema(description = "Tên nhóm (en).", example = "Content & AI")
    String groupEn;

    @NotBlank(message = "PLAN_FEATURE_NAME_REQUIRED")
    @Schema(description = "Tên dòng tính năng (vi).", example = "Bài viết AI mỗi tháng")
    String nameVi;

    @NotBlank(message = "PLAN_FEATURE_NAME_REQUIRED")
    @Schema(description = "Tên dòng tính năng (en).", example = "AI posts per month")
    String nameEn;

    Integer displayOrder;

    @Valid
    @Schema(description = "Giá trị ô theo từng gói (thiếu gói nào thì ô đó để trống).")
    List<PlanFeatureValueRequest> values;
}
