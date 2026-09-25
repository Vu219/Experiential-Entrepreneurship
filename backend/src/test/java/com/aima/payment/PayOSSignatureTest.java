package com.aima.payment;

import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.util.PayOSSignature;
import com.aima.util.PayOSSignature.NumberStyle;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Chữ ký payOS — khoá bằng test vector sinh từ <b>oracle chạy chính thuật toán ký của SDK
 * payOS (Node)</b>, chép nguyên văn {@code sortObjDataByKey} + {@code convertObjToQueryStr},
 * nên vector mang đúng ngữ nghĩa {@code Number.prototype.toString()} / {@code JSON.stringify}
 * của JS. V0 kiểm chéo riêng phần HMAC bằng RFC 4231 Test Case 2 (oracle không tự chứng minh
 * được chính nó).
 *
 * <p>Viết TRƯỚC {@link PayOSSignature}. Không sửa vector để test xanh — sai lệch nghĩa là code
 * sai, vì đây là hợp đồng với payOS, không phải quy ước nội bộ.</p>
 */
class PayOSSignatureTest {

    private static final String CHECKSUM_KEY = "aima-test-checksum-key";

    private static final String CANCEL_URL = "http://localhost:3000/billing/return?cancel=1";
    private static final String RETURN_URL = "http://localhost:3000/billing/return";

    private static String sign(String data) {
        return PayOSSignature.hmacSha256Hex(data, CHECKSUM_KEY);
    }

    // ---------------------------------------------------------------- V0: HMAC known-answer

    /**
     * RFC 4231 Test Case 2 — kiểm HMAC + hex + charset độc lập với mọi quy ước của payOS và
     * độc lập với oracle. Đỏ ở đây thì phần HMAC sai, đừng đi soi chuỗi ký.
     */
    @Test
    void hmacSha256Hex_matchesRfc4231TestCase2() {
        assertEquals(
                "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
                PayOSSignature.hmacSha256Hex("what do ya want for nothing?", "Jefe"));
    }

    /** Hex phải viết thường — payOS trả chữ ký lowercase. */
    @Test
    void hmacSha256Hex_returnsLowercaseHex() {
        String sig = sign("abc");
        assertEquals(64, sig.length());
        assertEquals(sig.toLowerCase(), sig);
    }

    // ------------------------------------------------- V1: chuỗi ký tạo link, KHÔNG URL-encode

    /**
     * Đúng 5 trường, xếp alphabet, giữ nguyên xi {@code ?} và {@code =} trong URL.
     * URL-encode ở đây là lỗi kinh điển: {@code encodeURIComponent} CHỈ áp cho API Payouts.
     */
    @Test
    void createLinkData_keepsUrlQueryStringVerbatim() {
        String data = PayOSSignature.createLinkData(
                123456789012345L, 299000L, "AIMA12345", CANCEL_URL, RETURN_URL);

        assertEquals("amount=299000"
                + "&cancelUrl=http://localhost:3000/billing/return?cancel=1"
                + "&description=AIMA12345"
                + "&orderCode=123456789012345"
                + "&returnUrl=http://localhost:3000/billing/return", data);

        assertEquals("9f8ecef73c4c5e3b1de8fdfb7bb4a5f87435142d6cc71886cf075993f093f6e7", sign(data));
    }

    /** V3 — dấu tiếng Việt: PIN bytes UTF-8, không phụ thuộc default charset của JVM. */
    @Test
    void createLinkData_vietnameseDescription_signedAsUtf8() {
        String description = "Gói dịch vụ PRO";
        assertEquals(15, description.length(),
                "File nguồn phải được đọc bằng UTF-8 — số này lệch nghĩa là hỏng encoding, không phải hỏng HMAC");

        String data = PayOSSignature.createLinkData(999L, 299000L, description, CANCEL_URL, RETURN_URL);

        assertEquals("2c17b0bfd9e2e29dd28af292798fd508d8d28f705566f5abc56e8b8043358a00", sign(data));
    }

    // --------------------------------------------------------- V4: object `data` của webhook

