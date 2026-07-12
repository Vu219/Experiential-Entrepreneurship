package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.FieldDefaults;

/** Giá trị một ô (theo mã gói) trong dòng bảng so sánh: tick boolean HOẶC text hạn mức. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanFeatureValueRequest")
public class PlanFeatureValueRequest {

    @NotBlank(message = "PLAN_CODE_REQUIRED")
    @Schema(description = "Mã gói của cột.", example = "FREE")
    String planCode;

    @Schema(description = "Ô dạng tick: true = ✓, false = —; null = dùng text.", example = "true")
    Boolean boolValue;

    @Schema(description = "Ô dạng text (vi), vd \"5\" hoặc \"Không giới hạn\".", example = "5")
    String textVi;

    @Schema(description = "Ô dạng text (en).", example = "5")
    String textEn;
}
