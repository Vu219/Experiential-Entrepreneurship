package com.aima.enums;

/** Trạng thái xử lý một thay đổi của webhook Meta ({@code meta_webhook_events}). */
public enum WebhookEventStatus {
    /** Đã lưu, chờ worker xử lý. */
    PENDING,
    /** Đã xử lý và có tác động (đánh dấu xoá, đưa bài/kênh về hạn đồng bộ...). */
    PROCESSED,
    /** Hợp lệ nhưng không liên quan (Trang/bài AIMA không theo dõi, loại sự kiện không dùng). */
    IGNORED,
    /** Xử lý lỗi quá số lần cho phép. */
    FAILED
}
