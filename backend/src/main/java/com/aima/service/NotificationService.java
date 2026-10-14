package com.aima.service;

import com.aima.dto.notification.NotificationDraft;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.NotificationResponse;
import com.aima.dto.response.PageResponse;
import com.aima.entity.User;
import com.aima.enums.NotificationType;

import java.util.UUID;

public interface NotificationService {

    /**
     * @param status   {@code all} | {@code unread} (null = theo {@code unreadOnly}, giữ tương thích client cũ)
     * @param category tên {@code NotificationCategory} (null = mọi nhóm)
     */
    ApiResponse<PageResponse<NotificationResponse>> list(String email, String status, String category,
                                                         boolean unreadOnly, int page, int size);

    ApiResponse<Long> unreadCount(String email);

    ApiResponse<NotificationResponse> markRead(String email, UUID notificationId);

    ApiResponse<Long> markAllRead(String email);

    /** Xoá mềm một thông báo của chính user. */
    ApiResponse<Void> delete(String email, UUID notificationId);

    /** Xoá mềm mọi thông báo đã đọc; trả số bản ghi. */
    ApiResponse<Long> deleteRead(String email);

    /**
     * Phát một thông báo (API nội bộ cho worker/scheduler — FR-75..FR-79). Thứ tự: đọc cài đặt kênh của nhóm → tắt
     * "trong app" (nhóm không bắt buộc) thì KHÔNG tạo bản ghi, không đẩy SSE → chống trùng theo {@code dedupeKey} →
     * INSERT trong transaction của nơi gọi, đếm chưa đọc ngay trong transaction → SAU COMMIT đẩy
     * {@code notification.created}. <b>Best-effort</b>: lỗi chỉ log, không ném ra.
     *
     * @return true nếu vừa tạo bản ghi (false = tắt kênh / đã có từ trước / lỗi) — caller dùng để chỉ gửi email một lần
     */
    boolean send(User user, NotificationDraft draft);

    /** {@link #send} cho mọi admin đang ACTIVE (dedupeKey được thêm hậu tố id admin). */
    void sendToAdmins(NotificationDraft draft);

    /** Dạng cũ (không params / ref_type) — giữ cho nơi gọi chưa chuyển sang {@link #send}. */
    void notify(User user, NotificationType type, String title, String message, UUID refId);

    /** Như {@link #notify} nhưng chỉ gửi MỘT lần cho mỗi {@code dedupeKey}. */
    boolean notifyOnce(User user, NotificationType type, String title, String message, UUID refId, String dedupeKey);
}
