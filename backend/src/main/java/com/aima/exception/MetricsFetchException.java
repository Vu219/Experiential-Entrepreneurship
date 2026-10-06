package com.aima.exception;

import com.aima.enums.MetricsErrorType;
import lombok.Getter;

/**
 * Lỗi khi thu số liệu bài đã đăng (FR-59): mang phân loại + mã Graph gốc để job thu số liệu quyết định
 * backoff/dừng. Chỉ ném và bắt trong luồng thu số liệu — OAuth/đăng bài vẫn dùng {@link AppException} /
 * {@link PublishException}.
 */
@Getter
public class MetricsFetchException extends RuntimeException {

    private final MetricsErrorType errorType;

    /** Mã lỗi gốc, ví dụ "100/33", "190", "HTTP_503", "NETWORK". */
    private final String responseCode;

    public MetricsFetchException(MetricsErrorType errorType, String responseCode, String message) {
        super(message);
        this.errorType = errorType;
        this.responseCode = responseCode;
    }
}
