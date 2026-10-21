package com.aima.enums;

/** Vì sao một kênh Meta trả về trong OAuth callback KHÔNG được thêm (báo lại cho FE qua oauth-results). */
public enum OAuthSkipReason {
    /** Gói đã đủ CONNECTED_CHANNELS. */
    CHANNEL_LIMIT,
    /** Gói không gồm nền tảng của kênh (ALLOWED_PLATFORMS). */
    PLAN_PLATFORM,
    /** Nền tảng của kênh đang khoá toàn hệ thống. */
    PLATFORM_DISABLED
}
