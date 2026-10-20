package com.aima.dto.request;

import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Cập nhật gói — FULL update (FE gửi trọn trạng thái form; tokenQuota null = không giới hạn).
 * KHÔNG có {@code code}: mã gói bất biến.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlanUpdateRequest", description = "Cập nhật gói dịch vụ (gửi đủ field). Mã gói không đổi được.")
public class PlanUpdateRequest {

    @NotBlank(message = "PLAN_NAME_REQUIRED")
    String nameVi;

    @NotBlank(message = "PLAN_NAME_REQUIRED")
    String nameEn;

    @NotNull(message = "PLAN_PRICE_INVALID")
    @Min(value = 0, message = "PLAN_PRICE_INVALID")
    Long price;

    /** Nhãn hiển thị tự do — không dùng để tính doanh thu (xem billingIntervalMonths). */
    String billingCycleVi;
    String billingCycleEn;

    @NotNull(message = "PLAN_BILLING_INTERVAL_INVALID")
    @Min(value = 1, message = "PLAN_BILLING_INTERVAL_INVALID")
    @Max(value = 60, message = "PLAN_BILLING_INTERVAL_INVALID")
    @Schema(description = "Chu kỳ thanh toán THẬT (tháng): gói tháng = 1, quý = 3, năm = 12.", example = "1")
    Short billingIntervalMonths;

    Long tokenQuota;

    // Hạn mức token LLM THẬT mỗi tháng. null = GIỮ NGUYÊN giá trị hiện tại (FE cũ chưa gửi field này) —
    // gói đang bán (giá > 0, đang bật) mà vẫn null sau khi cập nhật sẽ bị chặn trong PlanServiceImpl.
    @Min(value = 1, message = "PLAN_TOKEN_LIMIT_INVALID")
    @Schema(description = "Hạn mức token LLM THẬT mỗi tháng. null = giữ nguyên hạn mức hiện tại.", example = "100000")
    Long monthlyTokenLimit;

    // Hai giới hạn AI dưới đây là FULL update như các field khác: null = về MẶC ĐỊNH hệ thống (không phải giữ nguyên).
    @Min(value = -1, message = "PLAN_AI_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_AI_LIMIT_INVALID")
    @Schema(description = "Lượt AI kiểm tra chính sách mỗi tháng. null = mặc định hệ thống, -1 = không giới hạn, "
            + "0 = tắt (chỉ bộ lọc tự động).", example = "30")
    Integer policyCheckAiMonthlyLimit;

    @Min(value = -1, message = "PLAN_AI_LIMIT_INVALID")
    @Max(value = 100_000, message = "PLAN_AI_LIMIT_INVALID")
    @Schema(description = "Số lần AI sửa bài tối đa mỗi bản nền tảng. null = mặc định hệ thống, -1 = không giới hạn, "
            + "0 = tắt.", example = "3")
    Integer aiFixMaxPerVersion;

    @Valid
    @Schema(description = "Giới hạn tính năng theo gói. null = toàn bộ về mặc định hệ thống.")
    PlanFeatureLimitsRequest featureLimits;

    String descriptionVi;
    String descriptionEn;

    List<String> featuresVi;
    List<String> featuresEn;

    List<String> teaserFeaturesVi;
    List<String> teaserFeaturesEn;

    String ctaVi;
    String ctaEn;

    @NotNull(message = "PLAN_FIELD_REQUIRED")
    Boolean highlight;

    @NotNull(message = "PLAN_FIELD_REQUIRED")
    Integer displayOrder;

    @NotNull(message = "PLAN_FIELD_REQUIRED")
    Boolean isActive;
}
