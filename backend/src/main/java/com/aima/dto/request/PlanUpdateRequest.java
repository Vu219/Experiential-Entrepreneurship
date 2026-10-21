package com.aima.dto.request;

import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;
import com.aima.enums.PlanLimitKey;

import java.util.List;

/**
 * Cập nhật gói. Thông tin hiển thị là FULL update (FE gửi trọn trạng thái form). Giới hạn: {@code null} = GIỮ NGUYÊN
 * (cả {@code monthlyTokenLimit} lẫn từng ô trong {@code featureLimits}); đưa một giới hạn về "Mặc định hệ thống" bằng
 * {@code resetToDefault} — chỉ 3 gói lõi được dùng, gói tự tạo bắt buộc có giá trị cụ thể (PLAN_LIMIT_VALUE_REQUIRED).
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

    @Deprecated
    @Schema(description = "BỎ QUA — số token hiển thị nay sinh từ monthlyTokenLimit (giữ field cho client cũ).",
            deprecated = true)
    Long tokenQuota;

    // Hạn mức token LLM THẬT mỗi tháng. null = GIỮ NGUYÊN, -1 = không giới hạn — gói đang bán (giá > 0, đang bật)
    // mà không giới hạn sau khi cập nhật sẽ bị chặn trong PlanServiceImpl.
    @Min(value = -1, message = "PLAN_TOKEN_LIMIT_INVALID")
    @Schema(description = "Hạn mức token LLM THẬT mỗi tháng. null = giữ nguyên, -1 = không giới hạn.", example = "100000")
    Long monthlyTokenLimit;

    @Valid
    @Schema(description = "Giới hạn theo gói (gồm 2 giới hạn AI). null / từng ô null = giữ nguyên.")
    PlanFeatureLimitsRequest featureLimits;

    @Schema(description = "Các giới hạn đưa về \"Mặc định hệ thống\" (chỉ gói lõi FREE/PLUS/PRO).")
    List<PlanLimitKey> resetToDefault;

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
