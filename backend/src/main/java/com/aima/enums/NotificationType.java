package com.aima.enums;

/**
 * Loại thông báo trong ứng dụng (FR-75..FR-79).
 */
public enum NotificationType {
    POST_PUBLISHED,   // FR-75: đăng bài thành công
    POST_FAILED,      // FR-76: đăng bài thất bại (gồm vi phạm chính sách — FR-38)
    REVIEW_NEEDED,    // FR-77: có nội dung mới cần xem xét/duyệt
    RECONNECT_NEEDED, // FR-78: token hết hạn/thu hồi — cần kết nối lại
    NEW_INSIGHT,      // FR-79: có insight mới từ phân tích (phát khi làm FR-59..FR-64)

    // ===== Thanh toán gói dịch vụ =====
    // Hai loại dưới là enum ĐÓNG khớp hai đầu: thêm giá trị phải sửa cả
    // frontend/src/api/notifications.ts + components/notificationMeta.ts, nếu không chuông
    // thông báo tra Record<NotificationType,...> ra undefined và vỡ lúc render.

    PAYMENT_SUCCEEDED, // đơn đã thu tiền và gói đã được kích hoạt
    PLAN_EXPIRED,      // gói trả tiền hết hạn, tài khoản đã hạ về Free

    /**
     * CHỈ gửi cho ADMIN: webhook payOS đang bị từ chối bất thường.
     *
     * <p>Không có nó thì một sai lệch quy ước chữ ký sẽ làm 100% webhook fail trong im lặng —
     * khách trả tiền xong không được kích hoạt gói, mà tín hiệu duy nhất là một dòng log
     * ERROR không ai đọc.</p>
     */
    PAYMENT_WEBHOOK_ALERT
}
