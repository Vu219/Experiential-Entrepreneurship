package com.aima.enums;

/** Bài còn được job thu số liệu quét hay không. */
public enum MetricsSyncStatus {
    ACTIVE,
    /** Ngừng hẳn: đã xoá trên nền tảng, nền tảng chưa hỗ trợ, hoặc lỗi liên tiếp quá ngưỡng. */
    STOPPED
}
