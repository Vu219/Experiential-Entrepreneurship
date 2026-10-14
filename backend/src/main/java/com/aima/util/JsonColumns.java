package com.aima.util;

import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Đọc/ghi cột jsonb lưu dạng {@code String} trên entity (quy ước sẵn có: LandingSection, PostMetricSnapshot).
 * Dữ liệu hỏng không làm vỡ response — đọc lỗi trả danh sách rỗng + log.
 */
@Slf4j
public final class JsonColumns {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private JsonColumns() {
    }

    /** null/rỗng → null (cột để trống thay vì "[]"). */
    public static String write(List<?> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(values);
        } catch (JacksonException e) {
            log.warn("[JsonColumns] Không ghi được JSON: {}", e.getMessage());
            return null;
        }
    }

    /** Map null/rỗng → null (cột để trống thay vì "{}"). */
    public static String writeMap(Map<String, ?> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(values);
        } catch (JacksonException e) {
            log.warn("[JsonColumns] Không ghi được JSON: {}", e.getMessage());
            return null;
        }
    }

    /** JSON object → Map (giữ thứ tự khoá); null/hỏng → Map rỗng. */
    public static Map<String, Object> readMap(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            return MAPPER.readValue(json, MAPPER.getTypeFactory().constructMapType(LinkedHashMap.class, String.class, Object.class));
        } catch (JacksonException e) {
            log.warn("[JsonColumns] JSON hỏng, bỏ qua: {}", e.getMessage());
            return new LinkedHashMap<>();
        }
    }

    public static <T> List<T> readList(String json, Class<T> elementType) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return MAPPER.readValue(json, MAPPER.getTypeFactory().constructCollectionType(List.class, elementType));
        } catch (JacksonException e) {
            log.warn("[JsonColumns] JSON hỏng, bỏ qua: {}", e.getMessage());
            return List.of();
        }
    }
}
