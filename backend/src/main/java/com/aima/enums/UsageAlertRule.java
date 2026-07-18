package com.aima.enums;

/**
 * Các rule cảnh báo bất thường usage (pha 5A — CHỈ cảnh báo, chưa tự chặn; ngưỡng đọc từ
 * system_config qua UsageAlertService, KHÔNG hardcode). R5/R9 là alert CẤP HỆ THỐNG
 * (userId null); R8 gắn userId = admin thực hiện (BE ẩn với chính admin đó khi list).
 */
public enum UsageAlertRule {
    /** R1 — quá nhiều job AI/phút của một user. */
    HIGH_REQUEST_RATE,
    /** R2 — đốt % lớn hạn mức gói trong 1 giờ (chỉ gói lớn / có sàn tuyệt đối). */
    QUOTA_BURST,
    /** R3 — token hôm nay gấp N lần trung bình 7 ngày (cần ≥ min-active-days ngày có hoạt động). */
    DAILY_SPIKE,
    /** R4 — nhiều IP distinct VÀ nhiều User-Agent distinct trong 1 giờ (cả hai cùng vượt). */
    MULTI_CLIENT,
    /** R5 — tỉ lệ lỗi TOÀN HỆ THỐNG vượt ngưỡng (MỘT alert, không bắn theo từng user). */
    SYSTEM_ERROR_RATE,
    /** R6 — cost_usd một user trong ngày vượt ngưỡng. */
    USER_COST,
    /** R7 — credit_shortfall > 0: token đã dùng nhưng không trừ được vào đâu (rò tiền). */
    CREDIT_SHORTFALL,
    /** R8 — một admin GRANT/RESET vượt ngưỡng trong 24h (giám sát người giữ nút cấp token). */
    ADMIN_GRANT_ANOMALY,
    /** R9 — tổng cost_usd toàn hệ thống trong ngày vượt ngưỡng (chốt chặn cuối). */
    SYSTEM_COST
}
