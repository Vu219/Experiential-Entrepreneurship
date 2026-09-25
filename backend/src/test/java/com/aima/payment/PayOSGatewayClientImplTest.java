package com.aima.payment;

import com.aima.config.PayOSProperties;
import com.aima.entity.Payment;
import com.aima.enums.GatewayLinkStatus;
import com.aima.enums.PaymentGateway;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PayOSMapper;
import com.aima.mapper.PayOSMapperImpl;
import com.aima.service.PaymentGatewayClient;
import com.aima.service.Impl.PayOSGatewayClientImpl;
import com.aima.util.PayOSSignature;
import com.fasterxml.jackson.databind.JsonNode;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Dựng request / bóc response payOS bằng {@link MockWebServer} (tiền lệ
 * {@code MetaApiClientImplTest}).
 *
 * <p>Trọng tâm là <b>phân loại lỗi</b>: cổng từ chối (kết luận được → đơn có thể đóng) phải
 * KHÁC hẳn timeout (không kết luận được → đơn phải giữ nguyên + đối soát).</p>
 */
class PayOSGatewayClientImplTest {

    private static final String CHECKSUM_KEY = "aima-test-checksum-key";
    private static final String TIMEZONE = "Asia/Ho_Chi_Minh";

    private MockWebServer server;
    private PayOSGatewayClientImpl client;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();
        client = clientWithReadTimeoutSeconds(15);
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    private PayOSGatewayClientImpl clientWithReadTimeoutSeconds(long readTimeout) {
        PayOSProperties props = new PayOSProperties(
                server.url("/").toString().replaceAll("/$", ""),
                "client-id", "api-key", CHECKSUM_KEY,
                "http://localhost:3000/billing/return",
                "http://localhost:3000/billing/return?cancel=1",
                9, 2, readTimeout);

        HttpClient httpClient = HttpClient.create()
                .responseTimeout(Duration.ofSeconds(readTimeout));
        WebClient webClient = WebClient.builder()
                .baseUrl(props.baseUrl())
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();

        PayOSMapper mapper = new PayOSMapperImpl();
        return new PayOSGatewayClientImpl(webClient, props, mapper, TIMEZONE);
    }

    private MockResponse json(String body) {
        return new MockResponse().setBody(body).addHeader("Content-Type", "application/json");
    }

    private Payment pendingPayment(long orderCode, long amount, LocalDateTime expiresAt) {
        return Payment.builder()
                .amount(amount)
                .currency("VND")
                .gateway(PaymentGateway.PAYOS)
                .gatewayTxnId(String.valueOf(orderCode))
                .expiresAt(expiresAt)
                .build();
    }

    // ------------------------------------------------------------------ tạo link

    /**
     * Kiểm luôn 4 ràng buộc dễ sai cùng lúc: {@code orderCode} là số nguyên 15 chữ số,
     * {@code amount} VND nguyên (KHÔNG nhân 100), {@code expiredAt} là Unix <b>giây</b> quy đổi
     * từ {@code expiresAt} theo APP_TIMEZONE, và chữ ký khớp đúng chuỗi 5 trường.
     */
    @Test
    void createPaymentLink_buildsRequestExactlyAsPayosRequires() throws Exception {
        server.enqueue(json("""
                {"code":"00","desc":"success","data":{
                  "checkoutUrl":"https://pay.payos.vn/web/abc123",
                  "paymentLinkId":"124c33293c43417ab7879e14c8d9eb18",
                  "orderCode":123456789012345,"amount":299000,"status":"PENDING"}}"""));

        LocalDateTime expiresAt = LocalDateTime.of(2026, 9, 22, 10, 30, 0);
        PaymentGatewayClient.GatewayLink link =
                client.createPaymentLink(pendingPayment(123456789012345L, 299000L, expiresAt), "AIMA12345");

        assertEquals("https://pay.payos.vn/web/abc123", link.checkoutUrl());
        assertEquals("124c33293c43417ab7879e14c8d9eb18", link.linkId());

        RecordedRequest request = server.takeRequest();
        assertEquals("/v2/payment-requests", request.getPath());
        assertEquals("client-id", request.getHeader("x-client-id"));
        assertEquals("api-key", request.getHeader("x-api-key"));

        JsonNode body = PayOSSignature.parse(request.getBody().readUtf8());
        assertEquals(123456789012345L, body.get("orderCode").asLong(), "orderCode phải là số nguyên");
        assertEquals(299000L, body.get("amount").asLong(), "VND nguyên, KHÔNG nhân 100");
        assertEquals("AIMA12345", body.get("description").asText());
        assertEquals(expiresAt.atZone(ZoneId.of(TIMEZONE)).toEpochSecond(),
                body.get("expiredAt").asLong(), "expiredAt là Unix GIÂY theo APP_TIMEZONE");

        String expectedSignature = PayOSSignature.hmacSha256Hex(
                PayOSSignature.createLinkData(123456789012345L, 299000L, "AIMA12345",
                        "http://localhost:3000/billing/return?cancel=1",
                        "http://localhost:3000/billing/return"),
                CHECKSUM_KEY);
        assertTrue(PayOSSignature.matches(expectedSignature, body.get("signature").asText()));
    }

