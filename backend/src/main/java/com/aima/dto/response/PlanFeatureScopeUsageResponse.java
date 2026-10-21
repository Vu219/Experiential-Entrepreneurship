package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/** Số đã dùng của một giới hạn đếm THEO PHẠM VI (vd STRATEGIES_PER_BRAND: theo từng thương hiệu). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanFeatureScopeUsageResponse")
public class PlanFeatureScopeUsageResponse {

    @Schema(description = "Id phạm vi (brandId với STRATEGIES_PER_BRAND).")
    UUID scopeId;

    @Schema(description = "Tên phạm vi (tên thương hiệu).", example = "Cà phê Mộc")
    String scopeName;

    @Schema(example = "2")
    long used;
}
