package com.aima.enums;

/**
 * Ba nút trên trang giả lập cổng thanh toán của FE ({@code /billing/mock/{paymentId}}) —
 * DEV-ONLY, chỉ có tác dụng khi {@code PAYMENT_GATEWAY=mock}.
 *
 * <p>Mỗi giá trị chỉ quyết định trạng thái LINK phía cổng giả lập; phần áp lên đơn vẫn đi qua
 * đúng {@code PaymentServiceImpl.applyGatewayResult(...)} mà webhook thật dùng. Không có nhánh
 * code riêng cho mock, nếu không thì thứ được test ở dev sẽ khác thứ chạy thật.</p>
 */
public enum MockPaymentOutcome {

    /** Khách trả ĐỦ tiền → link {@code PAID} → đơn PAID + kích hoạt gói. */
    SUCCESS,

    /** Cổng báo giao dịch hỏng → link {@code FAILED} → đơn FAILED (vào tỉ lệ thất bại). */
    FAILED,

    /** Khách bỏ ngang tới hết hạn → link {@code EXPIRED} → đơn EXPIRED (KHÔNG vào tỉ lệ thất bại). */
    TIMEOUT
}
