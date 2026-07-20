package com.aima.enums;

/**
 * Nhóm nghiệp vụ của {@link ActivityAction} — dùng để gom optgroup trong dropdown lọc
 * của tab "Log hoạt động người dùng" (danh sách action dài, select phẳng không đọc được).
 */
public enum ActivityActionGroup {

    AUTH,
    ACCOUNT,
    CONTENT,
    BILLING,
    ADMIN
}
