package com.aima.enums;

/** {@code notifications.ref_id} trỏ tới đối tượng nào — FE dựng deep link khi bấm thông báo (null = bản ghi cũ). */
public enum NotificationRefType {
    POST,
    SCHEDULE,
    CONTENT_ITEM,
    PLATFORM_ACCOUNT,
    STRATEGY,
    PAYMENT,
    SUBSCRIPTION,
    TREND_SESSION,
    GENERATION_JOB,
    /** Thông báo hệ thống không trỏ tới bản ghi (vd version API theo nền tảng) — ref_id null. */
    PLATFORM
}
