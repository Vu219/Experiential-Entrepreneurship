package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Trang "Token & mức dùng" của user (GET /users/me/usage) — mọi con số GỘP từ event log
 * {@code ai_usage}; hạn mức từ Plan.monthlyTokenLimit; kỳ từ Subscription.
 * {@code limit} null = không giới hạn; các trường plan* null khi DB chưa seed gói.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserUsageResponse {

    /** Kỳ tính usage, "yyyy-MM". */
    String billingPeriod;

    LocalDateTime periodStart;

    /** Cuối kỳ (exclusive) — mốc reset hiển thị cho user. */
    LocalDateTime periodEnd;

    /** Mức dùng HẠN MỨC GÓI của kỳ (đã trừ credit/GRANT / sau mốc reset). */
    Long used;

    Long limit;

    /** Phần kỳ này trả bằng TOKEN MUA THÊM — tổng tiêu thụ thật = used + creditUsed. */
    Long creditUsed;

    /** Token mua thêm còn lại (bucket riêng, không reset theo kỳ). */
    Long creditLeft;

    String planCode;

    /**
     * Mã gói ĐANG ÁP CHO HẠN MỨC kỳ này (= gói của subscription). Khác nhãn gói của user
     * khi hạ gói giữa kỳ (hạ gói hiệu lực từ kỳ sau) — UI không phải tự suy luận.
     */
    String effectivePlanForQuota;

    /** Mốc gói mới bắt đầu áp dụng (= cuối kỳ) khi có thay đổi gói đang chờ; null = không có. */
    LocalDateTime pendingPlanChangeAt;

    String planNameVi;

    String planNameEn;

    /** Giá gói VND / chu kỳ (card gói hiện tại). */
    Long planPrice;

    /** true = gói không giới hạn của hệ thống (PRO): token + mọi tính năng không giới hạn. */
    boolean unlimitedPlan;

    /** Token theo ngày trong kỳ (chỉ các ngày có hoạt động — FE tự lấp ngày trống). */
    List<UsageSeriesPointResponse> series;

    /** Breakdown theo nghiệp vụ AI trong kỳ. */
    List<AiUsageByTaskResponse> byFeature;
}
