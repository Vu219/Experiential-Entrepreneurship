package com.aima.dto.request;

import com.aima.enums.DurationUnit;
import com.aima.enums.SubscriptionChangeCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Admin cộng thêm thời hạn vào gói hiện tại của một user — CỘNG DỒN vào hạn cũ, không ghi đè.
 * Trần theo đơn vị ({@link DurationUnit}) kiểm ở service vì phụ thuộc {@code unit}.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SubscriptionExtendRequest {

    @NotNull(message = "SUBSCRIPTION_DURATION_INVALID")
    Integer amount;

    @NotNull(message = "SUBSCRIPTION_DURATION_INVALID")
    DurationUnit unit;

    @NotNull(message = "SUBSCRIPTION_CATEGORY_REQUIRED")
    SubscriptionChangeCategory category;

    @NotBlank(message = "SUBSCRIPTION_REASON_REQUIRED")
    @Size(max = 500, message = "SUBSCRIPTION_REASON_REQUIRED")
    String reason;
}
