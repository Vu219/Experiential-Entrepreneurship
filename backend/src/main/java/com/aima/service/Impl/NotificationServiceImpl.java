package com.aima.service.Impl;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.NotificationResponse;
import com.aima.dto.response.PageResponse;
import com.aima.entity.Notification;
import com.aima.entity.User;
import com.aima.enums.NotificationType;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.NotificationMapper;
import com.aima.repository.NotificationRepository;
import com.aima.repository.UserRepository;
import com.aima.service.NotificationService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Thông báo in-app (FR-75..FR-79): danh sách phân trang + đánh dấu đã đọc; các worker/scheduler
 * phát thông báo qua {@link #notify} (best-effort, không phá luồng gọi).
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class NotificationServiceImpl implements NotificationService {

    NotificationRepository notificationRepository;
    UserRepository userRepository;
    NotificationMapper notificationMapper;

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<NotificationResponse>> list(String email, boolean unreadOnly, int page, int size) {
        User user = currentUser(email);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50));
        Page<Notification> result = unreadOnly
                ? notificationRepository.findByUser_IdAndReadAtIsNullAndDeletedAtIsNullOrderByCreatedAtDesc(user.getId(), pageable)
                : notificationRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(user.getId(), pageable);

        List<NotificationResponse> content = notificationMapper.toResponseList(result.getContent());
        PageResponse<NotificationResponse> response = PageResponse.from(result, content);
        return ApiResponse.success("Lấy danh sách thông báo thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<Long> unreadCount(String email) {
        User user = currentUser(email);
        long count = notificationRepository.countByUser_IdAndReadAtIsNullAndDeletedAtIsNull(user.getId());
        return ApiResponse.success("Lấy số thông báo chưa đọc thành công", count);
    }

    @Override
    public ApiResponse<NotificationResponse> markRead(String email, UUID notificationId) {
        User user = currentUser(email);
        Notification notification = notificationRepository
                .findByIdAndUser_IdAndDeletedAtIsNull(notificationId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.NOTIFICATION_NOT_FOUND));

        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
            notification = notificationRepository.save(notification);
        }
        NotificationResponse response = notificationMapper.toResponse(notification);
        return ApiResponse.success("Đã đánh dấu thông báo là đã đọc", response);
    }

    @Override
    public ApiResponse<Long> markAllRead(String email) {
        User user = currentUser(email);
        long updated = notificationRepository.markAllRead(user.getId(), LocalDateTime.now());
        return ApiResponse.success("Đã đánh dấu tất cả thông báo là đã đọc", updated);
    }

    @Override
    public void notify(User user, NotificationType type, String title, String message, UUID refId) {
        try {
            Notification notification = notificationMapper.toNotification(user, type, title, message, refId);
            notificationRepository.save(notification);
        } catch (Exception e) {
            // Best-effort: thông báo hỏng không được phá luồng đăng bài/tạo nội dung đang gọi.
            log.error("[Notification] Không thể tạo thông báo {} cho user {}", type, user.getId(), e);
        }
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
