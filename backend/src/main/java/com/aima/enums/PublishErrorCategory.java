package com.aima.enums;

/**
 * Nhóm của {@link PublishErrorCode} — dùng cho bộ lọc "nhóm lỗi" ở trang Bài lỗi và thống kê admin.
 */
public enum PublishErrorCategory {
    /** Nội dung/tài khoản bị nền tảng từ chối vì chính sách (BR-07: không tự đăng lại). */
    POLICY,
    /** Token hết hạn / bị thu hồi / đổi mật khẩu — phải kết nối lại. */
    AUTH,
    /** Thiếu quyền đăng (scope, vai trò trên Trang). */
    PERMISSION,
    /** Tài khoản bị khoá/hạn chế/ngắt kết nối/không đúng loại. */
    ACCOUNT,
    /** Nền tảng giới hạn tần suất gọi API — hệ thống tự thử lại. */
    RATE_LIMIT,
    /** Ảnh/video thiếu hoặc không hợp lệ. */
    MEDIA,
    /** Nội dung không hợp lệ (quá dài, trùng, tham số sai). */
    CONTENT,
    /** Lỗi mạng / tiến trình đăng bị gián đoạn — hệ thống tự thử lại. */
    NETWORK,
    /** Lỗi tạm thời hoặc sự cố phía nền tảng — hệ thống tự thử lại. */
    PLATFORM,
    /** Hết hạn mức đăng bài của nền tảng. */
    QUOTA,
    /** Lỗi của chính AIMA. */
    INTERNAL,
    /** Chưa phân loại được — vào hàng đợi "chưa phân loại" của admin. */
    UNKNOWN
}
