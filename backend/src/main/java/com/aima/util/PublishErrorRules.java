package com.aima.util;

import com.aima.dto.publish.PlatformErrorDetail;
import com.aima.enums.PublishErrorCode;
import com.aima.enums.PublishErrorType;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Luật phân loại MẶC ĐỊNH lỗi đăng bài → {@link PublishErrorCode} (hàm thuần, test được). Ánh xạ do admin
 * thêm ({@code publish_error_mappings}) được {@code PublishErrorNormalizer} xét TRƯỚC các luật này.
 *
 * <p>Mã Graph đã kiểm chứng với tài liệu chính thức của Meta — "Handling Errors" và "Rate Limiting"
 * (xem {@code docs/failed-posts-error-handling-plan.md} §2.3). Thứ tự xét: mã nội bộ AIMA → mã Graph đã biết
 * (token/quyền/rate limit/trùng bài) → 368 + từ khoá chính sách → tài khoản bị khoá → hạn mức → media
 * Threads → lỗi tạm thời (1/2, 5xx, 429, is_transient) → 100 → UNKNOWN.</p>
 *
 * <p>Đây cũng là NGUỒN DUY NHẤT của các mã lỗi nội bộ (không đến từ nền tảng) mà publisher/worker ném ra
 * (rule #23 — không lặp chuỗi ma thuật).</p>
 */
public final class PublishErrorRules {

    // ===== Mã lỗi nội bộ AIMA (PublishException.responseCode khi lỗi không đến từ nền tảng) =====
    /** Lỗi mạng không có response (connect/response timeout, reset). */
    public static final String CODE_NETWORK = "NETWORK";
    /** Threads không trả container id khi tạo bài. */
    public static final String CODE_NO_CONTAINER = "NO_CONTAINER";
    /** Caption + hashtag vượt giới hạn của nền tảng ({@link PlatformTextLimits}). */
    public static final String CODE_TEXT_LIMIT = "TEXT_LIMIT_EXCEEDED";
    /** Instagram bắt buộc ảnh/video — MVP chỉ đăng chữ. */
    public static final String CODE_MEDIA_REQUIRED = "IG_MEDIA_REQUIRED";
    /** Facebook chỉ cho đăng lên Trang. */
    public static final String CODE_ACCOUNT_TYPE = "ACCOUNT_TYPE";
    /** Chưa có publisher cho nền tảng. */
    public static final String CODE_NO_PUBLISHER = "NO_PUBLISHER";
    /** Job kẹt RUNNING được vớt. */
    public static final String CODE_STUCK_RUNNING = "STUCK_RUNNING";
    /** Lỗi nội bộ (exception không đến từ nền tảng). */
    public static final String CODE_INTERNAL = "INTERNAL";
    /** Kết nối không còn khả dụng lúc worker nhận job. */
    public static final String CODE_ACCOUNT_UNAVAILABLE = "ACCOUNT_UNAVAILABLE";
    /** Nền tảng bị khoá toàn hệ thống / không thuộc gói lúc worker nhận job (V20) — không retry, lịch ON_HOLD. */
    public static final String CODE_PLATFORM_BLOCKED = "PLATFORM_BLOCKED";
    /** Token đã quá {@code token_expired_at} — phát hiện TRƯỚC khi gọi nền tảng (pre-flight). */
    public static final String CODE_TOKEN_EXPIRED = "TOKEN_EXPIRED";
    /** Kiểm tra bài đã lên nền tảng (trước khi thử lại lỗi mơ hồ) bị từ chối vì thiếu quyền đọc bài của Trang. */
    public static final String CODE_VERIFY_PERMISSION = "VERIFY_PERMISSION";
    /** Không kiểm tra được bài đã lên nền tảng (lỗi tạm thời) — KHÔNG đăng mù, thử lại sau theo FR-56. */
    public static final String CODE_VERIFY_UNAVAILABLE = "VERIFY_UNAVAILABLE";

    // ===== Mã Graph =====
    static final int TOKEN_INVALID = 190;
    static final int API_SESSION = 102;
    static final int POLICY_BLOCK = 368;
    static final int DUPLICATE_POST = 506;
    static final int LINK_SCRAPING = 1609005;
    static final int INVALID_PARAMETER = 100;
    /** 100/33: "Object … does not exist, cannot be loaded due to missing permissions". */
    static final int SUBCODE_OBJECT_MISSING = 33;

    private static final Set<Integer> RATE_LIMIT_CODES = Set.of(4, 17, 32, 341, 613);
    private static final int BUC_MIN = 80001;
    private static final int BUC_MAX = 80014;
    private static final Set<Integer> TEMPORARY_CODES = Set.of(1, 2);
    private static final Set<Integer> PERMISSION_CODES = Set.of(3, 10);

    private static final Pattern POLICY_TEXT = Pattern.compile("policy|policies|community standards");
    private static final Pattern CHECKPOINT_TEXT = Pattern.compile("checkpoint");
    private static final Pattern RESTRICTED_TEXT =
            Pattern.compile("restricted|account is locked|account has been disabled|account is disabled");
    private static final Pattern QUOTA_TEXT = Pattern.compile("publishing limit|posting limit|quota");
    // Giá trị error_message của container Threads khi xử lý media lỗi (tài liệu Threads "Troubleshooting").
    private static final Pattern MEDIA_TEXT = Pattern.compile(
            "failed_downloading_video|failed_processing_audio|failed_processing_video|invalid_aspec_ratio"
                    + "|invalid_bit_rate|invalid_duration|invalid_frame_rate|invalid_audio_channels"
                    + "|invalid_audio_channel_layout");

    private PublishErrorRules() {
    }

    /** Mã nội bộ AIMA → mã chuẩn; null nếu {@code responseCode} không phải mã nội bộ. */
    public static PublishErrorCode classifyInternal(String responseCode) {
        if (responseCode == null) {
            return null;
        }
        return switch (responseCode) {
            case CODE_NETWORK -> PublishErrorCode.NETWORK_TIMEOUT;
            case CODE_NO_CONTAINER -> PublishErrorCode.PLATFORM_TEMPORARY;
            case CODE_TEXT_LIMIT -> PublishErrorCode.CONTENT_TOO_LONG;
            case CODE_MEDIA_REQUIRED -> PublishErrorCode.MEDIA_REQUIRED;
            case CODE_ACCOUNT_TYPE -> PublishErrorCode.ACCOUNT_TYPE_UNSUPPORTED;
            case CODE_NO_PUBLISHER -> PublishErrorCode.PLATFORM_UNSUPPORTED;
            case CODE_STUCK_RUNNING -> PublishErrorCode.PUBLISH_INTERRUPTED;
            case CODE_INTERNAL -> PublishErrorCode.INTERNAL_ERROR;
            case CODE_ACCOUNT_UNAVAILABLE -> PublishErrorCode.ACCOUNT_DISCONNECTED;
            case CODE_PLATFORM_BLOCKED -> PublishErrorCode.PLATFORM_UNSUPPORTED;
            case CODE_TOKEN_EXPIRED -> PublishErrorCode.AUTH_TOKEN_EXPIRED;
            case CODE_VERIFY_PERMISSION -> PublishErrorCode.AUTH_PERMISSION_MISSING;
            case CODE_VERIFY_UNAVAILABLE -> PublishErrorCode.PLATFORM_TEMPORARY;
            default -> null;
        };
    }

    /** Phân loại lỗi trả về từ Graph/Threads API. */
    public static PublishErrorCode classify(PlatformErrorDetail detail) {
        Integer code = detail.code();
        Integer subcode = detail.subcode();
        Integer http = detail.httpStatus();
        String text = lower(detail.message()) + " " + lower(detail.userTitle()) + " " + lower(detail.userMessage());

        if (code != null) {
            if (code == TOKEN_INVALID || code == API_SESSION) {
                return classifyAuthSubcode(subcode);
            }
            if (PERMISSION_CODES.contains(code) || (code >= 200 && code <= 299)) {
                return PublishErrorCode.AUTH_PERMISSION_MISSING;
            }
            if (RATE_LIMIT_CODES.contains(code) || (code >= BUC_MIN && code <= BUC_MAX)) {
                return PublishErrorCode.RATE_LIMITED;
            }
            if (code == DUPLICATE_POST) {
                return PublishErrorCode.CONTENT_DUPLICATE;
            }
            if (code == LINK_SCRAPING) {
                return PublishErrorCode.CONTENT_INVALID;
            }
            if (code == POLICY_BLOCK) {
                return PublishErrorCode.POLICY_TEMPORARY_BLOCK;
            }
        }
        if (POLICY_TEXT.matcher(text).find()) {
            return PublishErrorCode.POLICY_VIOLATION;
        }
        if (CHECKPOINT_TEXT.matcher(text).find()) {
            return PublishErrorCode.ACCOUNT_CHECKPOINT;
        }
        if (RESTRICTED_TEXT.matcher(text).find()) {
            return PublishErrorCode.ACCOUNT_RESTRICTED;
        }
        if (QUOTA_TEXT.matcher(text).find()) {
            return PublishErrorCode.QUOTA_EXCEEDED;
        }
        if (MEDIA_TEXT.matcher(text).find()) {
            return PublishErrorCode.MEDIA_INVALID;
        }
        if (http != null && http == 429) {
            return PublishErrorCode.RATE_LIMITED;
        }
        if ((code != null && TEMPORARY_CODES.contains(code)) || detail.transientError()
                || (http != null && http >= 500)) {
            return PublishErrorCode.PLATFORM_TEMPORARY;
        }
        if (code != null && code == INVALID_PARAMETER) {
            return subcode != null && subcode == SUBCODE_OBJECT_MISSING
                    ? PublishErrorCode.AUTH_PERMISSION_MISSING
                    : PublishErrorCode.CONTENT_INVALID;
        }
        return PublishErrorCode.UNKNOWN;
    }

    /**
     * Chuẩn hoá dòng lỗi CŨ (trước V13, chưa có {@code error_code}) từ những gì đã lưu: mã gốc
     * ({@code publish_results.response_code} — số Graph, HTTP status khi body không phải JSON, hoặc mã nội bộ),
     * message gốc và phân loại thô. Không suy được → theo phân loại thô, cuối cùng là UNKNOWN.
     */
    public static PublishErrorCode classifyLegacy(String responseCode, String message, PublishErrorType legacyType) {
        PublishErrorCode internal = classifyInternal(responseCode);
        if (internal != null) {
            return internal;
        }
        Integer numeric = parseInt(responseCode);
        if (numeric != null || message != null) {
            // Mã ≥ 400 và < 600 (trừ 506 trùng bài) là HTTP status lưu thay mã Graph khi body không phải JSON.
            boolean httpStatus = numeric != null && numeric >= 400 && numeric < 600 && numeric != DUPLICATE_POST;
            PublishErrorCode byRules = classify(new PlatformErrorDetail(null,
                    httpStatus ? numeric : null, httpStatus ? null : numeric, null, null, message, null, null, null,
                    legacyType == PublishErrorType.TEMPORARY, null));
            if (byRules != PublishErrorCode.UNKNOWN) {
                return byRules;
            }
        }
        if (legacyType == null) {
            return PublishErrorCode.UNKNOWN;
        }
        return switch (legacyType) {
            case TEMPORARY -> PublishErrorCode.PLATFORM_TEMPORARY;
            case POLICY_VIOLATION -> PublishErrorCode.POLICY_VIOLATION;
            case INTERNAL -> PublishErrorCode.INTERNAL_ERROR;
            case PERMANENT -> PublishErrorCode.UNKNOWN;
        };
    }

    // Graph 190 + subcode (tài liệu "Authentication Error Subcodes").
    private static PublishErrorCode classifyAuthSubcode(Integer subcode) {
        if (subcode == null) {
            return PublishErrorCode.AUTH_TOKEN_EXPIRED;
        }
        return switch (subcode) {
            case 458 -> PublishErrorCode.AUTH_APP_REMOVED;
            case 459, 464 -> PublishErrorCode.ACCOUNT_CHECKPOINT;
            case 460 -> PublishErrorCode.AUTH_PASSWORD_CHANGED;
            case 492 -> PublishErrorCode.AUTH_PAGE_ROLE_MISSING;
            default -> PublishErrorCode.AUTH_TOKEN_EXPIRED; // 463 hết hạn, 467 token không hợp lệ, subcode lạ
        };
    }

    private static String lower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private static Integer parseInt(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
