package com.aima.enums;

/**
 * Kết quả của một hành động trong {@code activity_logs}. Cố tình chỉ có 2 giá trị:
 * activity log ghi việc ĐÃ XẢY RA, không phải vòng đời job (job có status riêng).
 */
public enum ActivityResult {

    SUCCESS,

    /** Hành động bị từ chối hoặc thất bại — lý do nằm trong {@code metadata}. */
    FAILURE
}
