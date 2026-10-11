package com.aima.enums;

/**
 * Hành động gợi ý cho một lỗi đăng bài — FE vẽ nút theo danh sách này (nhãn lấy từ i18n FE).
 */
public enum PublishErrorAction {
    /** Kết nối lại / xác thực lại tài khoản trong Cài đặt → Kết nối. */
    RECONNECT_ACCOUNT,
    /** Mở bản nền tảng để sửa nội dung rồi đăng lại. */
    EDIT_CONTENT,
    /** Thử lại ngay (POST /me/failed-posts/{id}/retry). */
    RETRY_NOW,
    /** Huỷ lịch rồi lên lịch lại sang tài khoản/nền tảng khác. */
    CHANGE_ACCOUNT,
    /** Mở nền tảng để tự xử lý (checkpoint, hạn chế, vai trò Trang). */
    OPEN_PLATFORM,
    /** Bỏ qua lỗi (ẩn khỏi "Cần xử lý"). */
    DISMISS,
    /** Liên hệ hỗ trợ kèm mã tham chiếu. */
    CONTACT_SUPPORT,
    /** AI gợi ý sửa nội dung vi phạm (chỉ chạy khi người dùng bấm; xem lại diff trước khi áp dụng). */
    AI_FIX
}
