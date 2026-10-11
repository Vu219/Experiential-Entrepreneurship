package com.aima.service;

import com.aima.dto.request.NotificationPreferenceRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.NotificationPreferenceResponse;
import com.aima.dto.response.UnsubscribeResponse;
import com.aima.entity.UserNotificationPreference;

import java.util.UUID;

/** Đồng ý nhận email lỗi đăng bài (opt-in) + link huỷ nhận không cần đăng nhập. */
public interface NotificationPreferenceService {

    /** GET /users/me/notification-preferences. */
    ApiResponse<NotificationPreferenceResponse> get(String email);

    /** PUT /users/me/notification-preferences — bật (ghi consentAt) / tắt; đánh dấu đã trả lời câu hỏi. */
    ApiResponse<NotificationPreferenceResponse> update(String email, NotificationPreferenceRequest request);

    /** POST /notifications/unsubscribe?token= (công khai) — tắt email lỗi đăng bài của chủ token. */
    ApiResponse<UnsubscribeResponse> unsubscribe(String token);

    /** Preference hiện tại (chưa có dòng → mặc định không nhận). */
    UserNotificationPreference preferenceOf(UUID userId);

    /** Token có chữ ký + hạn dùng cho link huỷ nhận trong email. */
    String unsubscribeToken(UUID userId);
}
