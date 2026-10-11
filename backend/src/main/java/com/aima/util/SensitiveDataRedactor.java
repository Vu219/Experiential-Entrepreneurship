package com.aima.util;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Hàm redact DÙNG CHUNG cho mọi chuỗi có thể chứa bí mật/PII trước khi ghi log, lưu vào DB
 * (vd {@code posting_jobs.error_detail}, {@code publish_results.response_message}) hay trả cho admin
 * (NFR-06, SEC-03). Che: token/secret trong query string, form body và JSON; header Authorization /
 * Cookie; JWT; token Meta (EAA…/TH…/IGQ…) và chuỗi token dài bất kỳ; email (giữ ký tự đầu + domain);
 * số điện thoại VN. KHÔNG che id bài/Trang (chuỗi số ngắn) để admin còn đối chiếu được.
 *
 * <p>Hàm thuần, không phụ thuộc Spring — {@code MetaApiClientImpl.mask} uỷ quyền sang đây.</p>
 */
public final class SensitiveDataRedactor {

    public static final String MASK = "***";

    private static final String SECRET_KEYS =
            "access_token|refresh_token|client_secret|appsecret_proof|fb_exchange_token|th_exchange_token"
                    + "|input_token|api_key|apikey|password|secret|signature";

    private record Rule(Pattern pattern, String replacement) {
    }

    private static final List<Rule> RULES = List.of(
            // key=value trong URL/form body: access_token=EAAB... → access_token=***
            new Rule(Pattern.compile("(?i)\\b(" + SECRET_KEYS + ")=([^&\\s\"'<>]+)"), "$1=" + MASK),
            // JSON: "access_token": "..." → "access_token":"***"
            new Rule(Pattern.compile("(?i)(\"(?:" + SECRET_KEYS + "|token)\"\\s*:\\s*\")[^\"]*(\")"), "$1" + MASK + "$2"),
            // Header Authorization / Proxy-Authorization (có hoặc không có scheme)
            new Rule(Pattern.compile("(?i)\\b((?:proxy-)?authorization)\\s*[:=]\\s*(?:bearer|basic)?\\s*[^\\s,;\"']+"),
                    "$1: " + MASK),
            new Rule(Pattern.compile("(?i)\\bbearer\\s+[A-Za-z0-9._~+/=-]+"), "Bearer " + MASK),
            // Header Cookie / Set-Cookie: che cả dòng giá trị
            new Rule(Pattern.compile("(?i)\\b(set-cookie|cookie)\\s*[:=]\\s*[^\\r\\n\"]+"), "$1: " + MASK),
            // JWT (header.payload.signature)
            new Rule(Pattern.compile("\\beyJ[A-Za-z0-9_-]{5,}\\.[A-Za-z0-9_-]{5,}\\.[A-Za-z0-9_-]{5,}"), MASK),
            // Token Meta: Facebook EAA…, Threads TH…, Instagram IGQ…
            new Rule(Pattern.compile("\\b(?:EAA|IGQ)[A-Za-z0-9]{20,}"), MASK),
            new Rule(Pattern.compile("\\bTH[A-Za-z0-9]{40,}"), MASK),
            // Chuỗi token dài bất kỳ (id bài/Trang ngắn hơn nhiều nên không bị che)
            new Rule(Pattern.compile("\\b[A-Za-z0-9_-]{64,}\\b"), MASK),
            // Email: giữ ký tự đầu + domain để admin còn nhận ra
            new Rule(Pattern.compile("\\b([A-Za-z0-9])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\\.[A-Za-z]{2,})\\b"), "$1" + MASK + "@$2"),
            // Số điện thoại VN: 0xxxxxxxxx / +84xxxxxxxxx
            new Rule(Pattern.compile("(?<![\\d_])(?:\\+?84|0)\\d{9,10}(?![\\d_])"), MASK));

    private SensitiveDataRedactor() {
    }

    /** Che mọi bí mật/PII nhận diện được; null → null. */
    public static String redact(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        String result = value;
        for (Rule rule : RULES) {
            result = rule.pattern().matcher(result).replaceAll(rule.replacement());
        }
        return result;
    }

    /** Redact rồi cắt độ dài (cột text vẫn nên có trần để một payload khổng lồ không phình DB/log). */
    public static String redact(String value, int maxLength) {
        String redacted = redact(value);
        if (redacted == null || redacted.length() <= maxLength) {
            return redacted;
        }
        return redacted.substring(0, Math.max(0, maxLength - 1)) + "…";
    }
}
