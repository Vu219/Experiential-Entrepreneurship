package com.aima.dto.publish;

import com.aima.enums.PublishErrorCode;

import java.time.Duration;

/**
 * Kết quả chuẩn hoá MỘT lỗi đăng bài ({@code PublishErrorNormalizer}): mã AIMA + mã gốc của nền tảng
 * (FR-35) + thời gian nền tảng yêu cầu chờ + chi tiết thô ĐÃ REDACT (chỉ admin đọc).
 *
 * @param platformCode    mã gốc: số Graph ("190") hoặc mã nội bộ AIMA ("TEXT_LIMIT_EXCEEDED"); null nếu không có
 * @param platformSubcode {@code error_subcode} của Graph; null nếu không có
 * @param retryAfter      thời gian chờ nền tảng yêu cầu; null nếu không có
 * @param detailJson      JSON chi tiết đã redact cho {@code posting_jobs.error_detail}; null nếu không có
 */
public record NormalizedPublishError(
        PublishErrorCode code,
        String platformCode,
        String platformSubcode,
        Duration retryAfter,
        String detailJson) {
}
