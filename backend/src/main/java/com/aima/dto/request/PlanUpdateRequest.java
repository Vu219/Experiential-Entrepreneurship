package com.aima.dto.request;

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
