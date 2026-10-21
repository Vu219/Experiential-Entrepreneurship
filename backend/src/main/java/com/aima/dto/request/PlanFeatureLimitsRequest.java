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
import com.aima.enums.Platform;

import java.util.List;

/**
 * Giới hạn của một gói: {@code -1} = không giới hạn, {@code 0} = tắt, {@code > 0} = hạn mức; cờ true/false; nền tảng
 * là danh sách. {@code null} = GIỮ NGUYÊN khi cập nhật (về "Mặc định" dùng {@code resetToDefault} của request gói);
 * khi TẠO gói mọi ô bắt buộc có giá trị. Ý nghĩa từng trường: {@link com.aima.entity.PlanFeatureLimits}.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanFeatureLimitsRequest", description = "Giới hạn theo gói. null = giữ nguyên, "
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

    @Schema(description = "Nền tảng gói cho phép (kết nối / lên lịch / đăng). Rỗng = không nền tảng nào.",
            example = "[\"FACEBOOK\"]")
    List<Platform> allowedPlatforms;

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

    @Min(value = -1, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Schema(description = "Lượt AI kiểm tra chính sách mỗi kỳ.", example = "30")
    Integer policyCheckAiPerPeriod;

    @Min(value = -1, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_FEATURE_LIMIT_INVALID")
    @Schema(description = "Số lần AI sửa bài tối đa mỗi bản nền tảng.", example = "3")
    Integer aiFixPerVersion;
}
