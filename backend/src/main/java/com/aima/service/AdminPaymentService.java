package com.aima.service;

import com.aima.dto.request.PaymentActionRequest;
import com.aima.dto.response.AdminPaymentResponse;
import com.aima.dto.response.AdminPaymentSummaryResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Quản trị ĐƠN HÀNG (trang admin "Đơn hàng & thanh toán"). Tách khỏi {@code RevenueService}
 * (trang "Thống kê doanh thu" — chỉ đọc, gộp số) vì đây là nơi có THAO TÁC trên tiền thật.
 *
 * <p><b>Ba bất biến của toàn bộ interface này:</b></p>
 * <ol>
 *   <li>Mọi thao tác đều <b>bắt buộc có lý do</b> ({@code @NotBlank}) và <b>ghi
 *       {@code activity_logs}</b> kèm lý do + id đơn + email admin thực hiện.</li>
 *   <li>Không thao tác nào tự viết trạng thái đơn — tất cả đi qua
 *       {@code PaymentService.applyGatewayResult} / {@code closeLinkSafely}, cùng code path mà
 *       webhook dùng. Nhờ vậy đường admin cũng được khoá dòng và idempotent y hệt.</li>
 *   <li>{@code rawPayload} chỉ trả ở {@link #get}, không bao giờ ở {@link #list}.</li>
 * </ol>
 */
public interface AdminPaymentService {

    /** Ba con số hàng đợi công việc đặt đầu trang (đối soát · chờ trả · webhook bị từ chối 24h). */
    ApiResponse<AdminPaymentSummaryResponse> summary();

    /**
     * Danh sách đơn có lọc + phân trang. {@code reconcileRequired = true} là bộ lọc quan trọng
     * nhất — hàng đợi việc cần làm tay.
     */
    ApiResponse<PageResponse<AdminPaymentResponse>> list(PaymentStatus status, PaymentGateway gateway,
                                                         Boolean reconcileRequired, LocalDate from,
                                                         LocalDate to, String q, int page, int size);

    /** Chi tiết một đơn, KÈM {@code rawPayload} — công cụ debug khi có tranh chấp/sự cố thật. */
    ApiResponse<AdminPaymentResponse> get(UUID paymentId);

    /**
     * Admin huỷ một đơn đang chờ. Đi qua {@code closeLinkSafely} nên vẫn an toàn trước race
     * "huỷ đúng lúc tiền về": cổng báo PAID thì đơn được KÍCH HOẠT chứ không bị huỷ.
     */
    ApiResponse<AdminPaymentResponse> cancel(String actorEmail, UUID paymentId, PaymentActionRequest request);

    /**
     * Đánh dấu đã thu tiền THỦ CÔNG — dùng khi tiền về ngoài luồng (chuyển khoản tay, webhook
     * mất vĩnh viễn, đơn đã hết hạn mà tiền vẫn tới).
     *
     * <p>Chạy qua đúng {@code applyGatewayResult(PAID, amount = đúng số tiền đơn)} nên gói được
     * kích hoạt theo cùng quy tắc Q1 (cộng dồn/thay thế) và vẫn idempotent. Đơn đã PAID hoặc đã
     * hoàn tiền bị chặn bằng {@code PAYMENT_NOT_MARKABLE_PAID} — không cho cộng hạn lần hai.</p>
     */
    ApiResponse<AdminPaymentResponse> markPaid(String actorEmail, UUID paymentId, PaymentActionRequest request);
}
