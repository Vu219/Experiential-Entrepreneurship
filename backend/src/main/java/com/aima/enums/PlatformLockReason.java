package com.aima.enums;

/**
 * Vì sao một nền tảng / tài khoản đã kết nối KHÔNG dùng được (tính khi đọc, không lưu DB). Khoá hệ thống luôn thắng
 * khoá theo gói.
 */
public enum PlatformLockReason {
    /** Admin khoá nền tảng toàn hệ thống. */
    PLATFORM_DISABLED,
    /** Gói hiện tại của user không gồm nền tảng này (ALLOWED_PLATFORMS). */
    PLAN_EXCLUDED;

    /** Lý do tạm giữ lịch tương ứng. */
    public HoldReason holdReason() {
        return this == PLATFORM_DISABLED ? HoldReason.PLATFORM_DISABLED : HoldReason.PLAN_PLATFORM_EXCLUDED;
    }
}
