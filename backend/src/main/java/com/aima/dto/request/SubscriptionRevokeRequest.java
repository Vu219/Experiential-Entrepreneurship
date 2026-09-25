package com.aima.dto.request;

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

/** Admin thu hồi gói, hạ user về Free NGAY (hạn mức Free áp dụng tức thì — user chốt 25/9). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SubscriptionRevokeRequest {

    @NotNull(message = "SUBSCRIPTION_CATEGORY_REQUIRED")
    SubscriptionChangeCategory category;

    @NotBlank(message = "SUBSCRIPTION_REASON_REQUIRED")
    @Size(max = 500, message = "SUBSCRIPTION_REASON_REQUIRED")
    String reason;
}
