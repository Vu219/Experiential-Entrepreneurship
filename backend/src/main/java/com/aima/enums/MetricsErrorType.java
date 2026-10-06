package com.aima.enums;

/**
 * Phân loại lỗi khi THU SỐ LIỆU bài đã đăng (FR-59) — quyết định job thu số liệu thử lại khi nào.
 * Khác {@link PublishErrorType}: không áp chính sách retry 5/15/30 của FR-56 (đó là luồng đăng bài).
 */
public enum MetricsErrorType {
    /** Graph 100 + subcode 33: bài không còn (đã xoá) hoặc token không còn quyền đọc nó. */
    NOT_FOUND,
    /** Graph 4/17/32/613/80001/80002: bị giới hạn tần suất — dừng cả lượt quét. */
    RATE_LIMIT,
    /** Graph 10, 200–299: thiếu quyền (vd thiếu pages_read_engagement). */
    PERMISSION,
    /** Graph 190/102: token hết hạn/bị thu hồi. */
    TOKEN_INVALID,
    /** Nền tảng chưa hỗ trợ thu số liệu (Instagram). */
    UNSUPPORTED,
    /** Graph 100 khác subcode 33: tham số sai — thường là metric đã bị Meta khai tử. */
    INVALID_REQUEST,
    /** Graph 1/2, HTTP 5xx, lỗi mạng, mã lạ. */
    TEMPORARY
}