    /** Description dài bị cắt TRƯỚC khi ký — nếu cắt sau thì chữ ký không khớp chuỗi gửi đi. */
    @Test
    void createPaymentLink_truncatesDescriptionBeforeSigning() throws Exception {
        server.enqueue(json("""
                {"code":"00","desc":"success","data":{
                  "checkoutUrl":"https://pay.payos.vn/web/x","paymentLinkId":"lnk"}}"""));

        client.createPaymentLink(pendingPayment(999L, 299000L, LocalDateTime.of(2026, 9, 22, 10, 30)),
                "Gói dịch vụ PRO hàng tháng");

        JsonNode body = PayOSSignature.parse(server.takeRequest().getBody().readUtf8());
        String sent = body.get("description").asText();
        assertEquals(9, sent.length(), "Trần description mặc định là 9");

        String expected = PayOSSignature.hmacSha256Hex(
                PayOSSignature.createLinkData(999L, 299000L, sent,
                        "http://localhost:3000/billing/return?cancel=1",
                        "http://localhost:3000/billing/return"),
                CHECKSUM_KEY);
        assertTrue(PayOSSignature.matches(expected, body.get("signature").asText()),
                "Chữ ký phải ký trên description ĐÃ cắt");
    }

    /** payOS báo lỗi bằng {@code code} trong body chứ không phải HTTP status. */
    @Test
    void createPaymentLink_gatewayRefusal_isConclusive() {
        server.enqueue(json("{\"code\":\"231\",\"desc\":\"Order code đã tồn tại\"}"));

        AppException ex = assertThrows(AppException.class, () ->
                client.createPaymentLink(pendingPayment(1L, 1000L, LocalDateTime.now().plusMinutes(15)), "x"));

        assertEquals(ErrorCode.PAYMENT_GATEWAY_ERROR, ex.getErrorCode());
    }

    @Test
    void createPaymentLink_httpError_isConclusive() {
        server.enqueue(new MockResponse().setResponseCode(400).setBody("{}"));

        AppException ex = assertThrows(AppException.class, () ->
                client.createPaymentLink(pendingPayment(1L, 1000L, LocalDateTime.now().plusMinutes(15)), "x"));

        assertEquals(ErrorCode.PAYMENT_GATEWAY_ERROR, ex.getErrorCode());
    }

