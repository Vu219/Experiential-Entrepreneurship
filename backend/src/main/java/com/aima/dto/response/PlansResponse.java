package com.aima.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
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

    /** Chỉ GET /admin/plans: mặc định hệ thống cho giới hạn AI để "Mặc định" trên gói. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    PlanLimitDefaultsResponse limitDefaults;
}
