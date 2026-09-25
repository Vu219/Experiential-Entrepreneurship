package com.aima.util;

import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.cfg.JsonNodeFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HexFormat;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Ký và kiểm chữ ký payOS (HMAC-SHA256 với {@code checksumKey}).
 *
 * <h2>⛔ KHÔNG ĐƯỢC ĐỔI SANG JACKSON 3 ({@code tools.jackson})</h2>
 * Classpath có CẢ HAI Jackson (Boot 4 mặc định Jackson 3). Lớp này cố ý dùng
 * <b>Jackson 2</b> ({@code com.fasterxml.jackson}) theo tiền lệ {@code MetaApiClientImpl}.
 * Đây KHÔNG phải import lỡ tay — "dọn import" sang Jackson 3 sẽ đổi cách dựng node số và
 * <b>làm vỡ chữ ký một cách âm thầm</b> (request bị từ chối, không có stack trace).
 * Chốt chặn: {@code PayOSSignatureTest.parse_keepsExactDecimalScale_jacksonTripwire} sẽ đỏ
 * ngay nếu thư viện hoặc cấu hình mapper bị đổi. Đụng vào thì chạy cả file test đó.
 *
 * <h2>Hai quy ước ký, không được lẫn</h2>
 * <ul>
 *   <li>{@link #createLinkData} — khi TẠO link: đúng 5 trường, xếp alphabet,
 *       <b>giữ nguyên xi</b>, không URL-encode. ({@code encodeURIComponent} chỉ áp cho
 *       API Payouts/chi tiền, không áp cho payment-requests.)</li>
 *   <li>{@link #webhookData} — khi VERIFY webhook: ký trên object {@code data}
 *       (<b>không</b> phải cả payload), mọi key có mặt đều vào chuỗi, xếp alphabet.
 *       So với trường {@code signature} ở cấp ngoài cùng.</li>
 * </ul>
 *
 * <p>Body phải đi qua {@link #parse} rồi đọc dạng {@link JsonNode} — TUYỆT ĐỐI không
 * deserialize vào POJO trước khi ký và không đi qua {@code double}.</p>
 *
 * <p>Hành vi được khoá bằng test vector sinh từ <b>oracle chạy chính thuật toán của SDK payOS
 * (Node)</b>, chép nguyên văn; V0 kiểm chéo phần HMAC bằng RFC 4231 Test Case 2.
 * Sửa lớp này thì chạy lại {@code PayOSSignatureTest}, đừng sửa vector.</p>
 */
@Slf4j
public final class PayOSSignature {

    private static final String HMAC_SHA256 = "HmacSHA256";

    /**
     * Cách biến một số JSON thành text trong chuỗi ký.
     *
     * <p>{@link #JS} là biến thể ĐANG DÙNG; {@link #EXACT_SCALE} chỉ còn dùng để
     * <b>chẩn đoán</b> khi chữ ký lệch (xem {@link #other()}).</p>
     */
    public enum NumberStyle {
        /** Mô phỏng {@code Number.prototype.toString()} của JS — bỏ số 0 thừa. */
        JS,
        /** Giữ nguyên scale như text JSON gốc ({@code 1234.50}). */
        EXACT_SCALE;

        /** Biến thể còn lại. Dùng cho log chẩn đoán, KHÔNG dùng để kích hoạt gói. */
        public NumberStyle other() {
            return this == JS ? EXACT_SCALE : JS;
        }
    }

    /**
     * Biến thể đang dùng. <b>Lật lại quyết định = đổi đúng dòng này.</b>
     *
     * <p>Chọn {@link NumberStyle#JS} vì chữ ký do <b>backend payOS</b> sinh, còn SDK Node là
     * client đã được chứng minh verify khớp với backend đó → hành vi SDK chính là spec thực
     * tế. SDK ký {@code 1234.5}; ta ký {@code 1234.50} thì ta sai, dù giữ scale "đúng" hơn về
     * mặt số học. (Quyết định này ĐẢO NGƯỢC §5 điểm A của {@code docs/PAYMENT_PROGRESS.md}.)</p>
     */
    public static final NumberStyle ACTIVE_STYLE = NumberStyle.JS;

    /**
     * Parse phải GIỮ NGUYÊN text số gốc, vì {@link NumberStyle#EXACT_SCALE} cần nó và vì
     * không được đi qua {@code double}. Hai cấu hình đều bắt buộc:
     * {@code USE_BIG_DECIMAL_FOR_FLOATS} một mình là chưa đủ — từ Jackson 2.15,
     * {@code STRIP_TRAILING_BIGDECIMAL_ZEROES} BẬT mặc định và gọi
     * {@code BigDecimal.stripTrailingZeros()} ngay lúc dựng {@code DecimalNode}
     * (node vẫn {@code isBigDecimal() == true} nên nhìn qua tưởng đã đúng).
     */
    private static final ObjectMapper MAPPER = JsonMapper.builder()
            .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
            .disable(JsonNodeFeature.STRIP_TRAILING_BIGDECIMAL_ZEROES)
            .build();

    private PayOSSignature() {
    }

    /**
     * Parse body thô của payOS. Dùng CHỖ NÀY cho mọi payload payOS (webhook lẫn response API)
     * để số không bị biến dạng trước khi ký.
     *
     * @throws AppException body rỗng hoặc không phải JSON hợp lệ — không kiểm được chữ ký
     */
    public static JsonNode parse(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_SIGNATURE_INVALID);
        }
        try {
            return MAPPER.readTree(rawBody);
        } catch (JsonProcessingException e) {
            log.warn("[payOS] Body không phải JSON hợp lệ: {}", e.getOriginalMessage());
            throw new AppException(ErrorCode.PAYMENT_SIGNATURE_INVALID);
        }
    }

    /**
     * Chuỗi ký khi tạo link thanh toán: đúng 5 trường này, đúng thứ tự alphabet, không encode.
     * Giá trị lấy từ cấu hình/đơn hàng của ta nên đã được validate ở tầng gọi.
     */
    public static String createLinkData(long orderCode, long amount, String description,
                                        String cancelUrl, String returnUrl) {
        return "amount=" + amount
                + "&cancelUrl=" + cancelUrl
                + "&description=" + description
                + "&orderCode=" + orderCode
                + "&returnUrl=" + returnUrl;
    }

    /** Chuỗi ký của object {@code data} webhook theo biến thể đang dùng ({@link #ACTIVE_STYLE}). */
    public static String webhookData(JsonNode data) {
        return webhookData(data, ACTIVE_STYLE);
    }

    /**
     * Chuỗi ký của object {@code data} trong webhook: MỌI key có mặt, xếp alphabet,
     * nối {@code key=value&...}.
     *
     * <p>Cố tình KHÔNG hard-code danh sách field: payOS thêm field mới thì chuỗi vẫn ký đủ,
     * bớt field thì field đó đơn giản là không xuất hiện.</p>
     *
     * <p>Các quy tắc dưới đây chép theo {@code convertObjToQueryStr} của SDK payOS, kể cả
     * mấy chỗ trông kỳ quặc — SDK là spec thực tế, không phải chỗ để ta "sửa cho hợp lý":</p>
     * <ul>
     *   <li>{@code null} → chuỗi rỗng. Chuỗi có giá trị đúng bằng {@code "null"} /
     *       {@code "undefined"} <b>cũng</b> thành rỗng (SDK kiểm bằng {@code includes}).</li>
     *   <li>Mảng → {@code JSON.stringify} sau khi <b>sắp key của từng phần tử</b>.</li>
     *   <li>Object (không phải mảng) → đúng chữ {@code [object Object]}, vì SDK nhét thẳng
     *       vào template literal. Mất thông tin, nhưng khớp SDK.</li>
     * </ul>
     *
     * @param style dùng {@link #ACTIVE_STYLE}; biến thể kia chỉ để chẩn đoán
     * @throws AppException {@code data} null hoặc không phải object JSON
     */
    public static String webhookData(JsonNode data, NumberStyle style) {
        if (data == null || !data.isObject()) {
            throw new AppException(ErrorCode.PAYMENT_SIGNATURE_INVALID);
        }
        List<String> names = new ArrayList<>();
        data.fieldNames().forEachRemaining(names::add);
        Collections.sort(names);

        StringBuilder sb = new StringBuilder();
        for (String name : names) {
            if (!sb.isEmpty()) {
                sb.append('&');
            }
            sb.append(name).append('=').append(fieldValue(data.get(name), style));
        }
        return sb.toString();
    }

    /**
     * Một số JSON → text trong chuỗi ký. <b>Đây là hàm DUY NHẤT quyết định định dạng số</b> —
     * mọi tranh cãi về scale chỉ nằm ở đây.
     *
     * <p>{@link NumberStyle#JS} mô phỏng {@code Number.prototype.toString()}: số nguyên không
     * có {@code .0}, phần thập phân bỏ số 0 thừa ({@code 1234.50} → {@code 1234.5},
     * {@code 1000.0} → {@code 1000}, {@code -0.0} → {@code 0}). Dùng
     * {@code stripTrailingZeros().toPlainString()} — {@code toPlainString()} là bắt buộc,
     * thiếu nó {@code 1000.0} ra ký hiệu mũ {@code 1E+3}.</p>
     *
     * <p><b>Ranh giới đã biết</b>: ta đọc từ text gốc nên KHÔNG bao giờ đi qua {@code double},
     * còn SDK thì có. Hai bên cho kết quả giống hệt nhau với mọi giá trị biểu diễn chính xác
     * được bằng IEEE-754 double — tức mọi số nguyên {@code |n| <= 2^53-1} và mọi số payOS thực
     * sự gửi ({@code amount} là VND nguyên, {@code orderCode} 15 chữ số &lt; 2^53). Vượt ngưỡng
     * đó SDK làm tròn còn ta giữ chính xác (vd {@code 12345678901234567890} → SDK ra
     * {@code 12345678901234567000}). Ta CỐ Ý không mô phỏng phần mất mát này: nó không xảy ra
     * trong miền dữ liệu của mình và đi qua {@code double} là thứ §5 điểm A cấm.</p>
     */
    public static String formatJsonNumber(JsonNode node, NumberStyle style) {
        if (node.isIntegralNumber()) {
            return node.asText();
        }
        BigDecimal value = node.decimalValue();
        return style == NumberStyle.JS
                ? value.stripTrailingZeros().toPlainString()
                : value.toPlainString();
    }

    /** Giá trị một field ở cấp ngoài cùng của {@code data}. */
    private static String fieldValue(JsonNode node, NumberStyle style) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return "";
        }
        if (node.isArray()) {
            return stringifyArray(node, style);
        }
        if (node.isObject()) {
            return "[object Object]";
        }
        if (node.isNumber()) {
            return formatJsonNumber(node, style);
        }
        String text = node.asText();
        // Quirk của SDK: chuỗi "null"/"undefined" bị coi như giá trị rỗng.
        return "null".equals(text) || "undefined".equals(text) ? "" : text;
    }

    /**
     * Mảng ở cấp ngoài cùng: SDK gọi {@code sortObjDataByKey} cho <b>từng phần tử</b> rồi mới
     * {@code JSON.stringify}.
     *
     * <p>Đúng <b>MỘT cấp</b> sắp xếp, không đệ quy: {@code sortObjDataByKey} tự nó không đệ
     * quy, nên object nằm sâu hơn bên trong phần tử giữ NGUYÊN thứ tự gốc. Làm đệ quy thật sẽ
     * lệch khỏi SDK — oracle đã xác nhận: {@code {"zz":1,"aa":2}} lồng trong một phần tử vẫn
     * ra {@code {"zz":1,"aa":2}}.</p>
     */
    private static String stringifyArray(JsonNode array, NumberStyle style) {
        StringBuilder sb = new StringBuilder("[");
        for (JsonNode element : array) {
            if (sb.length() > 1) {
                sb.append(',');
            }
            sb.append(stringify(element, style, element.isObject()));
        }
        return sb.append(']').toString();
    }

    /** {@code JSON.stringify} thu gọn — không khoảng trắng sau {@code :} và {@code ,}. */
    private static String stringify(JsonNode node, NumberStyle style, boolean sortKeys) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return "null";
        }
        if (node.isNumber()) {
            return formatJsonNumber(node, style);
        }
        if (node.isBoolean()) {
            return node.asText();
        }
        if (node.isTextual()) {
            return quote(node.textValue());
        }
        if (node.isArray()) {
            StringBuilder items = new StringBuilder("[");
            for (JsonNode element : node) {
                if (items.length() > 1) {
                    items.append(',');
                }
                items.append(stringify(element, style, false));
            }
            return items.append(']').toString();
        }
        StringBuilder sb = new StringBuilder("{");
        for (Iterator<Map.Entry<String, JsonNode>> it = orderedFields(node, sortKeys); it.hasNext(); ) {
            Map.Entry<String, JsonNode> field = it.next();
            if (sb.length() > 1) {
                sb.append(',');
            }
            sb.append(quote(field.getKey())).append(':').append(stringify(field.getValue(), style, false));
        }
        return sb.append('}').toString();
    }

    private static Iterator<Map.Entry<String, JsonNode>> orderedFields(JsonNode node, boolean sortKeys) {
        if (!sortKeys) {
            return node.fields();
        }
        List<Map.Entry<String, JsonNode>> fields = new ArrayList<>();
        node.fields().forEachRemaining(fields::add);
        fields.sort(Map.Entry.comparingByKey());
        return fields.iterator();
    }

    /**
     * Escape chuỗi đúng như {@code JSON.stringify}: chỉ {@code "}, {@code \} và ký tự điều
     * khiển; ký tự ngoài ASCII (tiếng Việt, en dash…) giữ nguyên. Viết tay để chuỗi ký không
     * phụ thuộc vào cấu hình/phiên bản của thư viện JSON.
     */
    private static String quote(String raw) {
        StringBuilder sb = new StringBuilder(raw.length() + 2).append('"');
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.append('"').toString();
    }

    /** HMAC-SHA256 → hex viết thường. Bytes UTF-8 tường minh, không phụ thuộc charset của JVM. */
    public static String hmacSha256Hex(String data, String checksumKey) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(checksumKey.getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            log.error("[payOS] Không tính được HMAC — kiểm tra PAYOS_CHECKSUM_KEY", e);
            throw new AppException(ErrorCode.PAYMENT_SIGNATURE_INVALID);
        }
    }

    /**
     * So chữ ký theo thời gian hằng số ({@link MessageDigest#isEqual}, KHÔNG dùng
     * {@code String.equals}). Chuẩn hoá chữ thường vì hex hoa/thường là cùng một giá trị;
     * null bất kỳ bên nào → không khớp.
     */
    public static boolean matches(String expected, String actual) {
        if (expected == null || actual == null) {
            return false;
        }
        return MessageDigest.isEqual(
                expected.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8),
                actual.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
    }
}
