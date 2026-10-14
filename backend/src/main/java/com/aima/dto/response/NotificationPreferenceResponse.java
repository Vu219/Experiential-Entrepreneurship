package com.aima.dto.response;

import com.aima.enums.EmailPromptStatus;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.List;

/** Cài đặt thông báo của user: email lỗi đăng bài (opt-in) + kênh trong app/toast theo nhóm. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class NotificationPreferenceResponse {
    boolean emailPublishErrors;
    EmailPromptStatus emailPromptStatus;
    Instant consentAt;
    /** Máy chủ có bật gửi email lỗi đăng bài không (AIMA_PUBLISH_EMAIL_ENABLED) — tắt thì FE không hỏi người dùng. */
    boolean emailAvailable;

    /** Kênh theo nhóm đã áp mặc định (thứ tự cố định theo {@code NotificationCategory}). */
    List<NotificationChannelResponse> channels;
}
