package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Mặc định hệ thống (env) áp cho gói để giới hạn AI là "Mặc định" — trang admin hiển thị để giải thích. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanLimitDefaultsResponse", description = "Giới hạn mặc định hệ thống. null = không giới hạn, 0 = tắt.")
public class PlanLimitDefaultsResponse {

    @Schema(description = "AIMA_POLICY_CHECK_AI_LIMIT_DEFAULT đã quy đổi.", example = "0")
    Long policyCheckAiMonthlyLimit;

    @Schema(description = "AIMA_AI_FIX_MAX_PER_VERSION đã quy đổi.", example = "3")
    Long aiFixMaxPerVersion;

    @Schema(description = "Mặc định hệ thống của giới hạn tính năng (aima.plan-limits.defaults.*), giá trị thô.")
    PlanFeatureLimitsResponse featureLimits;
}
