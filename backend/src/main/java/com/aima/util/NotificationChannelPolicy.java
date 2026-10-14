package com.aima.util;

import com.aima.enums.NotificationCategory;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;

/**
 * Cài đặt kênh thông báo theo nhóm (cột {@code user_notification_preferences.channels}). Hàm thuần — một nguồn cho
 * "nhóm này có tạo bản ghi / bật toast không": khoá thiếu → mặc định của {@link NotificationCategory}; nhóm bắt buộc
 * ({@code mandatoryInApp}) luôn bật "trong app" dù JSON ghi gì.
 */
@Slf4j
public final class NotificationChannelPolicy {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();
    private static final String IN_APP = "inApp";
    private static final String TOAST = "toast";

    private NotificationChannelPolicy() {
    }

    public record Channel(boolean inApp, boolean toast) {
    }

    /** Một thay đổi: null = giữ nguyên. */
    public record Change(Boolean inApp, Boolean toast) {
    }

    public static Map<NotificationCategory, Channel> resolve(String json) {
        JsonNode stored = parse(json);
        Map<NotificationCategory, Channel> result = new EnumMap<>(NotificationCategory.class);
        for (NotificationCategory category : NotificationCategory.values()) {
            JsonNode node = stored.get(category.name());
            boolean inApp = node != null && node.has(IN_APP) ? node.get(IN_APP).asBoolean() : category.isDefaultInApp();
            boolean toast = node != null && node.has(TOAST) ? node.get(TOAST).asBoolean() : category.isDefaultToast();
            result.put(category, new Channel(inApp || category.isMandatoryInApp(), toast));
        }
        return result;
    }

    public static Channel of(String json, NotificationCategory category) {
        return resolve(json).get(category);
    }

    /**
     * Gộp thay đổi vào JSON đang lưu. Khoá phải là tên {@link NotificationCategory} (không phân biệt hoa thường) —
     * khoá lạ → {@code NOTIFICATION_CATEGORY_INVALID}. Tắt "trong app" của nhóm bắt buộc bị bỏ qua (luôn bật).
     */
    public static String merge(String json, Map<String, Change> changes) {
        ObjectNode stored = parse(json);
        for (Map.Entry<String, Change> entry : changes.entrySet()) {
            NotificationCategory category = category(entry.getKey());
            Change change = entry.getValue();
            if (change == null) continue;
            JsonNode existing = stored.get(category.name());
            ObjectNode node = existing instanceof ObjectNode object ? object : MAPPER.createObjectNode();
            if (change.inApp() != null) node.put(IN_APP, change.inApp() || category.isMandatoryInApp());
            if (change.toast() != null) node.put(TOAST, change.toast());
            stored.set(category.name(), node);
        }
        return stored.toString();
    }

    private static NotificationCategory category(String key) {
        try {
            return NotificationCategory.valueOf(key == null ? "" : key.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.NOTIFICATION_CATEGORY_INVALID);
        }
    }

    private static ObjectNode parse(String json) {
        if (json == null || json.isBlank()) return MAPPER.createObjectNode();
        try {
            JsonNode node = MAPPER.readTree(json);
            return node instanceof ObjectNode object ? object : MAPPER.createObjectNode();
        } catch (JacksonException e) {
            log.warn("[NotificationChannels] JSON cài đặt hỏng, dùng mặc định: {}", e.getMessage());
            return MAPPER.createObjectNode();
        }
    }
}
