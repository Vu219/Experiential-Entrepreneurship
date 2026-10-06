package com.aima.enums;

/** Bài còn tồn tại trên nền tảng hay không — suy từ lỗi khi thu số liệu, KHÔNG đổi trạng thái bài (D2). */
public enum PlatformMediaStatus {
    ACTIVE,
    /** Gặp NOT_FOUND một lần — chờ lần thử sau 24h để xác nhận (100/33 cũng có thể là thiếu quyền). */
    UNAVAILABLE,
    /** NOT_FOUND hai lần liên tiếp — coi như đã xoá trên nền tảng; số liệu cũ giữ nguyên. */
    DELETED
}
