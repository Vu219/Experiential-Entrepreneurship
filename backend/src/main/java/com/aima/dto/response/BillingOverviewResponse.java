package com.aima.dto.response;

import com.aima.enums.PlanSource;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Đầu trang Billing của user: đang dùng gói gì, tới bao giờ, và có đơn nào đang chờ trả tiền.
 *
 * <p><b>Đọc từ {@code subscriptions}, KHÔNG đọc nhãn {@code User.plan}</b> (Q4: subscription là
 * nguồn sự thật, nhãn chỉ là cache một chiều).</p>
 *
 * <p>{@code planExpiresAt = null} nghĩa là <b>không hết hạn</b> (gói Free hoặc gói admin cấp
 * vĩnh viễn) — không phải "hết hạn ngay". FE phải hiển thị theo nghĩa đó.</p>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BillingOverviewResponse {

    UUID planId;

    String planCode;

    String planNameVi;

    String planNameEn;

    Long price;

    Short billingIntervalMonths;

    /** null = không giới hạn token. */
    Long monthlyTokenLimit;

    /** Vì sao đang ở gói này: FREE (mặc định) · PAYMENT (đã mua) · ADMIN (được cấp). */
    PlanSource planSource;

    LocalDateTime planStartedAt;

    /** null = KHÔNG hết hạn. Xem javadoc lớp. */
    LocalDateTime planExpiresAt;

    /** Mốc reset hạn mức token (tháng lịch) — khác vòng đời gói ở trên. */
    LocalDateTime currentPeriodEnd;

    /** Đơn đang chờ thanh toán (tối đa MỘT), null nếu không có. */
    PaymentResponse pendingPayment;

    /**
     * Giờ SERVER lúc dựng response — mốc để FE chạy đếm ngược tới
     * {@code pendingPayment.expiresAt}.
     *
     * <p><b>Vì sao phải nằm trong payload</b>: đồng hồ máy người dùng lệch là chuyện thường, mà
     * header {@code Date} KHÔNG thuộc danh sách CORS-safelisted nên FE ở origin khác không đọc
     * được (chỉ {@code Authorization}/{@code Content-Disposition} đang được expose). Trả thẳng
     * trong body là cách duy nhất chắc chắn đúng ở mọi cấu hình.</p>
     */
    LocalDateTime serverTime;
}
