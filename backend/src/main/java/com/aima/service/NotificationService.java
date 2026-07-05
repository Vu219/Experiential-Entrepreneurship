package com.aima.service;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.NotificationResponse;
import com.aima.dto.response.PageResponse;
import com.aima.entity.User;
import com.aima.enums.NotificationType;

import java.util.UUID;

public interface NotificationService {

    ApiResponse<PageResponse<NotificationResponse>> list(String email, boolean unreadOnly, int page, int size);

    ApiResponse<Long> unreadCount(String email);

    ApiResponse<NotificationResponse> markRead(String email, UUID notificationId);

    ApiResponse<Long> markAllRead(String email);

    /**
     * Phát một thông báo (dùng nội bộ từ worker/scheduler — FR-75..FR-79). Best-effort:
     * lỗi chỉ log, KHÔNG ném ra để không phá luồng nghiệp vụ đang gọi.
     */
    void notify(User user, NotificationType type, String title, String message, UUID refId);
}
