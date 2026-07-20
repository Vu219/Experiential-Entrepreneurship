package com.aima.dto.response;

import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/** Một dòng bảng "Giao dịch gần đây". */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "RevenueTransactionResponse", description = "Một giao dịch thanh toán.")
public class RevenueTransactionResponse {

    UUID id;

    @Schema(description = "Mã giao dịch hiển thị. Rơi về 8 ký tự đầu của id khi chưa có số hoá đơn.")
    String code;

    UUID userId;

    @Schema(description = "Tên khách hàng; rơi về email khi user chưa đặt tên.")
    String userName;

    String userEmail;

    String userAvatarUrl;

    String planCode;

    String planNameVi;

    String planNameEn;

    @Schema(description = "Số tiền của giao dịch (VND).")
    Long amount;

    String currency;

    PaymentStatus status;

    @Schema(description = "Mốc hiển thị ở cột Ngày: paidAt nếu đã thu tiền, ngược lại orderedAt (đơn chờ/hỏng).")
    LocalDateTime date;

    @Schema(description = "Mốc tạo đơn (nghiệp vụ) — luôn có giá trị.")
    LocalDateTime orderedAt;

    @Schema(description = "Mốc thu tiền thật; null khi đơn chưa thanh toán hoặc thất bại.")
    LocalDateTime paidAt;

    @Schema(description = "Số tiền đã hoàn (VND); 0 nếu chưa hoàn.")
    Long refundedAmount;

    LocalDateTime refundedAt;

    PaymentGateway gateway;

    @Schema(description = "Mã giao dịch phía cổng (payOS: orderCode). null với bản ghi thủ công.")
    String gatewayTxnId;
}
