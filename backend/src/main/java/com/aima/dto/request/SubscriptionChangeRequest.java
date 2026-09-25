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

import java.util.UUID;

/**
 * Admin chuyển user sang gói khác. Thời hạn tính TỪ BÂY GIỜ; {@code noExpiry = true} = cấp
 * không hết hạn (bỏ qua amount/unit). Hạ về Free không đi đường này mà dùng thu hồi.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SubscriptionChangeRequest {

    @NotNull(message = "PLAN_NOT_FOUND")
    UUID planId;

    Integer amount;

    DurationUnit unit;

    boolean noExpiry;

    @NotNull(message = "SUBSCRIPTION_CATEGORY_REQUIRED")
    SubscriptionChangeCategory category;

    @NotBlank(message = "SUBSCRIPTION_REASON_REQUIRED")
    @Size(max = 500, message = "SUBSCRIPTION_REASON_REQUIRED")
    String reason;
}
