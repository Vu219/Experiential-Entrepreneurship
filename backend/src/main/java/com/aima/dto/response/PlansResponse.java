package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Gói + bảng so sánh trong một lần gọi — dùng cho cả GET /plans/public lẫn GET /admin/plans. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlansResponse", description = "Danh sách gói + các dòng bảng so sánh.")
public class PlansResponse {

    List<PlanResponse> plans;

    List<PlanFeatureResponse> features;
}
