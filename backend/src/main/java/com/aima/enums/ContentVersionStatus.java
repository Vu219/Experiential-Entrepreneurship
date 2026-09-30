package com.aima.enums;

/**
 * Trạng thái SẢN XUẤT của một bản nền tảng. Vòng đời đăng nằm ở {@link ScheduleStatus}
 * (lịch không đổi trạng thái sản xuất).
 */
public enum ContentVersionStatus {
    DRAFT,
    GENERATED,
    FORMATTED
}
