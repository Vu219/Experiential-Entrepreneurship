package com.aima.service.Impl;

import com.aima.entity.Payment;
import com.aima.enums.GatewayLinkStatus;
import com.aima.enums.MockGatewayScenario;
import com.aima.enums.PaymentGateway;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.service.PaymentGatewayClient;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cổng GIẢ LẬP cho môi trường dev ({@code PAYMENT_GATEWAY=mock}) — chạy trọn luồng mua gói khi
 * chưa có credential payOS, và cũng là cách duy nhất test ở localhost vì webhook thật không
 * tới được máy dev.
 *
 * <p>{@code checkoutUrl} trỏ về trang giả lập của FE ({@code /billing/mock/{paymentId}}) với 3
 * nút <i>Thành công / Thất bại / Timeout</i>. Các nút đó gọi
 * {@code POST /payments/mock/{id}/{outcome}} và endpoint ấy chạy qua ĐÚNG
 * {@code PaymentServiceImpl.applyGatewayResult(...)} mà webhook dùng — không có nhánh code
 * riêng cho mock, nếu không thì luồng được test ở dev sẽ khác luồng chạy thật.</p>
 *
 * <p><b>Mô phỏng được cả nhánh hỏng</b> qua {@link MockGatewayScenario}
 * ({@code payment.mock-scenario}, đổi runtime bằng {@link #useScenario}). Ném đúng những
 * {@code ErrorCode} mà {@code PayOSGatewayClientImpl} ném, để logic đối soát phía trên được
 * chạy thử trước khi gặp sự cố thật.</p>
 *
 * <p>Trạng thái link giữ trong bộ nhớ, mất khi restart. Chấp nhận được: đây là công cụ dev,
 * không phải sổ cái — sổ cái là bảng {@code payments}.</p>
 */
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class MockGatewayClientImpl implements PaymentGatewayClient {

    Map<String, MockLink> links = new ConcurrentHashMap<>();

    String frontendBaseUrl;

    @NonFinal
    MockGatewayScenario scenario;

    public MockGatewayClientImpl(
            @Value("${app.frontend.base-url:http://localhost:3000}") String frontendBaseUrl,
            @Value("${payment.mock-scenario:NORMAL}") MockGatewayScenario scenario) {
        this.frontendBaseUrl = frontendBaseUrl;
        this.scenario = scenario;
    }

    /** Đổi kịch bản lúc chạy — cho test và cho endpoint dev-only ở Bước 6. */
    public void useScenario(MockGatewayScenario scenario) {
        log.info("[Mock] Chuyển kịch bản giả lập sang {}", scenario);
        this.scenario = scenario;
    }

    @Override
    public PaymentGateway gateway() {
        return PaymentGateway.MOCK;
    }

    @Override
    public GatewayLink createPaymentLink(Payment payment, String description) {
        String orderCode = payment.getGatewayTxnId();

        if (scenario == MockGatewayScenario.CREATE_TIMEOUT
                || scenario == MockGatewayScenario.CREATE_SERVER_ERROR) {
            // KHÔNG ghi links: mô phỏng đúng cái ác nhất — ta không biết bên cổng đã tạo link
            // hay chưa. Đơn sẽ treo PENDING không có checkoutUrl.
            log.warn("[Mock] Giả lập {} khi tạo link {}", scenario, orderCode);
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_TIMEOUT);
        }

        // Nhớ SỐ TIỀN của link, không chỉ trạng thái: điều kiện kích hoạt gói là "khớp tiền
        // tuyệt đối", nên mock không trả lại được amountPaid thì đường verify ở dev sẽ luôn
        // rơi vào nhánh lệch tiền và KHÔNG BAO GIỜ kích hoạt được gói.
        links.put(orderCode, new MockLink(scenario == MockGatewayScenario.LINK_EXPIRED
                ? GatewayLinkStatus.EXPIRED
                : GatewayLinkStatus.PENDING, payment.getAmount()));
        log.info("[Mock] Tạo link giả lập cho đơn {} ({} {})",
                orderCode, payment.getAmount(), payment.getCurrency());
        return new GatewayLink(frontendBaseUrl + "/billing/mock/" + payment.getId(),
                "mock-link-" + orderCode);
    }

    @Override
    public GatewayOrder getPaymentLink(String orderCode) {
        if (scenario == MockGatewayScenario.GET_LINK_NOT_FOUND) {
            log.warn("[Mock] Giả lập cổng không có link {}", orderCode);
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_LINK_NOT_FOUND);
        }
        if (scenario == MockGatewayScenario.GET_UNREACHABLE) {
            log.warn("[Mock] Giả lập không hỏi được cổng về link {}", orderCode);
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_TIMEOUT);
        }
        MockLink link = links.get(orderCode);
        // LINK_EXPIRED áp cho MỌI link, kể cả link vừa tạo trong cùng phiên — nếu chỉ áp cho
        // orderCode lạ thì kịch bản "link cũ đã chết bên cổng" không bao giờ được chạy thử.
        GatewayLinkStatus status = scenario == MockGatewayScenario.LINK_EXPIRED
                ? GatewayLinkStatus.EXPIRED
                : link == null ? GatewayLinkStatus.PENDING : link.status();
        Long amount = link == null ? null : link.amount();
        // Chỉ coi là ĐÃ NHẬN tiền khi link PAID — đúng ngữ nghĩa amountPaid của cổng thật.
        Long amountPaid = status == GatewayLinkStatus.PAID ? amount : null;
        // Cố ý trả checkoutUrl = null: mock không suy ra được paymentId từ orderCode, và như
        // vậy nhánh "không chữa được URL → huỷ link, tạo đơn mới" mới thực sự được chạy thử.
        return new GatewayOrder(status, amount, amountPaid, "mock-link-" + orderCode, null, status.name());
    }

    @Override
    public void cancelPaymentLink(String orderCode, String reason) {
        markStatus(orderCode, GatewayLinkStatus.CANCELLED);
        log.info("[Mock] Huỷ link giả lập {}: {}", orderCode, reason);
    }

    /**
     * Đặt trạng thái link cho ba nút của trang giả lập. Giữ nguyên số tiền đã nhớ để
     * {@link #getPaymentLink} trả về {@code amountPaid} khớp đơn khi link sang PAID.
     */
    public void markStatus(String orderCode, GatewayLinkStatus status) {
        links.compute(orderCode, (code, link) ->
                new MockLink(status, link == null ? null : link.amount()));
    }

    /**
     * Cổng giả lập KHÔNG nhận webhook — kết quả đến qua endpoint giả lập của FE. Fail-closed:
     * nếu ai đó bắn vào {@code /webhooks/payos} khi đang chạy mock thì từ chối, đừng để một
     * request không xác thực được đi vào luồng kích hoạt gói.
     */
    @Override
    public WebhookData verifyWebhook(String rawBody) {
        log.warn("[Mock] Nhận webhook trong khi cổng giả lập đang bật — từ chối");
        throw new AppException(ErrorCode.PAYMENT_SIGNATURE_INVALID);
    }

    /** Một link giả lập: trạng thái + số tiền của đơn đã tạo ra nó. */
    private record MockLink(GatewayLinkStatus status, Long amount) {
    }
}
