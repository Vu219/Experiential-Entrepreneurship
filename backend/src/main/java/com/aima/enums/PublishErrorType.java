package com.aima.enums;

/**
 * Phân loại lỗi khi đăng bài (FR-37): quyết định retry theo chính sách FR-56.
 */
public enum PublishErrorType {
    /** Lỗi tạm thời (timeout, rate limit, 5xx) — retry tối đa 3 lần: 5/15/30 phút. */
    TEMPORARY,
    /** Lỗi vĩnh viễn (token hết hạn, tham số sai, thiếu quyền) — KHÔNG retry. */
    PERMANENT,
    /** Vi phạm chính sách nền tảng (SEC-06, BR-07) — KHÔNG retry, lưu mã lỗi gốc, báo user. */
    POLICY_VIOLATION
}
