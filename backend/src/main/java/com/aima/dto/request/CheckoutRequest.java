package com.aima.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/** Yêu cầu mua gói. Giá/chu kỳ KHÔNG nhận từ client — đọc từ bảng {@code plans} theo id. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CheckoutRequest {

    @NotNull(message = "PLAN_NOT_PURCHASABLE")
    UUID planId;
}
