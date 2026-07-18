package com.aima.enums;

/**
 * Trạng thái một dòng token mua thêm ({@code token_credits}). REVOKED = hoàn tiền/huỷ
 * giao dịch — chỉ thu hồi phần CHƯA tiêu; phần đã tiêu giữ nguyên trên event log.
 * Hết hạn KHÔNG đổi status — xác định bằng {@code expires_at} lúc đọc/trừ.
 */
public enum TokenCreditStatus {
    ACTIVE,
    REVOKED
}
