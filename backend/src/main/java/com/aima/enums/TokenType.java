package com.aima.enums;

/**
 * Loại access token đang lưu cho một {@code PlatformAccount}.
 * - USER_TOKEN: short-lived user token.
 * - PAGE_TOKEN: Page access token (Facebook Page) — không có hạn (tokenExpiredAt = null).
 * - LONG_LIVED_USER_TOKEN: long-lived user token (~60 ngày).
 */
public enum TokenType {
    USER_TOKEN,
    PAGE_TOKEN,
    LONG_LIVED_USER_TOKEN
}
