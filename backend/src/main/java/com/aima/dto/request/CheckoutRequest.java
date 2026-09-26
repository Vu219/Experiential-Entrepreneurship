package com.aima.dto.request;

import com.aima.enums.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/**
 * Yêu cầu mua gói — gửi từ nút "Thanh toán ngay" của trang "Xem lại đơn hàng". Giá/chu kỳ KHÔNG
 * nhận từ client: backend tự tính lại báo giá. {@code expectedAmount} chỉ để phát hiện báo giá
 * đã đổi giữa lúc xem và lúc bấm (vd qua nửa đêm làm số ngày còn lại giảm) — lệch thì từ chối
 * {@code PAYMENT_QUOTE_CHANGED}, không bao giờ thu một số tiền user chưa nhìn thấy.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CheckoutRequest {

    @NotNull(message = "PLAN_NOT_PURCHASABLE")
    UUID planId;

    @NotNull(message = "PAYMENT_METHOD_NOT_SUPPORTED")
    PaymentMethod paymentMethod;

    /** Tổng tiền user đã thấy trên trang xem lại ({@code GET /payments/quote → total}). */
    @NotNull(message = "PAYMENT_QUOTE_CHANGED")
    Long expectedAmount;
}
