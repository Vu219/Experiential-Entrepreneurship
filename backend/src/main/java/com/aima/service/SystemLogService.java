package com.aima.service;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.SystemLogResponse;
import com.aima.enums.LogLevel;

import java.time.LocalDate;

/**
 * Ghi log lỗi hệ thống xuống DB (FR-74) — best-effort như NotificationService: lỗi khi ghi log
 * chỉ log console, không được phá luồng đang gọi. Admin đọc lại qua trang Logs (FR-84).
 */
public interface SystemLogService {

    /** Lỗi hệ thống kèm nguyên nhân — detail lưu stack trace rút gọn. */
    void error(String module, String message, Throwable cause);

    /** Cảnh báo không có exception đi kèm. */
    void warn(String module, String message);

    /** FR-84: admin xem log, lọc level + ngày (null = bỏ qua), mới nhất trước. */
    ApiResponse<PageResponse<SystemLogResponse>> list(LogLevel level, LocalDate date, int page, int size);
}
