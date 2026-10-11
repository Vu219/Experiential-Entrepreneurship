package com.aima.enums;

/**
 * Ai cần xử lý một lỗi đăng bài: người dùng (kết nối lại, sửa nội dung...) hay hệ thống (tự thử lại,
 * lỗi nội bộ đã ghi nhận cho quản trị viên).
 */
public enum PublishErrorOwner {
    USER,
    SYSTEM
}
