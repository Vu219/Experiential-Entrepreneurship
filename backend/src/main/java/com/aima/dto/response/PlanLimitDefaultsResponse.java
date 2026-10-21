package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Mặc định hệ thống (env) áp cho ô "Mặc định" của 3 gói lõi — trang admin hiển thị để giải thích. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanLimitDefaultsResponse", description = "Giới hạn mặc định hệ thống. null = không giới hạn, 0 = tắt.")
public class PlanLimitDefaultsResponse {

    @Schema(description = "Mặc định hệ thống của mọi giới hạn (aima.plan-limits.defaults.* + aima.ai-assist.*), giá trị thô.")
    PlanFeatureLimitsResponse featureLimits;
}
