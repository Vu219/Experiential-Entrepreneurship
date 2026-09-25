package com.aima.service.Impl;

import com.aima.config.PayOSProperties;
import com.aima.config.PayOSWebClientConfig;
import com.aima.dto.payos.CancelPaymentLinkPayload;
import com.aima.dto.payos.CreatePaymentLinkPayload;
import com.aima.entity.Payment;
import com.aima.enums.GatewayLinkStatus;
import com.aima.enums.PaymentGateway;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PayOSMapper;
import com.aima.service.PaymentGatewayClient;
import com.aima.util.PayOSSignature;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.ZoneId;

/**
 * Cổng thật payOS. Là nơi DUY NHẤT gọi HTTP sang payOS (cùng vai trò {@code MetaApiClient} với
 * Meta) — không gọi payOS từ chỗ khác.
 *
 * <p><b>Phân loại lỗi là phần quan trọng nhất của lớp này.</b> Hai nhánh không được lẫn:</p>
 * <ul>
 *   <li>Cổng ĐỌC ĐƯỢC request rồi từ chối ({@code code != "00"}, hoặc HTTP <b>4xx</b>) → kết
 *       luận được → {@link ErrorCode#PAYMENT_GATEWAY_ERROR}, đơn có thể đóng.</li>
 *   <li>Mọi thứ còn lại — timeout, lỗi mạng, HTTP 5xx — → <b>không</b> kết luận được: link có
 *       thể đã tạo/đã huỷ thành công bên payOS → {@link ErrorCode#PAYMENT_GATEWAY_TIMEOUT},
 *       đơn giữ nguyên trạng thái + {@code reconcile_required}.</li>
 * </ul>
 *
 * <p><b>Đừng phân loại theo KIỂU ngoại lệ.</b> Read-timeout xảy ra sau khi header đã về vẫn
 * ném {@code WebClientResponseException}, mang status {@code 200} — test
 * {@code createPaymentLink_timeout_isIndeterminate_notFailure} bắt đúng bẫy này.</p>
 *
 * <p>Không bao giờ log {@code apiKey}/{@code checksumKey}/chữ ký.</p>
 */
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class PayOSGatewayClientImpl implements PaymentGatewayClient {

    private static final String PATH_PAYMENT_REQUESTS = "/v2/payment-requests";
    /** payOS báo thành công bằng chuỗi "00", không phải HTTP status. */
    private static final String CODE_SUCCESS = "00";

    WebClient webClient;
    PayOSProperties properties;
    PayOSMapper payosMapper;
    ZoneId appZone;

    public PayOSGatewayClientImpl(@Qualifier("payosWebClient") WebClient webClient,
                                  PayOSProperties properties,
                                  PayOSMapper payosMapper,
                                  @Value("${APP_TIMEZONE:UTC}") String appTimezone) {
        this.webClient = webClient;
        this.properties = properties;
        this.payosMapper = payosMapper;
        this.appZone = ZoneId.of(appTimezone);
    }

    @Override
    public PaymentGateway gateway() {
        return PaymentGateway.PAYOS;
    }

    // ------------------------------------------------------------------ tạo link

    @Override
    public GatewayLink createPaymentLink(Payment payment, String description) {
        requireConfigured();
        long orderCode = orderCodeOf(payment);
        long amount = payment.getAmount();
        String desc = truncateDescription(description);

        if (payment.getExpiresAt() == null) {
            log.error("[payOS] Đơn {} thiếu expiresAt — không dựng được expiredAt gửi cổng", orderCode);
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR);
        }
        // expiresAt là mốc DUY NHẤT (điểm E §5): đếm ngược phía user và expiredAt phía cổng
        // phải cùng một giá trị, nên chỉ quy đổi chứ không tính lại.
        long expiredAt = payment.getExpiresAt().atZone(appZone).toEpochSecond();

        String signature = PayOSSignature.hmacSha256Hex(
                PayOSSignature.createLinkData(orderCode, amount, desc,
                        properties.cancelUrl(), properties.returnUrl()),
                properties.checksumKey());

        CreatePaymentLinkPayload payload = payosMapper.toCreatePayload(
                orderCode, amount, desc, properties.returnUrl(), properties.cancelUrl(),
                expiredAt, signature);

        JsonNode data = post(PATH_PAYMENT_REQUESTS, payload, "tạo link " + orderCode);
        String checkoutUrl = text(data, "checkoutUrl");
        if (checkoutUrl == null || checkoutUrl.isBlank()) {
            log.error("[payOS] Tạo link {} thành công nhưng thiếu checkoutUrl", orderCode);
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR);
        }
        return new GatewayLink(checkoutUrl, text(data, "paymentLinkId"));
    }

    // ------------------------------------------------------------------ tra cứu / huỷ

    @Override
    public GatewayOrder getPaymentLink(String orderCode) {
        requireConfigured();
        JsonNode data = get(PATH_PAYMENT_REQUESTS + "/" + orderCode, "tra cứu " + orderCode);

        String rawStatus = text(data, "status");
        GatewayLinkStatus status = GatewayLinkStatus.from(rawStatus);
        if (status == GatewayLinkStatus.UNKNOWN) {
            log.error("[payOS] Trạng thái lạ '{}' cho đơn {} — cần đối soát tay", rawStatus, orderCode);
        }
        // checkoutUrl thường KHÔNG có ở endpoint tra cứu — đọc best-effort, null là bình thường.
        return new GatewayOrder(status, longOrNull(data, "amount"), longOrNull(data, "amountPaid"),
                text(data, "id"), text(data, "checkoutUrl"), rawStatus);
    }

    @Override
    public void cancelPaymentLink(String orderCode, String reason) {
        requireConfigured();
        CancelPaymentLinkPayload payload = payosMapper.toCancelPayload(reason);
        post(PATH_PAYMENT_REQUESTS + "/" + orderCode + "/cancel", payload, "huỷ link " + orderCode);
    }

    // ------------------------------------------------------------------ webhook

    @Override
    public WebhookData verifyWebhook(String rawBody) {
        requireConfigured();
        JsonNode payload = PayOSSignature.parse(rawBody);
        JsonNode data = payload.get("data");
        String received = text(payload, "signature");

        String expected = PayOSSignature.hmacSha256Hex(
                PayOSSignature.webhookData(data), properties.checksumKey());

        if (!PayOSSignature.matches(expected, received)) {
            // Bảo hiểm cho đúng chỗ không xác minh được: nếu chữ ký khớp với biến thể định
            // dạng số CÒN LẠI thì nguyên nhân đã rõ ngay trên log, thay vì mò nửa ngày.
            // Chỉ nêu TÊN biến thể — không log chữ ký, checksumKey hay payload.
            PayOSSignature.NumberStyle alternate = PayOSSignature.ACTIVE_STYLE.other();
            String alternateSignature = PayOSSignature.hmacSha256Hex(
                    PayOSSignature.webhookData(data, alternate), properties.checksumKey());
            if (PayOSSignature.matches(alternateSignature, received)) {
                log.error("[payOS] Chữ ký khớp với biến thể format số thay thế ({}) — "
                        + "xem docs/PAYMENT.md mục scale", alternate);
                throw new AppException(ErrorCode.PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH);
            }
            // Không nêu lý do (điểm F §5): endpoint webhook là public, đừng biến nó thành
            // công cụ dò chữ ký.
            log.warn("[payOS] Webhook có chữ ký không hợp lệ — bỏ qua");
            throw new AppException(ErrorCode.PAYMENT_SIGNATURE_INVALID);
        }

        return new WebhookData(
                requiredLong(data, "orderCode"),
                requiredLong(data, "amount"),
                text(data, "description"),
                text(data, "reference"),
                text(data, "code"),
                text(data, "desc"),
                text(data, "paymentLinkId"));
    }

    // ------------------------------------------------------------------ HTTP

    private JsonNode post(String path, Object body, String what) {
        try {
            String raw = webClient.post()
                    .uri(path)
                    .header(PayOSWebClientConfig.HEADER_CLIENT_ID, properties.clientId())
                    .header(PayOSWebClientConfig.HEADER_API_KEY, properties.apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            return unwrap(raw, what);
        } catch (WebClientResponseException e) {
            throw classify(what, e);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw indeterminate(what, e);
        }
    }

    private JsonNode get(String path, String what) {
        try {
            String raw = webClient.get()
                    .uri(path)
                    .header(PayOSWebClientConfig.HEADER_CLIENT_ID, properties.clientId())
                    .header(PayOSWebClientConfig.HEADER_API_KEY, properties.apiKey())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            return unwrap(raw, what);
        } catch (WebClientResponseException e) {
            throw classify(what, e);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw indeterminate(what, e);
        }
    }

    /** Envelope payOS: {@code {code, desc, data, signature}} — {@code code} mới là kết quả thật. */
    private JsonNode unwrap(String raw, String what) {
        JsonNode body = PayOSSignature.parse(raw);
        String code = text(body, "code");
        if (!CODE_SUCCESS.equals(code)) {
            log.warn("[payOS] {} bị từ chối: code={} desc={}", what, code, text(body, "desc"));
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR);
        }
        JsonNode data = body.get("data");
        if (data == null || !data.isObject()) {
            log.error("[payOS] {} trả code=00 nhưng thiếu object data", what);
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR);
        }
        observeResponseSignature(body, data, what);
        return data;
    }

    /**
     * Kiểm chữ ký trên RESPONSE API — <b>chỉ quan sát, KHÔNG BAO GIỜ chặn</b>.
     *
     * <p>Quy ước ký cho response chưa xác minh được (khác webhook, vốn có tài liệu riêng).
     * Đoán sai quy ước sẽ làm hỏng <b>100% lần tạo link</b>, trong khi rủi ro bỏ qua gần bằng 0:
     * webhook mới là nguồn sự thật và ở đó ta đã so {@code amount} tuyệt đối. Nên ở đây chỉ
     * log để thu thập bằng chứng, rồi đi tiếp.</p>
     *
     * <p>Khi có tài khoản thật và xác minh được quy ước, mới nâng lên thành kiểm bắt buộc —
     * đã ghi vào checklist {@code docs/PAYMENT.md}.</p>
     */
    private void observeResponseSignature(JsonNode body, JsonNode data, String what) {
        try {
            String received = text(body, "signature");
            if (received == null || received.isBlank()) {
                log.warn("[payOS] {}: response không có field signature — bỏ qua kiểm "
                        + "(quy ước ký response chưa xác minh)", what);
                return;
            }
            for (PayOSSignature.NumberStyle style : PayOSSignature.NumberStyle.values()) {
                String expected = PayOSSignature.hmacSha256Hex(
                        PayOSSignature.webhookData(data, style), properties.checksumKey());
                if (PayOSSignature.matches(expected, received)) {
                    if (style == PayOSSignature.ACTIVE_STYLE) {
                        log.debug("[payOS] {}: chữ ký response khớp", what);
                    } else {
                        log.warn("[payOS] {}: chữ ký response khớp biến thể {} — vẫn đi tiếp",
                                what, style);
                    }
                    return;
                }
            }
            log.warn("[payOS] {}: chữ ký response không khớp biến thể nào — vẫn đi tiếp "
                    + "(quy ước ký response chưa xác minh)", what);
        } catch (RuntimeException e) {
            // Kiểm chữ ký response là việc phụ — hỏng ở đây không được phép làm hỏng tạo link.
            log.warn("[payOS] {}: không kiểm được chữ ký response: {}", what, e.getMessage());
        }
    }

    /**
     * Phân loại một {@link WebClientResponseException}. <b>Không được dựa vào kiểu ngoại lệ</b>:
     * read-timeout xảy ra SAU khi header đã về cũng ném đúng kiểu này, mang theo status
     * {@code 200} — quy nó thành "cổng từ chối" là đóng nhầm một đơn có thể đã tạo link.
     *
     * <p>Chỉ {@code 4xx} mới là kết luận: payOS đã đọc request và từ chối chính nó (chữ ký sai,
     * orderCode trùng…). {@code 5xx} và mọi status khác → không kết luận: thà để đơn chờ đối
     * soát còn hơn đóng nhầm đơn khách đã trả tiền.</p>
     */
    private AppException classify(String what, WebClientResponseException e) {
        if (e.getStatusCode().value() == 404) {
            // Bằng chứng link CHƯA TỪNG tồn tại → người gọi được phép đóng đơn treo.
            log.warn("[payOS] {}: cổng báo không có link này (404)", what);
            return new AppException(ErrorCode.PAYMENT_GATEWAY_LINK_NOT_FOUND);
        }
        if (e.getStatusCode().is4xxClientError()) {
            log.warn("[payOS] {} bị từ chối: HTTP {}", what, e.getStatusCode());
            return new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR);
        }
        return indeterminate(what, e);
    }

    /**
     * Không có câu trả lời → KHÔNG kết luận. Người gọi phải giữ nguyên trạng thái đơn và bật
     * {@code reconcile_required}; tuyệt đối không set FAILED ở đây.
     */
    private AppException indeterminate(String what, Exception e) {
        log.warn("[payOS] {} không kết luận được (timeout/mạng): {}", what, e.getMessage());
        return new AppException(ErrorCode.PAYMENT_GATEWAY_TIMEOUT);
    }

    // ------------------------------------------------------------------ tiện ích

    private void requireConfigured() {
        if (isBlank(properties.clientId()) || isBlank(properties.apiKey())
                || isBlank(properties.checksumKey())) {
            log.error("[payOS] Thiếu PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY");
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_NOT_CONFIGURED);
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private long orderCodeOf(Payment payment) {
        try {
            return Long.parseLong(payment.getGatewayTxnId());
        } catch (NumberFormatException | NullPointerException e) {
            log.error("[payOS] gatewayTxnId không phải orderCode hợp lệ: {}", payment.getGatewayTxnId());
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR);
        }
    }

    /**
     * payOS giới hạn độ dài {@code description} (mặc định 9 — trần an toàn cho tài khoản ngân
     * hàng chưa liên kết). Cắt ở ĐÂY, trước khi ký, để chữ ký luôn khớp chuỗi thật sự gửi đi.
     */
    private String truncateDescription(String description) {
        String value = description == null ? "" : description.trim();
        int max = properties.descriptionMaxLength();
        if (value.length() <= max) {
            return value;
        }
        log.debug("[payOS] Cắt description từ {} xuống {} ký tự", value.length(), max);
        return value.substring(0, max);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static Long longOrNull(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || !value.isNumber() ? null : value.asLong();
    }

    /** Tiền/orderCode so sánh bằng {@code long}, không qua float (điểm A §5). */
    private static long requiredLong(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || !value.isNumber()) {
            throw new AppException(ErrorCode.PAYMENT_SIGNATURE_INVALID);
        }
        return value.asLong();
    }
}
