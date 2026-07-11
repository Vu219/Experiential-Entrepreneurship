package com.aima.service;

/**
 * Ghi log lỗi hệ thống xuống DB (FR-74) — best-effort như NotificationService: lỗi khi ghi log
 * chỉ log console, không được phá luồng đang gọi. Admin đọc lại qua trang Logs (FR-84).
 */
public interface SystemLogService {

    /** Lỗi hệ thống kèm nguyên nhân — detail lưu stack trace rút gọn. */
    void error(String module, String message, Throwable cause);

    /** Cảnh báo không có exception đi kèm. */
    void warn(String module, String message);
}
