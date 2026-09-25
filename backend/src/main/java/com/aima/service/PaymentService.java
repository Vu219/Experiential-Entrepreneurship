package com.aima.service;

import com.aima.dto.request.CheckoutRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.BillingOverviewResponse;
import com.aima.dto.response.CheckoutResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.PaymentResponse;
import com.aima.enums.GatewayLinkStatus;
import com.aima.enums.MockPaymentOutcome;
import com.aima.enums.PaymentStatus;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Luồng mua gói: tạo đơn → link thanh toán → áp kết quả từ cổng.
 *
 * <p><b>Mọi lời gọi cổng nằm NGOÀI transaction</b> (rule #24): các phương thức ở đây chia
 * thành nhiều transaction ngắn qua {@code TransactionTemplate}, xen giữa là lời gọi HTTP.</p>
 */
public interface PaymentService {

    /**
     * Tạo đơn + link thanh toán cho user đang đăng nhập.
     *
     * <p>Xử lý sẵn ba tình huống đã chốt:</p>
     * <ul>
     *   <li><b>Q1</b> — mua gói thấp hơn khi còn hạn thì chặn.</li>
     *   <li><b>Q2</b> — tối đa một đơn PENDING: cùng gói thì trả lại link cũ (giữ nguyên
     *       {@code expiresAt}), khác gói thì huỷ đơn cũ rồi tạo đơn mới.</li>
     *   <li><b>Tự chữa đơn treo</b> — đơn PENDING không có {@code checkoutUrl} (lần tạo link
     *       trước không kết luận được) sẽ được đối soát NGAY trong request này. Không có bước
     *       đó thì user bị khoá cứng khỏi việc mua: đơn cũ chiếm chỗ PENDING duy nhất mà lại
     *       không có link để trả tiền.</li>
     * </ul>
     */
    ApiResponse<CheckoutResponse> checkout(String email, CheckoutRequest request);

    /** Đầu trang Billing: gói hiện hành (đọc từ {@code subscriptions}) + đơn đang chờ trả tiền. */
    ApiResponse<BillingOverviewResponse> getBilling(String email);

    /** Lịch sử đơn của CHÍNH user đang đăng nhập, phân trang + lọc (API-03/SEC-04). */
    ApiResponse<PageResponse<PaymentResponse>> list(String email, PaymentStatus status,
                                                    LocalDate from, LocalDate to, int page, int size);

    /** Chi tiết một đơn. Đơn của người khác → {@code PAYMENT_ACCESS_DENIED} (403). */
    ApiResponse<PaymentResponse> get(String email, UUID paymentId);

    /**
     * User tự huỷ đơn đang chờ. Đi qua {@link #closeLinkSafely} nên vẫn an toàn trước race
     * "huỷ trong lúc tiền đang về": nếu cổng đã ghi nhận PAID thì đơn được KÍCH HOẠT chứ
     * không bị huỷ.
     */
    ApiResponse<PaymentResponse> cancel(String email, UUID paymentId);

    /**
     * Đối soát THỦ CÔNG một đơn theo yêu cầu của user — đường mà trang {@code /billing/return}
     * gọi sau khi payOS đưa trình duyệt quay về.
     *
     * <p><b>Vì sao bắt buộc phải có</b>: query string payOS gắn vào return URL KHÔNG có chữ ký,
     * nên FE tuyệt đối không được tin. Đây cũng là đường DUY NHẤT kiểm chứng được ở localhost,
     * nơi webhook thật không bao giờ tới được.</p>
     */
    ApiResponse<PaymentResponse> verify(String email, UUID paymentId);

    /**
     * Webhook payOS — <b>nguồn sự thật</b> của luồng thanh toán.
     *
     * <p><b>KHÔNG BAO GIỜ ném ra ngoài</b>: payOS retry mọi response khác 200, nên mọi nhánh
     * (body quá cỡ, chữ ký sai, JSON hỏng, orderCode lạ, lỗi nội bộ) đều phải kết thúc êm và
     * để controller trả 200. Riêng orderCode lạ là bắt buộc: payOS gửi một giao dịch MẪU
     * (orderCode = 123) lúc đăng ký webhook — trả lỗi ở đó = ĐĂNG KÝ WEBHOOK THẤT BẠI.</p>
     */
    void handleWebhook(String rawBody);

    /**
     * DEV-ONLY: ba nút trên trang giả lập của FE. Khoá ba lớp (cổng đang là MOCK +
     * {@code AIMA_PRODUCTION_MODE} + profile prod) → {@code PAYMENT_MOCK_DISABLED}.
     *
     * <p>Chỉ đặt trạng thái LINK phía cổng giả lập rồi đi qua ĐÚNG {@link #applyGatewayResult}
     * mà webhook dùng — không có nhánh code riêng cho mock.</p>
     */
    ApiResponse<PaymentResponse> applyMockOutcome(String email, UUID paymentId, MockPaymentOutcome outcome);

    /**
     * Đóng các đơn ĐÃ QUÁ HẠN — chạy từ {@code PaymentExpiryJob}.
     *
     * <p>Luôn hỏi cổng TRƯỚC khi đóng: đơn đã PAID mà webhook không tới sẽ được cứu ở đây, và
     * đơn cổng báo {@code PROCESSING} (tiền đang chuyển dở) được GIA HẠN chứ tuyệt đối không
     * huỷ — điểm B §5.</p>
     *
     * @return số đơn đã đóng hoặc kích hoạt xong
     */
    int expireOverdueOrders();

    /**
     * Áp trạng thái cổng lên một đơn — <b>đường DUY NHẤT</b> để đơn đổi trạng thái và để gói
     * được kích hoạt. Webhook, endpoint verify thủ công, job đối soát và cổng giả lập đều đi
     * qua đây, nên không có nhánh nào "nhẹ tay" hơn nhánh nào.
     *
     * <p>Idempotent tuyệt đối: khoá dòng đơn bằng {@code SELECT ... FOR UPDATE} và kiểm trạng
     * thái BÊN TRONG khoá.</p>
     *
     * @param amountPaid số tiền cổng ghi nhận; phải khớp TUYỆT ĐỐI mới kích hoạt gói
     * @param rawPayload payload thô để đối soát (webhook), null nếu không có
     */
    void applyGatewayResult(UUID paymentId, GatewayLinkStatus status, Long amountPaid,
                            String rawPayload, String failedReason);

    /**
     * Đóng đơn AN TOÀN (điểm C §5). Dùng chung cho cả ba chỗ huỷ link: job hết hạn, user tự
     * huỷ, và Q2 huỷ đơn cũ.
     *
     * <p>Huỷ trên cổng lỗi → <b>bắt buộc</b> tra lại trạng thái thật; nếu đã PAID thì đi nhánh
     * kích hoạt. Chỉ đóng đơn khi XÁC NHẬN được link không PAID; không xác nhận được thì giữ
     * nguyên + {@code reconcile_required} và thử lại vòng sau.</p>
     */
    void closeLinkSafely(UUID paymentId, String reason);

    /**
     * Đối soát các đơn treo: PENDING mà thiếu {@code checkoutUrl} hoặc đã bật
     * {@code reconcile_required}. Chạy từ scheduler, và resilient — lỗi một đơn chỉ log rồi
     * bỏ qua (rule #27).
     *
     * @return số đơn đã xử lý xong (đóng được hoặc chữa được)
     */
    int reconcileStuckOrders();
}
