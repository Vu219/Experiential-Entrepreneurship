package com.aima.enums;

/**
 * Loại thông báo trong ứng dụng (FR-75..FR-79).
 */
public enum NotificationType {
    POST_PUBLISHED,   // FR-75: đăng bài thành công
    POST_FAILED,      // FR-76: đăng bài thất bại (gồm vi phạm chính sách — FR-38)
    REVIEW_NEEDED,    // FR-77: có nội dung mới cần xem xét/duyệt
    RECONNECT_NEEDED, // FR-78: token hết hạn/thu hồi — cần kết nối lại
    NEW_INSIGHT       // FR-79: có insight mới từ phân tích (phát khi làm FR-59..FR-64)
}
