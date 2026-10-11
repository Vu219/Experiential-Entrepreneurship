package com.aima.enums;

/** Trạng thái tầng AI của một lần kiểm tra chính sách — FE dựa vào đây để hiện kết quả / lý do không chạy AI. */
public enum PolicyCheckAiStatus {
    /** Bộ luật không thấy nghi vấn → không cần gọi AI. */
    NOT_NEEDED,
    /** Người dùng tắt kiểm tra chính sách trong Cài đặt. */
    DISABLED,
    /** Gói hiện tại không gồm lượt kiểm tra bằng AI (chỉ có bộ luật). */
    PLAN_NOT_INCLUDED,
    /** Đã dùng hết lượt kiểm tra bằng AI của gói trong tháng. */
    LIMIT_REACHED,
    /** Hết "Token AI tháng này" — không gọi AI. */
    QUOTA_EXCEEDED,
    PENDING,
    RUNNING,
    DONE,
    FAILED
}
