package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Giới hạn tính năng của một gói (FULL update như các giới hạn AI V15): số {@code null} = mặc định hệ thống,
 * {@code -1} = không giới hạn, {@code 0} = tắt, {@code > 0} = hạn mức; cờ {@code null} = mặc định.
 * Ý nghĩa từng trường: {@link com.aima.entity.PlanFeatureLimits}.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanFeatureLimitsRequest", description = "Giới hạn tính năng theo gói. null = mặc định hệ thống, "
        + "-1 = không giới hạn, 0 = tắt.")
public class PlanFeatureLimitsRequest {

    @Min(value = -1, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_FEATURE_LIMIT_INVALID")
    Integer brandProfiles;

    @Min(value = -1, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_FEATURE_LIMIT_INVALID")
    Integer strategiesPerBrand;

    @Min(value = -1, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_FEATURE_LIMIT_INVALID")
    Integer connectedChannels;

    @Min(value = -1, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_FEATURE_LIMIT_INVALID")
    Integer trendResearchPerPeriod;

    Boolean autoTrendResearch;

    @Min(value = -1, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_FEATURE_LIMIT_INVALID")
    Integer ideasPerResearch;

    Boolean scheduling;

    @Min(value = -1, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_FEATURE_LIMIT_INVALID")
    Integer scheduledPostsPerPeriod;

    @Min(value = -1, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_FEATURE_LIMIT_INVALID")
    Integer activeSchedules;

    @Min(value = -1, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_FEATURE_LIMIT_INVALID")
    Integer scheduleHorizonDays;

    Boolean goldenHours;

    @Min(value = -1, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_FEATURE_LIMIT_INVALID")
    Integer analyticsHistoryDays;

    Boolean analyticsAdvanced;

    Boolean analyticsExport;

    @Min(value = -1, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_FEATURE_LIMIT_INVALID")
    Integer strategyOptimizationPerPeriod;
}
