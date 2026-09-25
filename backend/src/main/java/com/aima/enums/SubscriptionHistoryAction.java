package com.aima.enums;

/**
 * Loại thay đổi gói ghi trong {@code subscription_history}. Mọi đường ghi gói trong
 * {@code SubscriptionServiceImpl} để lại đúng một dòng — nên lịch sử trả lời được "vì sao user
 * này đang ở gói này" cả khi không phải admin thao tác.
 */
public enum SubscriptionHistoryAction {
    /** Đơn thanh toán PAID kích hoạt / cộng dồn gói. actor null = hệ thống. */
    PAYMENT_ACTIVATED,
    /** Admin cộng thêm thời hạn vào gói hiện tại (giữ nguyên gói + nguồn gốc). */
    ADMIN_EXTENDED,
    /** Admin chuyển user sang gói khác kèm thời hạn (hoặc không hết hạn). */
    ADMIN_CHANGED,
    /** Admin thu hồi, hạ về Free ngay lập tức. */
    ADMIN_REVOKED,
    /** Gói trả tiền/admin cấp hết hạn, hệ thống tự hạ về Free (job hoặc lazy check). */
    EXPIRED
}
