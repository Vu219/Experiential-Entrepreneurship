package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;

/** {@code GET /users/me/plan-usage}: giới hạn tính năng của gói hiện tại + mức đã dùng trong kỳ. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanFeatureUsageResponse")
public class PlanFeatureUsageResponse {

    @Schema(example = "FREE")
    String planCode;

    @Schema(description = "Đầu kỳ tính lượt (inclusive).")
    LocalDateTime periodStart;

    @Schema(description = "Cuối kỳ (exclusive) — mốc các lượt theo kỳ được làm mới.")
    LocalDateTime periodEnd;

    List<PlanFeatureUsageItemResponse> items;
}
