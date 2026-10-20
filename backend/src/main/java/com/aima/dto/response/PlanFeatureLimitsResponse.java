package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Giới hạn tính năng của gói, giá trị THÔ (null = mặc định hệ thống, -1 = không giới hạn, 0 = tắt). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanFeatureLimitsResponse", description = "Giới hạn tính năng theo gói (giá trị thô).")
public class PlanFeatureLimitsResponse {

    Integer brandProfiles;

    Integer strategiesPerBrand;

    Integer connectedChannels;

    Integer trendResearchPerPeriod;

    Boolean autoTrendResearch;

    Integer ideasPerResearch;

    Boolean scheduling;

    Integer scheduledPostsPerPeriod;

    Integer activeSchedules;

    Integer scheduleHorizonDays;

    Boolean goldenHours;

    Integer analyticsHistoryDays;

    Boolean analyticsAdvanced;

    Boolean analyticsExport;

    Integer strategyOptimizationPerPeriod;
}
