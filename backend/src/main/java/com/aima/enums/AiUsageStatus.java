package com.aima.enums;

/**
 * Trạng thái MỘT lần gọi AI trong event log {@code ai_usage}. Row cũ (trước khi thêm cột)
 * có status null = SUCCESS — coalesce ở tầng query, KHÔNG backfill UPDATE hàng loạt.
 */
public enum AiUsageStatus {
    SUCCESS,
    ERROR,
    /** Cuộc gọi AI quá thời gian chờ (WebClient timeout) — tách riêng để soi hạ tầng/model chậm. */
    TIMEOUT,
    /**
     * User bấm Dừng khi AI đang stream (D4): tính token = input thật (provider báo lúc bắt đầu) + output ƯỚC LƯỢNG theo số
     * ký tự đã nhận — billable như SUCCESS.
     */
    CANCELLED
}
