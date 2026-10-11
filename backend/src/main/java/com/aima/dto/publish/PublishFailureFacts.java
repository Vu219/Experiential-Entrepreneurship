package com.aima.dto.publish;

import com.aima.enums.FailureState;
import com.aima.enums.PublishErrorAction;
import com.aima.enums.PublishErrorCode;

import java.time.Instant;
import java.util.List;

/**
 * Các giá trị SUY RA cho một bài lỗi (mã chuẩn, vòng đời, lượt thử, hành động khả dụng) — tính trong service
 * rồi đưa vào MapStruct để dựng DTO (rule #18).
 *
 * @param attempt       số lần đã thử trong chu kỳ đăng hiện tại
 * @param maxAttempts   số lần tối đa nếu lỗi được tự thử lại (1 + FR-56); null với lỗi không tự thử lại
 * @param actions       hành động khả dụng NGAY LÚC NÀY (đã lọc theo vòng đời / nội dung đã sửa / tài khoản)
 * @param contentChanged bản nền tảng đã được sửa sau lần đăng lỗi (cho phép "Đăng lại" lỗi nội dung)
 * @param accountReady  tài khoản đích còn kết nối + ACTIVE
 */
public record PublishFailureFacts(
        PublishErrorCode code,
        String platformCode,
        String platformSubcode,
        FailureState state,
        int attempt,
        Integer maxAttempts,
        Instant nextRetryAt,
        Instant failedAt,
        String referenceCode,
        List<PublishErrorAction> actions,
        boolean contentChanged,
        boolean accountReady) {
}
