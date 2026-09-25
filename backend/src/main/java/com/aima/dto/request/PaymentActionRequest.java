package com.aima.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Thao tác TAY của admin trên một đơn hàng (huỷ · đánh dấu đã trả tiền).
 *
 * <p><b>Lý do là BẮT BUỘC</b>, không phải trường tuỳ chọn cho đẹp: đây là nhóm hành động chạm
 * trực tiếp vào tiền của khách và vào hạn gói, nên mỗi lần thực hiện phải trả lời được câu
 * "vì sao" ngay trong {@code activity_logs} — sáu tháng sau không ai nhớ nổi.</p>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PaymentActionRequest {

    @NotBlank(message = "PAYMENT_REASON_REQUIRED")
    @Size(max = 500, message = "PAYMENT_REASON_REQUIRED")
    String reason;
}
