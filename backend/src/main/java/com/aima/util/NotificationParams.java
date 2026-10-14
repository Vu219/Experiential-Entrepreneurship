package com.aima.util;

import java.time.temporal.TemporalAccessor;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tham số của thông báo ({@code notifications.params}) — FE dựng câu bằng khoá {@code ntf_<TYPE>_title/_body}
 * (thêm hậu tố {@code _<variant>} khi có tham số {@code variant}). Giá trị null bị bỏ; enum → tên; thời gian → ISO.
 */
public final class NotificationParams {

    /** Biến thể câu của cùng một loại (vd RECONNECT_NEEDED: HELD / EXPIRED / PUBLISH_ERROR). */
    public static final String VARIANT = "variant";

    private NotificationParams() {
    }

    /** {@code of("platform", Platform.FACEBOOK, "accountName", name, ...)} — cặp khoá/giá trị. */
    public static Map<String, Object> of(Object... keyValues) {
        if (keyValues.length % 2 != 0) {
            throw new IllegalArgumentException("NotificationParams.of cần cặp khoá/giá trị");
        }
        Map<String, Object> params = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            Object value = keyValues[i + 1];
            if (value == null) continue;
            if (value instanceof Enum<?> e) value = e.name();
            else if (value instanceof TemporalAccessor || value instanceof java.util.UUID) value = value.toString();
            params.put(String.valueOf(keyValues[i]), value);
        }
        return params;
    }
}
