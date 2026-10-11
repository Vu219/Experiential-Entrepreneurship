package com.aima.enums;

/**
 * Cách một lần đăng lỗi (job FAILED cuối của bài) đã được xử lý — lưu ở {@code posting_jobs.resolution}.
 * Lỗi mới sinh job mới nên tự "mở lại", không cần reset cột này.
 */
public enum FailureResolution {
    /** Người dùng bỏ qua lỗi. */
    DISMISSED,
    /** Người dùng/admin bấm "Thử lại ngay" — mở chu kỳ đăng mới. */
    RETRIED,
    /** Lịch FAILED bị huỷ. */
    CANCELLED
}
