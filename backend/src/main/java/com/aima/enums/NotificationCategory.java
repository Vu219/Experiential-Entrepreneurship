package com.aima.enums;

import lombok.Getter;

/**
 * Nhóm thông báo — đơn vị của cài đặt kênh (Cài đặt → Thông báo, ma trận nhóm × kênh). Khớp
 * {@code frontend/src/api/notifications.ts} ({@code NotificationCategory}).
 *
 * <p>{@code mandatoryInApp}: kênh "trong app" luôn bật (không cho tắt) — lỗi đăng bài và tài khoản mạng xã hội là việc
 * người dùng PHẢI biết. {@code emailCapable}: có email (dùng chung đồng ý {@code email_publish_errors}, D8).</p>
 */
@Getter
public enum NotificationCategory {
    PUBLISH_ISSUES(true, true, true, true, false),
    ACCOUNTS(true, true, true, true, false),
    PUBLISHING(false, true, true, false, false),
    AI_CONTENT(false, true, true, false, false),
    BILLING(false, true, true, false, false),
    /** Nhắc lịch sắp đăng — mặc định TẮT (D7). */
    REMINDERS(false, false, false, false, false),
    /** Chỉ admin nhận. */
    ADMIN(false, true, true, false, true);

    private final boolean mandatoryInApp;
    private final boolean defaultInApp;
    private final boolean defaultToast;
    private final boolean emailCapable;
    private final boolean adminOnly;

    NotificationCategory(boolean mandatoryInApp, boolean defaultInApp, boolean defaultToast, boolean emailCapable,
                         boolean adminOnly) {
        this.mandatoryInApp = mandatoryInApp;
        this.defaultInApp = defaultInApp;
        this.defaultToast = defaultToast;
        this.emailCapable = emailCapable;
        this.adminOnly = adminOnly;
    }
}
