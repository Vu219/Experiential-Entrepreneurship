package com.aima.enums;

/** Mức nghiêm trọng một alert usage — quyết định màu badge trên tab Tổng quan. */
public enum UsageAlertSeverity {
    INFO,
    WARNING,
    /** Rò tiền / vượt chốt chặn hệ thống — cần xử lý ngay. */
    CRITICAL
}