    /**
     * ⚠️ Điểm quan trọng nhất của Bước 3. Timeout KHÔNG được quy thành
     * {@code PAYMENT_GATEWAY_ERROR}: link có thể đã tạo thành công bên payOS, đơn phải giữ
     * PENDING + {@code reconcile_required} chứ không được đóng FAILED.
     */
    @Test
    void createPaymentLink_timeout_isIndeterminate_notFailure() throws IOException {
        server.enqueue(json("{\"code\":\"00\",\"desc\":\"success\",\"data\":{}}")
                .setBodyDelay(3, TimeUnit.SECONDS));

        PayOSGatewayClientImpl impatient = clientWithReadTimeoutSeconds(1);
        AppException ex = assertThrows(AppException.class, () ->
                impatient.createPaymentLink(
                        pendingPayment(1L, 1000L, LocalDateTime.now().plusMinutes(15)), "x"));

        assertEquals(ErrorCode.PAYMENT_GATEWAY_TIMEOUT, ex.getErrorCode());
        assertNotEquals(ErrorCode.PAYMENT_GATEWAY_ERROR, ex.getErrorCode());
    }

    @Test
    void createPaymentLink_missingExpiresAt_isRejectedBeforeCallingGateway() {
        Payment payment = pendingPayment(1L, 1000L, null);

        assertThrows(AppException.class, () -> client.createPaymentLink(payment, "x"));
        assertEquals(0, server.getRequestCount(), "Không được gọi cổng khi thiếu expiresAt");
    }

    // ------------------------------------------------------------------ tra cứu / huỷ

    @Test
    void getPaymentLink_parsesStatusAndAmounts() throws Exception {
        server.enqueue(json("""
                {"code":"00","desc":"success","data":{
                  "id":"124c33293c43417ab7879e14c8d9eb18","orderCode":123,
                  "amount":299000,"amountPaid":299000,"status":"PAID"}}"""));

        PaymentGatewayClient.GatewayOrder order = client.getPaymentLink("123");

        assertEquals(GatewayLinkStatus.PAID, order.status());
        assertEquals(299000L, order.amount());
        assertEquals(299000L, order.amountPaid());
        assertEquals("124c33293c43417ab7879e14c8d9eb18", order.linkId());
        assertEquals("/v2/payment-requests/123", server.takeRequest().getPath());
    }

    /** Khách chuyển thiếu: trạng thái UNDERPAID + {@code amountPaid} nhỏ hơn {@code amount}. */
    @Test
    void getPaymentLink_underpaid_isVisibleToCaller() {
        server.enqueue(json("""
                {"code":"00","desc":"success","data":{
                  "id":"lnk","orderCode":123,"amount":299000,"amountPaid":100000,"status":"UNDERPAID"}}"""));

        PaymentGatewayClient.GatewayOrder order = client.getPaymentLink("123");

        assertEquals(GatewayLinkStatus.UNDERPAID, order.status());
        assertNotEquals(order.amount(), order.amountPaid());
    }

    /** Trạng thái lạ KHÔNG được đoán bừa — fail-safe về UNKNOWN, giữ chuỗi gốc để đối soát. */
    @Test
    void getPaymentLink_unknownStatus_failsSafe() {
        server.enqueue(json("""
                {"code":"00","desc":"success","data":{
                  "id":"lnk","orderCode":123,"amount":1,"amountPaid":0,"status":"SUCCEEDED"}}"""));

        PaymentGatewayClient.GatewayOrder order = client.getPaymentLink("123");

        assertEquals(GatewayLinkStatus.UNKNOWN, order.status());
        assertEquals("SUCCEEDED", order.rawStatus());
    }

    @Test
    void cancelPaymentLink_postsReasonToCancelPath() throws Exception {
        server.enqueue(json("{\"code\":\"00\",\"desc\":\"success\",\"data\":{\"status\":\"CANCELLED\"}}"));

        client.cancelPaymentLink("123", "REPLACED_BY_NEW_ORDER");

        RecordedRequest request = server.takeRequest();
        assertEquals("/v2/payment-requests/123/cancel", request.getPath());
        assertEquals("REPLACED_BY_NEW_ORDER",
                PayOSSignature.parse(request.getBody().readUtf8()).get("cancellationReason").asText());
    }

    // ------------------------------------------------------------------ webhook

