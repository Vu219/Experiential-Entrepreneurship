package com.aima.enums;

/**
 * Loại tài khoản trên nền tảng MXH mà một {@code PlatformAccount} đại diện.
 * - USER: tài khoản người dùng (User-level token).
 * - PAGE: Facebook Page.
 * - BUSINESS_ACCOUNT: Instagram Business/Creator account.
 * - PERSONAL: tài khoản cá nhân (vd Threads).
 */
public enum PlatformAccountType {
    USER,
    PAGE,
    BUSINESS_ACCOUNT,
    PERSONAL
}
