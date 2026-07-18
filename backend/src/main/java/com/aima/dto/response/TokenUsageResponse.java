package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * Mức dùng token LLM của user trong tháng hiện tại (thanh usage ở sidebar).
 * {@code limit} = Plan.monthlyTokenLimit của gói user; null = không giới hạn.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TokenUsageResponse {

    Long used;

    Long limit;

    /** Token mua thêm còn lại — FE đổi thông điệp cảnh báo 80% khi còn credit. */
    Long creditLeft;

    String plan;

    /** Mã gói ĐANG ÁP CHO HẠN MỨC (khác {@code plan} khi hạ gói giữa kỳ — hiệu lực từ kỳ sau). */
    String effectivePlanForQuota;

    /** Mốc gói mới bắt đầu áp dụng khi có thay đổi gói đang chờ; null = không có. */
    LocalDateTime pendingPlanChangeAt;
}
