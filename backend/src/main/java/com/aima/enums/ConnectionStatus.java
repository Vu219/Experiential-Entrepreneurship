package com.aima.enums;

public enum ConnectionStatus {
    // --- Giá trị cũ (giữ nguyên, không rename — rule #1) ---
    CONNECTED,
    DISCONNECTED,
    EXPIRED,
    ON_HOLD,      // FR-18b: token hết hạn → bài Scheduled bị giữ lại

    // --- Bổ sung cho tính năng liên kết tài khoản MXH ---
    ACTIVE,       // kết nối hoạt động bình thường, token còn hạn
    REVOKED,      // người dùng/nền tảng đã thu hồi quyền (401/190)
    ERROR,        // lỗi khi gọi nền tảng (không xác định)
    PENDING       // đang trong quá trình OAuth, chưa hoàn tất
}
