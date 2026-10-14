package com.aima.dto.response;

import com.aima.enums.NotificationCategory;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Một dòng của ma trận nhóm × kênh (Cài đặt → Thông báo). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class NotificationChannelResponse {
    NotificationCategory category;
    boolean inApp;
    boolean toast;
    /** "Trong app" luôn bật — FE hiển thị ô khoá. */
    boolean mandatoryInApp;
    /** Có email (dùng chung {@code emailPublishErrors}). */
    boolean emailCapable;
    /** Chỉ admin thấy nhóm này. */
    boolean adminOnly;
}
