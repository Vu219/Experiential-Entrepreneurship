package com.aima.service;

import com.aima.entity.Payment;
import com.aima.enums.GatewayLinkStatus;
import com.aima.enums.PaymentGateway;

/**
 * Cổng thanh toán, nhìn từ phía nghiệp vụ. Mỗi cổng một bean
 * ({@code PayOSGatewayClientImpl}, {@code MockGatewayClientImpl}); tầng service chọn bean theo
 * {@code payment.gateway} bằng {@code Map<PaymentGateway, PaymentGatewayClient>} — cùng mẫu
 * {@code Map<Platform, PlatformPublisher>} của worker đăng bài (NFR-09: thêm cổng = thêm bean).
 *
 * <p>Tên là {@code PaymentGatewayClient} chứ không phải {@code PaymentGateway} vì trùng tên
 * enum {@link PaymentGateway}; hậu tố {@code Client} cũng theo tiền lệ {@code MetaApiClient} /
 * {@code AiServiceClient}.</p>
 *
 * <p><b>Mọi cài đặt đều gọi mạng</b> → không được gọi bên trong một {@code @Transactional}
 * đang mở (rule #24).</p>
 */
public interface PaymentGatewayClient {

    /** Cổng mà bean này phục vụ — khoá của map chọn bean. */
    PaymentGateway gateway();

    /**
     * Tạo link thanh toán cho một đơn đã lưu (đã có {@code gatewayTxnId} = orderCode,
     * {@code amount}, {@code expiresAt}).
     *
     * @throws com.aima.exception.AppException {@code PAYMENT_GATEWAY_NOT_CONFIGURED} thiếu
     *         credential · {@code PAYMENT_GATEWAY_ERROR} cổng từ chối (kết luận được: đơn
     *         FAILED) · {@code PAYMENT_GATEWAY_TIMEOUT} <b>không kết luận được</b> — link có
     *         thể ĐÃ tạo bên cổng, đơn phải giữ PENDING + {@code reconcile_required}
     */
    GatewayLink createPaymentLink(Payment payment, String description);

    /**
     * Tra cứu trạng thái thật của link. Đây là nguồn sự thật khi đối soát: gọi TRƯỚC khi đóng
     * một đơn hết hạn, và sau khi huỷ thất bại.
     */
    GatewayOrder getPaymentLink(String orderCode);

    /**
     * Huỷ link trên cổng. Người gọi KHÔNG được tự kết luận đơn đã chết khi hàm này ném lỗi —
     * phải {@link #getPaymentLink} xác nhận (điểm C §5, chống race huỷ/PAID).
     */
    void cancelPaymentLink(String orderCode, String reason);

    /**
     * Kiểm chữ ký webhook và bóc dữ liệu. Chữ ký sai → ném
     * {@code PAYMENT_SIGNATURE_INVALID}; khớp biến thể định dạng số còn lại →
     * {@code PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH} (vẫn KHÔNG kích hoạt gói).
     */
    WebhookData verifyWebhook(String rawBody);

    /** Kết quả tạo link. */
    record GatewayLink(String checkoutUrl, String linkId) {
    }

    /**
     * Trạng thái một đơn phía cổng.
     *
     * @param amountPaid  số tiền cổng ghi nhận đã nhận — phải khớp TUYỆT ĐỐI với
     *                    {@code payment.amount} mới được kích hoạt gói (bẫy {@code UNDERPAID})
     * @param checkoutUrl URL thanh toán nếu endpoint tra cứu có trả về — <b>thường là null</b>
     *                    (tài liệu payOS không nêu trường này ở API tra cứu). Có thì đơn treo
     *                    được chữa tại chỗ; không có thì phải huỷ link rồi tạo đơn mới, vì một
     *                    đơn PENDING không có URL sẽ khoá cứng user khỏi việc mua lại.
     * @param rawStatus   chuỗi trạng thái gốc, giữ để log/đối soát khi rơi vào
     *                    {@link GatewayLinkStatus#UNKNOWN}
     */
    record GatewayOrder(GatewayLinkStatus status, Long amount, Long amountPaid,
                        String linkId, String checkoutUrl, String rawStatus) {
    }

    /**
     * Dữ liệu webhook đã xác thực chữ ký.
     *
     * @param code {@code "00"} nghĩa là MỘT lệnh chuyển tiền thành công — KHÔNG phải đơn đã đủ
     *             tiền. Đừng kích hoạt gói chỉ dựa vào trường này.
     */
    record WebhookData(long orderCode, long amount, String description, String reference,
                       String code, String desc, String paymentLinkId) {
    }
}
