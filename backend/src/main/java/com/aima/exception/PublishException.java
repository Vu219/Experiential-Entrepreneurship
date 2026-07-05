package com.aima.exception;

import com.aima.enums.PublishErrorType;
import lombok.Getter;

/**
 * Lỗi khi đăng bài lên nền tảng (FR-35, FR-37): mang theo phân loại lỗi + mã lỗi GỐC của nền tảng
 * để worker lưu lại và quyết định retry (FR-56). KHÔNG dùng cho luồng request/controller —
 * chỉ ném và bắt bên trong worker đăng bài; luồng HTTP vẫn dùng {@link AppException}.
 */
@Getter
public class PublishException extends RuntimeException {

    private final PublishErrorType errorType;

    /** Mã lỗi gốc từ nền tảng, ví dụ "190", "368", hoặc HTTP status khi không parse được body. */
    private final String responseCode;

    public PublishException(PublishErrorType errorType, String responseCode, String message) {
        super(message);
        this.errorType = errorType;
        this.responseCode = responseCode;
    }
}
