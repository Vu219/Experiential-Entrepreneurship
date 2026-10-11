package com.aima.dto.publish;

import com.aima.enums.Platform;

/**
 * Lỗi nền tảng đã bóc từ body {@code {"error":{...}}} + header của Graph/Threads API — nguyên liệu để
 * {@code PublishErrorRules} phân loại và để lưu (đã redact) vào {@code posting_jobs.error_detail} cho admin.
 * Mọi trường có thể null (body không phải JSON, lỗi mạng không có response...).
 *
 * @param httpStatus        HTTP status của response lỗi
 * @param code              {@code error.code} của Graph (vd 190, 368)
 * @param subcode           {@code error.error_subcode} (vd 463, 460)
 * @param type              {@code error.type} (vd OAuthException)
 * @param message           {@code error.message} — chuỗi KỸ THUẬT, chỉ dành cho admin
 * @param userTitle         {@code error.error_user_title} — nền tảng soạn cho người dùng cuối
 * @param userMessage       {@code error.error_user_msg}
 * @param fbtraceId         {@code error.fbtrace_id} — gửi kèm khi báo lỗi cho Meta
 * @param transientError    {@code error.is_transient} / HTTP 5xx — lỗi tự hết
 * @param retryAfterSeconds thời gian nền tảng yêu cầu chờ (header Retry-After, hoặc
 *                          {@code X-Business-Use-Case-Usage.estimated_time_to_regain_access} quy ra giây)
 */
public record PlatformErrorDetail(
        Platform platform,
        Integer httpStatus,
        Integer code,
        Integer subcode,
        String type,
        String message,
        String userTitle,
        String userMessage,
        String fbtraceId,
        boolean transientError,
        Long retryAfterSeconds) {
}