    /**
     * Ví dụ 16 field đúng theo tài liệu payOS, bọc trong envelope webhook thật:
     * ký trên object {@code data}, so với {@code signature} ở CẤP NGOÀI CÙNG.
     */
    @Test
    void webhookData_signsPayosDocumentationExample() {
        String rawBody = """
                {"code":"00","desc":"success","success":true,
                 "data":{"orderCode":123,"amount":3000,"description":"VQRIO123","accountNumber":"12345678",
                  "reference":"TF230204212323","transactionDateTime":"2023-02-04 18:25:00","currency":"VND",
                  "paymentLinkId":"124c33293c43417ab7879e14c8d9eb18","code":"00","desc":"Thành công",
                  "counterAccountBankId":"","counterAccountBankName":"","counterAccountName":"",
                  "counterAccountNumber":"","virtualAccountName":"","virtualAccountNumber":""},
                 "signature":"572678d69a6ef34072d32af0e88fc2c2a4808eed96b41d47dd20a092a9376ef3"}""";

        JsonNode payload = PayOSSignature.parse(rawBody);
        String data = PayOSSignature.webhookData(payload.get("data"));

        assertEquals("accountNumber=12345678&amount=3000&code=00"
                + "&counterAccountBankId=&counterAccountBankName=&counterAccountName=&counterAccountNumber="
                + "&currency=VND&desc=Thành công&description=VQRIO123&orderCode=123"
                + "&paymentLinkId=124c33293c43417ab7879e14c8d9eb18&reference=TF230204212323"
                + "&transactionDateTime=2023-02-04 18:25:00"
                + "&virtualAccountName=&virtualAccountNumber=", data);

        assertTrue(PayOSSignature.matches(sign(data), payload.get("signature").asText()));
    }

    // ------------------------------- V5: hai biến thể định dạng số — chỉ một bộ được bật

    private static final String V5_RAW = """
            {"orderCode":9007199254740991,"amount":0,"rate":1234.50,"nullField":null,
             "items":[{"name":"PRO","quantity":1}],"zzzUnknownFutureField":"abc"}""";

    /**
     * BIẾN THỂ ĐANG DÙNG — {@code rate} ra {@code 1234.5} y như SDK.
     * {@code 2^53-1} phải ra số nguyên đầy đủ, không ra ký hiệu mũ.
     * {@code zzzUnknownFutureField} chứng minh không hard-code danh sách key.
     */
    @Test
    void webhookData_jsNumberStyle_isTheActiveVariant() {
        assertEquals(NumberStyle.JS, PayOSSignature.ACTIVE_STYLE);

        String data = PayOSSignature.webhookData(PayOSSignature.parse(V5_RAW));

        assertEquals("amount=0"
                + "&items=[{\"name\":\"PRO\",\"quantity\":1}]"
                + "&nullField="
                + "&orderCode=9007199254740991"
                + "&rate=1234.5"
                + "&zzzUnknownFutureField=abc", data);

        assertEquals("354a5f39e62d2445ac134daae2eb76bea7eac6bbe6d91d0f9d3b8a3d1c45af53", sign(data));
    }

    /**
     * BIẾN THỂ DỰ PHÒNG — giữ scale ({@code rate=1234.50}). Vector sinh bằng oracle Python.
     *
     * <p>Cố tình giữ lại để lật quyết định chỉ mất một dòng: đổi
     * {@code PayOSSignature.ACTIVE_STYLE} sang {@link NumberStyle#EXACT_SCALE}, bỏ
     * {@code @Disabled} ở đây và gắn {@code @Disabled} cho test bên trên. Xem
     * {@code docs/PAYMENT.md} mục scale.</p>
     */
    @Test
    @Disabled("Biến thể không dùng — bật lại khi đảo ACTIVE_STYLE sang EXACT_SCALE")
    void webhookData_exactScaleNumberStyle_standbyVariant() {
        String data = PayOSSignature.webhookData(PayOSSignature.parse(V5_RAW), NumberStyle.EXACT_SCALE);

        assertEquals("amount=0"
                + "&items=[{\"name\":\"PRO\",\"quantity\":1}]"
                + "&nullField="
                + "&orderCode=9007199254740991"
                + "&rate=1234.50"
                + "&zzzUnknownFutureField=abc", data);

        assertEquals("a12458f3e9345f3c33a742c4f2b27a9a81b1993c77ea288ffbdf7082e461224f", sign(data));
    }

    // ------------------------------------------------- V6: mảng — sắp key, escape, khoảng trắng

