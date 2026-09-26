package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Ba con số đặt ngay đầu trang quản lý đơn hàng — <b>hàng đợi công việc</b> của admin, không
 * phải số liệu trang trí.
 *
 * <p>Lý do chúng phải hiển thị mặc định thay vì để admin tự đi lọc: cả ba đều là tín hiệu
 * "có tiền của khách đang mắc kẹt ở đâu đó". Bắt người ta nhớ đi lọc mỗi ngày thì sớm muộn
 * cũng có ngày không ai lọc.</p>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AdminPaymentSummaryResponse {

    /**
     * Đơn bật {@code reconcile_required} — lệch tiền, tiền về sau khi đóng, cổng trả lạ… Có kỳ lọc thì
     * chỉ đếm đơn ĐẶT trong kỳ (khớp danh sách đơn).
     */
    long reconcileRequired;

    /** Đơn còn chờ thanh toán ở thời điểm hiện tại (có kỳ lọc: chỉ đơn đặt trong kỳ). */
    long pending;

    /**
     * Số webhook payOS bị TỪ CHỐI trong 24h qua — hoặc trong đúng kỳ lọc khi truyền from/to (đếm từ
     * {@code activity_logs}, action {@code PAYMENT_WEBHOOK_REJECTED}). Tên field giữ nguyên để không
     * vỡ hợp đồng API.
     *
     * <p>{@code > 0} là dấu hiệu sớm của sự cố chữ ký: nếu quy ước của ta lệch thì 100% webhook
     * fail, khách trả tiền xong không được kích hoạt gói, mà KHÔNG đơn nào mang
     * {@code reconcile_required} để nhìn ra. Đây là chỗ duy nhất con số đó lộ diện trên UI.</p>
     */
    long webhookRejected24h;
}
