package com.aima.enums;

/**
 * Loại đơn mua gói, xác định lúc tạo đơn ({@code payments.order_type}). null với bản ghi cũ /
 * ghi tay / seed — trước khi có trang "Xem lại đơn hàng".
 */
public enum PaymentOrderType {
    /** Mua mới: đang Free, gói cũ đã hết hạn, hoặc gói hiện tại do admin cấp (không khấu trừ). */
    NEW,
    /** Gia hạn cùng gói đang còn hạn — CỘNG DỒN từ hạn cũ, không khấu trừ. */
    RENEW,
    /** Nâng lên gói giá cao hơn khi gói trả tiền còn hạn — khấu trừ giá trị còn lại, hạn tính lại từ lúc trả tiền. */
    UPGRADE
}