    /**
     * Ba thứ cùng lúc, đúng như oracle SDK trả:
     * <ul>
     *   <li>key của <b>từng phần tử</b> mảng bị sắp lại ({@code meta,name,quantity});</li>
     *   <li>object lồng SÂU HƠN ({@code meta}) <b>KHÔNG</b> bị sắp — giữ {@code zz} trước
     *       {@code aa}, vì {@code sortObjDataByKey} của SDK không đệ quy;</li>
     *   <li>{@code JSON.stringify} không có khoảng trắng sau {@code :} và {@code ,}; chuỗi bên
     *       trong được bọc nháy kép, {@code "} escape thành {@code \\"}, còn ký tự ngoài ASCII
     *       (tiếng Việt, en dash) giữ NGUYÊN không escape; {@code 1500.50} → {@code 1500.5}.</li>
     * </ul>
     */
    @Test
    void webhookData_sortsArrayElementKeysOneLevelAndEscapesLikeJsonStringify() {
        String raw = """
                {"orderCode":7,"items":[
                   {"quantity":2,"name":"Gói \\"PRO\\" – dịch vụ","meta":{"zz":1,"aa":2}},
                   {"price":1500.50,"label":"x"}
                 ]}""";

        String data = PayOSSignature.webhookData(PayOSSignature.parse(raw));

        assertEquals("items=[{\"meta\":{\"zz\":1,\"aa\":2},"
                + "\"name\":\"Gói \\\"PRO\\\" – dịch vụ\",\"quantity\":2},"
                + "{\"label\":\"x\",\"price\":1500.5}]"
                + "&orderCode=7", data);

        assertEquals("b47a3a8995955132edfe8a1e80bd894b445ef0662a19eb2e970eaeaba0426089", sign(data));
    }

    // -------------------------------------------------------- V7 / V8: các quirk khác của SDK

    /**
     * Value là object (không phải mảng) → SDK nhét thẳng vào template literal nên ra đúng chữ
     * {@code [object Object]}. Mất thông tin, nhưng SDK là spec — không "sửa cho hợp lý".
     */
    @Test
    void webhookData_plainObjectValue_becomesObjectObjectLikeTheSdk() {
        String data = PayOSSignature.webhookData(PayOSSignature.parse("{\"orderCode\":8,\"payer\":{\"b\":2,\"a\":1}}"));

        assertEquals("orderCode=8&payer=[object Object]", data);
        assertEquals("376f540252aad4ae208db1ad3c0c31abc51cf0616e9fc039601da43626568eab", sign(data));
    }

    /** Số nguyên viết dạng thập phân mất đuôi {@code .0}; {@code -0.0} ra {@code 0}. */
    @Test
    void webhookData_jsNumberToStringSemantics() {
        String data = PayOSSignature.webhookData(
                PayOSSignature.parse("{\"a\":1000.0,\"b\":1.0,\"c\":0.50,\"d\":-0.0,\"e\":9007199254740991}"));

        assertEquals("a=1000&b=1&c=0.5&d=0&e=9007199254740991", data);
        assertEquals("61c734e759205faf251a300864e1494c6559d076d26dfc65c5c3b93f58530351", sign(data));
    }

    /**
     * Quirk: chuỗi có giá trị đúng bằng {@code "null"} / {@code "undefined"} bị SDK coi như
     * rỗng (nó kiểm bằng {@code includes} trên giá trị đã convert).
     */
    @Test
    void webhookData_stringLiteralNullAndUndefined_becomeEmpty() {
        assertEquals("a=&b=&c=null-ish",
                PayOSSignature.webhookData(
                        PayOSSignature.parse("{\"a\":\"null\",\"b\":\"undefined\",\"c\":\"null-ish\"}")));
    }

    /**
     * RANH GIỚI ĐÃ BIẾT, không phải bug: vượt {@code 2^53-1} thì SDK đi qua {@code double} và
     * làm tròn ({@code 12345678901234567890} → {@code 12345678901234567000}), còn ta giữ chính
     * xác. Cố ý không mô phỏng: miền dữ liệu payOS không chạm ngưỡng này ({@code amount} VND
     * nguyên, {@code orderCode} 15 chữ số) và đi qua {@code double} là thứ §5 điểm A cấm.
     */
    @Test
    void webhookData_beyondJsSafeInteger_keepsExactDigits_knownDivergence() {
        assertEquals("big=12345678901234567890",
                PayOSSignature.webhookData(PayOSSignature.parse("{\"big\":12345678901234567890}")));
    }

