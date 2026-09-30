package com.aima.enums;

/**
 * Lý do một lịch đang bị tạm giữ (ON_HOLD) — một lịch có thể có NHIỀU lý do cùng lúc
 * (bảng {@code post_schedule_holds}, unique theo lịch + lý do). Mỗi luồng chỉ gỡ lý do mình quản lý.
 */
public enum HoldReason {
    /** Kết nối hết hạn/bị thu hồi/bị nền tảng hạn chế — gỡ khi kết nối lại hoặc xác thực lại thành công. */
    ACCOUNT_ISSUE,
    /** Bắt buộc duyệt đang bật và bài chưa được duyệt — gỡ khi bài được duyệt hoặc tắt bắt buộc duyệt. */
    PENDING_REVIEW,
    /** Kết nối đích đã bị ngắt/xoá — gỡ khi user chuyển lịch sang tài khoản khác. */
    ACCOUNT_REMOVED,
    /** Tài khoản AIMA đang chờ xoá — gỡ khi khôi phục (lịch vẫn chờ user kích hoạt lại). */
    USER_PENDING_DELETE,
    /** Nền tảng yêu cầu ảnh/video (Instagram) mà MVP chỉ đăng chữ — không tự gỡ. */
    UNSUPPORTED_MEDIA
}
