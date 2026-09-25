package com.aima.dto.response;

import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Một đơn hàng nhìn từ phía ADMIN — nhiều hơn {@link PaymentResponse} của user ở các trường
 * đối soát nội bộ: {@link #reconcileRequired}, {@link #gatewayLinkId}, {@link #note},
 * {@link #failedReason} và {@link #rawPayload}.
 *
 * <p><b>{@code rawPayload} CHỈ được điền ở endpoint chi tiết</b>
 * ({@code GET /admin/payments/{id}}). Mapper của danh sách bỏ qua trường này có chủ đích: một
 * trang 20 dòng sẽ kéo theo 20 payload thô, vừa nặng vừa rải dữ liệu giao dịch ra chỗ không
 * cần. DTO của user ({@link PaymentResponse}) <b>không có</b> trường này nên việc rò rỉ sang
 * endpoint người dùng là bất khả thi về mặt cấu trúc, không phải nhờ nhớ.</p>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AdminPaymentResponse {

    UUID id;

    String invoiceNo;

    UUID userId;

    String userEmail;

    String userFullName;

    UUID planId;

    String planCode;

    String planNameVi;

    String planNameEn;

    Long amount;

    String currency;

    PaymentStatus status;

    PaymentGateway gateway;

    String gatewayTxnId;

    String gatewayLinkId;

    String checkoutUrl;

    LocalDateTime orderedAt;

    LocalDateTime paidAt;

    LocalDateTime expiresAt;

    LocalDateTime periodStart;

    LocalDateTime periodEnd;

    Long refundedAmount;

    LocalDateTime refundedAt;

    /** Cần admin xử lý tay — cột lọc chính của hàng đợi công việc. */
    Boolean reconcileRequired;

    Integer expiryGraceCount;

    String failedReason;

    String note;

    /** CHỈ có ở endpoint chi tiết. Xem javadoc lớp. */
    String rawPayload;
}
