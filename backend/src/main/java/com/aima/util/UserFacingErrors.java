package com.aima.util;

import com.aima.exception.AppException;

/**
 * Chọn message được phép lưu vào cột lỗi mà NGƯỜI DÙNG đọc được (vd {@code error_message} của job AI hiện ở
 * trang Trends/Chiến lược). Chỉ message của {@link AppException} (câu nghiệp vụ trong {@code ErrorCode}) đi qua;
 * mọi exception khác (NPE, SQL, Jackson, WebClient...) là chuỗi kỹ thuật → thay bằng câu chung. Exception gốc
 * vẫn được caller log đầy đủ cho admin.
 */
public final class UserFacingErrors {

    public static final String GENERIC_MESSAGE = "Đã xảy ra lỗi hệ thống — vui lòng thử lại sau ít phút";

    private UserFacingErrors() {
    }

    public static String messageOf(Throwable error) {
        if (error instanceof AppException app && app.getMessage() != null && !app.getMessage().isBlank()) {
            return app.getMessage();
        }
        return GENERIC_MESSAGE;
    }
}
