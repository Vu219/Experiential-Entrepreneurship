package com.aima.dto.request;

import com.aima.enums.AiTaskCode;
import com.aima.enums.BillingUnitType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Tạo MỘT version hệ số quy đổi mới (POST /admin/usage/rates) — service tự đóng
 * version đang mở cùng scope (append-only, không sửa đè).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BillingRateRequest {

    /** null = áp cho mọi nghiệp vụ. */
    AiTaskCode taskCode;

    /** null = áp cho mọi model trong scope taskCode. */
    String modelCode;

    @NotNull(message = "BILLING_RATE_UNIT_TYPE_REQUIRED")
    BillingUnitType unitType;

    @NotNull(message = "BILLING_RATE_MULTIPLIER_INVALID")
    @DecimalMin(value = "0.000001", message = "BILLING_RATE_MULTIPLIER_INVALID")
    BigDecimal multiplier;

    @Min(value = 0, message = "BILLING_RATE_MIN_CHARGE_INVALID")
    Long minCharge;

    /** null = hiệu lực từ bây giờ; nếu truyền phải ở tương lai và sau version đang mở. */
    LocalDateTime effectiveFrom;
}
