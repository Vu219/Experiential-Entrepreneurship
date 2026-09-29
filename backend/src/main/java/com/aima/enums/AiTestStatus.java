package com.aima.enums;

/**
 * Kết quả lần "Kiểm tra kết nối" gần nhất của một AI provider. null = chưa kiểm tra.
 *
 * <p>Từ 2026-09-29 AI service phân loại lỗi bằng {@code errors.classify_error} (cùng bộ phân loại
 * với chuỗi fallback) nên kết quả chi tiết hơn: quá tải / hết quota / rate limit nghĩa là KEY HỢP
 * LỆ nhưng nhà cung cấp tạm từ chối — không phải "kết nối thất bại". Cột lưu varchar(30) (nới ở
 * AiConfigDataInitializer), CHECK constraint đồng bộ ở PaymentDataInitializer.ENUM_COLUMNS.</p>
 */
public enum AiTestStatus {
    /** LEGACY (dữ liệu trước 2026-09-29) = OK. */
    SUCCESS,
    /** Lỗi khác (AI service không phản hồi, provider trả dữ liệu lạ...). Dữ liệu cũ: mọi lỗi. */
    FAILED,
    OK,
    INVALID_KEY,
    RATE_LIMITED,
    DAILY_QUOTA_EXHAUSTED,
    PROVIDER_OVERLOADED,
    NETWORK_ERROR;

    /**
     * Status từ AI service → enum. AI service bản cũ chỉ trả {@code success} (status null) →
     * OK/FAILED; giá trị lạ → FAILED.
     */
    public static AiTestStatus fromAiService(String status, boolean success) {
        if (status == null || status.isBlank()) {
            return success ? OK : FAILED;
        }
        try {
            return valueOf(status.trim());
        } catch (IllegalArgumentException e) {
            return success ? OK : FAILED;
        }
    }

    /** Key đã được nhà cung cấp chấp nhận (kể cả khi đang quá tải / hết quota). */
    public boolean keyValid() {
        return this == OK || this == SUCCESS || this == RATE_LIMITED
                || this == DAILY_QUOTA_EXHAUSTED || this == PROVIDER_OVERLOADED;
    }
}
