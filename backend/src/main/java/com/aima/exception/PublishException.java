package com.aima.exception;

import com.aima.dto.publish.PlatformErrorDetail;
import com.aima.enums.PublishErrorType;
import lombok.Getter;

/**
 * Lỗi khi đăng bài lên nền tảng (FR-35, FR-37): mang theo phân loại lỗi + mã lỗi GỐC của nền tảng
 * để worker lưu lại và quyết định retry (FR-56). KHÔNG dùng cho luồng request/controller —
 * chỉ ném và bắt bên trong worker đăng bài; luồng HTTP vẫn dùng {@link AppException}.
 *
 * <p>{@code message} là chuỗi KỸ THUẬT (message gốc của nền tảng / mô tả lỗi nội bộ) — chỉ để log và cho
 * admin, KHÔNG bao giờ hiển thị cho người dùng. Người dùng chỉ thấy mã chuẩn hoá ({@code PublishErrorCode})
 * do {@code PublishErrorNormalizer} suy ra từ {@link #getResponseCode()} + {@link #getDetail()}.</p>
 */
@Getter
public class PublishException extends RuntimeException {

    private final PublishErrorType errorType;

    /** Mã lỗi gốc từ nền tảng, ví dụ "190", "368", HTTP status khi không parse được body, hoặc mã nội bộ
     * trong {@code PublishErrorRules.CODE_*}. */
    private final String responseCode;

    /** Lỗi nền tảng đã bóc đủ trường (subcode, fbtrace_id, thời gian chờ...); null với lỗi nội bộ. */
    private final PlatformErrorDetail detail;

    public PublishException(PublishErrorType errorType, String responseCode, String message) {
        this(errorType, responseCode, message, null, null);
    }

    /** Giữ {@code cause} để log hệ thống còn stacktrace gốc khi bọc một lỗi nội bộ. */
    public PublishException(PublishErrorType errorType, String responseCode, String message, Throwable cause) {
        this(errorType, responseCode, message, cause, null);
    }

    public PublishException(PublishErrorType errorType, String responseCode, String message, Throwable cause,
                            PlatformErrorDetail detail) {
        super(message, cause);
        this.errorType = errorType;
        this.responseCode = responseCode;
        this.detail = detail;
    }
}
