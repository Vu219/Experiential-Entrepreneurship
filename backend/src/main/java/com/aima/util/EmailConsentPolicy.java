package com.aima.util;

import com.aima.entity.UserNotificationPreference;

/**
 * Quyết định DUY NHẤT có gửi email lỗi đăng bài hay không (gọi trong PublishFailureNotifierImpl, trước Brevo):
 * máy chủ bật {@code AIMA_PUBLISH_EMAIL_ENABLED} VÀ người dùng đã đồng ý ({@code emailPublishErrors}). Thiếu dòng
 * preference = chưa đồng ý. Thông báo trong app không phụ thuộc vào đây.
 */
public final class EmailConsentPolicy {

    private EmailConsentPolicy() {
    }

    public static boolean shouldSend(boolean serverEnabled, UserNotificationPreference preference, String email) {
        return serverEnabled && preference != null && preference.isEmailPublishErrors()
                && email != null && !email.isBlank();
    }
}
