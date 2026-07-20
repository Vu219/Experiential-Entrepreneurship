package com.aima.enums;

/**
 * Cổng thanh toán tạo ra bản ghi {@code payments}.
 *
 * <p>Quyết định 2026-07-20: cổng thật trong tương lai là <b>payOS</b>. Giá trị {@link #PAYOS}
 * được khai báo SẴN từ bây giờ để khi tích hợp không phải migration đổi kiểu cột — chỉ cần
 * viết luồng tạo payment link + webhook.
 *
 * <p>payOS định danh đơn bằng {@code orderCode} (số nguyên); ta lưu nguyên giá trị đó dưới
 * dạng chuỗi vào {@code payments.gateway_txn_id} (partial unique) — không cần cột riêng.
 */
public enum PaymentGateway {

    /** Ghi nhận thủ công bởi admin, hoặc dữ liệu do dev seeder sinh ra. */
    MANUAL,

    /** payOS — chưa tích hợp, giá trị dự phòng cho luồng thanh toán thật. */
    PAYOS
}
