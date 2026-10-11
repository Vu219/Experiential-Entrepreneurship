package com.aima.enums;

/**
 * Mức độ của {@link PublishErrorCode}: quyết định màu hiển thị và thứ tự ưu tiên ở trang Bài lỗi.
 */
public enum PublishErrorSeverity {
    /** Hệ thống tự xử lý (đang thử lại) — chỉ để biết. */
    WARNING,
    /** Một bài cần người dùng xử lý. */
    ERROR,
    /** Chặn MỌI bài của một tài khoản (token, quyền, tài khoản bị khoá) — xử lý một lần cho cả nhóm. */
    CRITICAL
}
