package com.aima.enums;

/**
 * Vòng đời một alert: OPEN (đang hiển thị; lần vi phạm tiếp theo UPDATE dòng này —
 * occurrence_count++, không sinh dòng mới) → ACKED (admin xác nhận, đặt cooldown_until;
 * trong cooldown rule đó không bắn lại cho cùng đối tượng).
 */
public enum UsageAlertStatus {
    OPEN,
    ACKED
}
