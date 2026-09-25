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
 * Một đơn thanh toán nhìn từ phía USER — dùng cho danh sách lịch sử, trang chi tiết và kết
 * quả của {@code verify}/{@code cancel}.
 *
 * <p><b>Cố ý KHÔNG có</b> {@code rawPayload}, {@code reconcileRequired}, {@code gatewayLinkId}
 * và {@code note}: đó là dữ liệu đối soát nội bộ, chỉ trang admin ở Bước 7 mới được thấy. Giữ
 * đúng ranh giới này thì thêm cột nội bộ về sau không vô tình rò ra endpoint của user.</p>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PaymentResponse {

    UUID id;

    String invoiceNo;

    String planCode;

    String planNameVi;

    String planNameEn;

    Long amount;

    String currency;

    PaymentStatus status;

    PaymentGateway gateway;

    /** {@code orderCode} phía cổng — user cần khi khiếu nại với ngân hàng/payOS. */
    String gatewayTxnId;

    LocalDateTime orderedAt;

    LocalDateTime paidAt;

    /** Chỉ có ý nghĩa khi đơn còn {@code PENDING} — FE chạy đếm ngược tới mốc này. */
    LocalDateTime expiresAt;

    /** Link trả tiền để nút "Tiếp tục thanh toán" quay lại ĐÚNG link cũ, không tạo đơn mới. */
    String checkoutUrl;

    /** Chu kỳ dịch vụ đơn này mua — hiện trên hoá đơn. */
    LocalDateTime periodStart;

    LocalDateTime periodEnd;

    String failedReason;
}
