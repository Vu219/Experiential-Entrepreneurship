package com.aima.enums;

import lombok.Getter;

/**
 * Loại thông báo trong ứng dụng (FR-75..FR-79). Enum ĐÓNG khớp ba nơi: CHECK {@code notifications_type_check}
 * (migration mới khi thêm giá trị), {@code frontend/src/api/notifications.ts} + {@code components/notificationMeta.ts}
 * và khoá i18n {@code ntf_<TYPE>_title/_body} — thiếu một nơi thì chuông tra {@code Record<NotificationType,…>} ra
 * undefined và vỡ lúc render.
 */
@Getter
public enum NotificationType {
    POST_PUBLISHED(NotificationCategory.PUBLISHING),           // FR-75: đăng bài thành công
    POST_FAILED(NotificationCategory.PUBLISH_ISSUES),          // FR-76: thất bại chung cuộc (gồm vi phạm chính sách — FR-38)
    POST_REMOVED_BY_PLATFORM(NotificationCategory.PUBLISH_ISSUES), // nền tảng báo bài đã bị gỡ (webhook)
    SCHEDULE_OVERDUE(NotificationCategory.PUBLISH_ISSUES),     // lịch tạm giữ đã quá giờ — không tự đăng (một lần/lịch)
    RECONNECT_NEEDED(NotificationCategory.ACCOUNTS),           // FR-78: token hết hạn/thu hồi — cần kết nối lại
    TOKEN_EXPIRING(NotificationCategory.ACCOUNTS),             // kết nối sắp hết hạn mà chưa tự gia hạn được (≤ 3 ngày)
    REVIEW_NEEDED(NotificationCategory.AI_CONTENT),            // FR-77: nội dung mới cần xem xét/duyệt
    CONTENT_GENERATION_FAILED(NotificationCategory.AI_CONTENT), // AI tạo nội dung thất bại / quá thời gian
    TREND_RESEARCH_DONE(NotificationCategory.AI_CONTENT),
    TREND_RESEARCH_FAILED(NotificationCategory.AI_CONTENT),
    NEW_INSIGHT(NotificationCategory.AI_CONTENT),              // FR-79: đề xuất tối ưu chiến lược mới

    // ===== Thanh toán gói dịch vụ & hạn mức =====
    PAYMENT_SUCCEEDED(NotificationCategory.BILLING),           // đơn đã thu tiền và gói đã được kích hoạt
    PLAN_EXPIRING(NotificationCategory.BILLING),               // gói trả tiền còn 7 / 1 ngày
    PLAN_EXPIRED(NotificationCategory.BILLING, true),          // gói hết hạn, đã hạ về Free — luôn hiện trong app
    AI_QUOTA_WARNING(NotificationCategory.BILLING),            // dùng ≥ 80% hạn mức token của kỳ
    AI_QUOTA_EXHAUSTED(NotificationCategory.BILLING),          // dùng hết 100% hạn mức token của kỳ

    SCHEDULE_UPCOMING(NotificationCategory.REMINDERS),         // bài sắp đăng trong 30 phút (mặc định tắt)

    // ===== CHỈ gửi cho ADMIN =====
    /**
     * Webhook payOS đang bị từ chối bất thường. Không có nó thì một sai lệch quy ước chữ ký sẽ làm 100% webhook fail
     * trong im lặng — khách trả tiền xong không được kích hoạt gói.
     */
    PAYMENT_WEBHOOK_ALERT(NotificationCategory.ADMIN),
    ADMIN_USAGE_ALERT(NotificationCategory.ADMIN),             // cảnh báo sử dụng (usage_alerts R1–R9) mới mở
    ADMIN_AI_DEGRADED(NotificationCategory.ADMIN),             // model AI vào trạng thái nghỉ (circuit breaker)
    ADMIN_API_VERSION(NotificationCategory.ADMIN);             // version Graph/Threads sắp ngừng / có bản mới

    private final NotificationCategory category;
    private final boolean alwaysInApp;

    NotificationType(NotificationCategory category) {
        this(category, category.isMandatoryInApp());
    }

    NotificationType(NotificationCategory category, boolean alwaysInApp) {
        this.category = category;
        this.alwaysInApp = alwaysInApp;
    }
}