    private String signedWebhook(String dataJson) {
        String signature = PayOSSignature.hmacSha256Hex(
                PayOSSignature.webhookData(PayOSSignature.parse(dataJson)), CHECKSUM_KEY);
        return "{\"code\":\"00\",\"desc\":\"success\",\"data\":" + dataJson
                + ",\"signature\":\"" + signature + "\"}";
    }

    @Test
    void verifyWebhook_acceptsValidSignatureAndExtractsFields() {
        String body = signedWebhook("""
                {"orderCode":123456789012345,"amount":299000,"description":"AIMA12345",
                 "reference":"TF230204212323","code":"00","desc":"Thành công",
                 "paymentLinkId":"124c33293c43417ab7879e14c8d9eb18"}""");

        PaymentGatewayClient.WebhookData data = client.verifyWebhook(body);

        assertEquals(123456789012345L, data.orderCode());
        assertEquals(299000L, data.amount());
        assertEquals("AIMA12345", data.description());
        assertEquals("00", data.code());
        assertEquals("124c33293c43417ab7879e14c8d9eb18", data.paymentLinkId());
    }

    @Test
    void verifyWebhook_rejectsTamperedSignature() {
        String body = signedWebhook("{\"orderCode\":123,\"amount\":299000}")
                .replaceAll("\"signature\":\"[0-9a-f]{64}\"", "\"signature\":\"" + "0".repeat(64) + "\"");

        AppException ex = assertThrows(AppException.class, () -> client.verifyWebhook(body));
        assertEquals(ErrorCode.PAYMENT_SIGNATURE_INVALID, ex.getErrorCode());
    }

    /**
     * Fail-safe chẩn đoán: chữ ký ký theo biến thể định dạng số CÒN LẠI thì vẫn bị từ chối
     * (không kích hoạt gói), nhưng trả mã riêng để luồng webhook bật {@code reconcile_required}
     * và admin thấy ngay nguyên nhân thay vì mò.
     */
    @Test
    void verifyWebhook_signatureFromAlternateNumberStyle_isDiagnosedNotJustRejected() {
        String dataJson = "{\"orderCode\":123,\"amount\":299000,\"rate\":1234.50}";
        String alternate = PayOSSignature.hmacSha256Hex(
                PayOSSignature.webhookData(PayOSSignature.parse(dataJson),
                        PayOSSignature.ACTIVE_STYLE.other()),
                CHECKSUM_KEY);
        String body = "{\"code\":\"00\",\"data\":" + dataJson + ",\"signature\":\"" + alternate + "\"}";

        AppException ex = assertThrows(AppException.class, () -> client.verifyWebhook(body));

        assertEquals(ErrorCode.PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH, ex.getErrorCode());
    }

    @Test
    void verifyWebhook_rejectsMissingDataObject() {
        AppException ex = assertThrows(AppException.class, () ->
                client.verifyWebhook("{\"code\":\"00\",\"signature\":\"" + "0".repeat(64) + "\"}"));
        assertEquals(ErrorCode.PAYMENT_SIGNATURE_INVALID, ex.getErrorCode());
    }

    // ------------------------------------------------------------------ cấu hình

    /** Thiếu credential phải chặn lúc GỌI (app vẫn boot được khi chạy cổng giả lập). */
    @Test
    void missingCredentials_failAtCallTime_notAtStartup() {
        PayOSProperties blank = new PayOSProperties(
                "http://localhost", "", "", "", "r", "c", 9, 2, 15);
        PayOSGatewayClientImpl unconfigured = new PayOSGatewayClientImpl(
                WebClient.builder().build(), blank, new PayOSMapperImpl(), TIMEZONE);

        AppException ex = assertThrows(AppException.class, () -> unconfigured.getPaymentLink("1"));
        assertEquals(ErrorCode.PAYMENT_GATEWAY_NOT_CONFIGURED, ex.getErrorCode());
    }

    @Test
    void gateway_identifiesItselfForBeanSelection() {
        assertEquals(PaymentGateway.PAYOS, client.gateway());
    }
}