    /** Thiếu field thì đơn giản là không xuất hiện — không chèn key rỗng bù vào. */
    @Test
    void webhookData_omitsAbsentFieldsEntirely() {
        assertEquals("amount=3000&orderCode=123",
                PayOSSignature.webhookData(PayOSSignature.parse("{\"orderCode\":123,\"amount\":3000}")));
    }

    @Test
    void webhookData_rejectsNonObject() {
        assertThrows(AppException.class, () -> PayOSSignature.webhookData(null));
        assertThrows(AppException.class, () -> PayOSSignature.webhookData(PayOSSignature.parse("[1,2]")));
    }

    // ------------------------------------------------------------------------------- parse()

    /**
     * 🚨 TRIPWIRE JACKSON. Chuỗi ký được phép đi qua {@code double} ở đâu đó thì test này đỏ
     * đầu tiên: {@code 1234.50} chỉ giữ được scale khi mapper bật
     * {@code USE_BIG_DECIMAL_FOR_FLOATS} VÀ tắt {@code STRIP_TRAILING_BIGDECIMAL_ZEROES}.
     * Đổi sang Jackson 3 hay "dọn" cấu hình mapper sẽ đỏ ngay tại đây thay vì vỡ chữ ký âm
     * thầm ngoài production.
     *
     * <p>Cố ý kiểm bằng {@link NumberStyle#EXACT_SCALE}: biến thể JS đang dùng có cắt số 0 nên
     * <b>không</b> phân biệt được đường BigDecimal với đường double.</p>
     */
    @Test
    void parse_keepsExactDecimalScale_jacksonTripwire() {
        JsonNode node = PayOSSignature.parse("{\"rate\":1234.50}").get("rate");
        assertTrue(node.isBigDecimal(), "Phải bật USE_BIG_DECIMAL_FOR_FLOATS");
        assertEquals("1234.50", node.decimalValue().toPlainString(),
                "Phải tắt JsonNodeFeature.STRIP_TRAILING_BIGDECIMAL_ZEROES");

        assertEquals("rate=1234.50",
                PayOSSignature.webhookData(PayOSSignature.parse("{\"rate\":1234.50}"), NumberStyle.EXACT_SCALE));
    }

    @Test
    void parse_rejectsMalformedBody() {
        AppException ex = assertThrows(AppException.class, () -> PayOSSignature.parse("{not json"));
        assertEquals(ErrorCode.PAYMENT_SIGNATURE_INVALID, ex.getErrorCode());
        assertThrows(AppException.class, () -> PayOSSignature.parse(null));
        assertThrows(AppException.class, () -> PayOSSignature.parse("   "));
    }

    // ------------------------------------------------------------------------------ matches()

    @Test
    void matches_ignoresHexCase() {
        String sig = sign("abc");
        assertTrue(PayOSSignature.matches(sig, sig.toUpperCase()));
        assertTrue(PayOSSignature.matches(sig.toUpperCase(), sig));
    }

    @Test
    void matches_rejectsWrongSignatureAndNulls() {
        String sig = sign("abc");
        assertFalse(PayOSSignature.matches(sig, sign("abd")));
        assertFalse(PayOSSignature.matches(sig, null));
        assertFalse(PayOSSignature.matches(null, sig));
        assertFalse(PayOSSignature.matches(null, null));
        assertFalse(PayOSSignature.matches(sig, ""));
    }

    /** Hai biến thể phải cho chuỗi KHÁC nhau — nếu không thì log chẩn đoán ở Bước 3 vô nghĩa. */
    @Test
    void numberStyle_otherReturnsTheOppositeVariant() {
        assertEquals(NumberStyle.EXACT_SCALE, NumberStyle.JS.other());
        assertEquals(NumberStyle.JS, NumberStyle.EXACT_SCALE.other());

        JsonNode data = PayOSSignature.parse(V5_RAW);
        assertNotEquals(PayOSSignature.webhookData(data, NumberStyle.JS),
                PayOSSignature.webhookData(data, NumberStyle.EXACT_SCALE));
    }
}
