package com.aima.service.Impl;

import com.aima.dto.notification.NotificationDraft;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.NotificationResponse;
import com.aima.dto.response.PageResponse;
import com.aima.entity.Notification;
import com.aima.entity.User;
import com.aima.enums.NotificationCategory;
import com.aima.enums.NotificationType;
import com.aima.enums.RealtimeEventType;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.NotificationMapper;
import com.aima.mapper.RealtimeMapper;
import com.aima.repository.NotificationRepository;
import com.aima.repository.NotificationSpecifications;
import com.aima.repository.UserRepository;
import com.aima.service.NotificationPreferenceService;
import com.aima.service.NotificationService;
import com.aima.service.RealtimeEventPublisher;
import com.aima.util.NotificationChannelPolicy;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Thông báo in-app (FR-75..FR-79): danh sách phân trang + đánh dấu đã đọc + xoá; các worker/scheduler phát thông báo
 * qua {@link #send} (best-effort, không phá luồng gọi). Mọi thay đổi đẩy sự kiện SSE SAU COMMIT để badge / danh sách
 * ở mọi tab cập nhật ngay.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class NotificationServiceImpl implements NotificationService {

    static final String ADMIN_ROLE = "ADMIN";
    static final String STATUS_ALL = "all";
    static final String STATUS_UNREAD = "unread";

    NotificationRepository notificationRepository;
    UserRepository userRepository;
    NotificationMapper notificationMapper;
    NotificationPreferenceService preferenceService;
    RealtimeEventPublisher realtimeEventPublisher;
    RealtimeMapper realtimeMapper;

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<NotificationResponse>> list(String email, String status, String category,
                                                                boolean unreadOnly, int page, int size) {
        User user = currentUser(email);
        boolean unread = unreadOnly;
        if (status != null && !status.isBlank()) {
            String normalized = status.trim().toLowerCase(Locale.ROOT);
            if (!STATUS_ALL.equals(normalized) && !STATUS_UNREAD.equals(normalized)) {
                throw new AppException(ErrorCode.NOTIFICATION_FILTER_INVALID);
            }
            unread = STATUS_UNREAD.equals(normalized);
        }
        List<NotificationType> types = category == null || category.isBlank() ? null : typesOf(category);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Notification> result = notificationRepository.findAll(
                NotificationSpecifications.forUser(user.getId(), unread, types), pageable);

        List<NotificationResponse> content = notificationMapper.toResponseList(result.getContent());
        PageResponse<NotificationResponse> response = PageResponse.from(result, content);
        return ApiResponse.success("Lấy danh sách thông báo thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<Long> unreadCount(String email) {
        User user = currentUser(email);
        long count = countUnread(user.getId());
        return ApiResponse.success("Lấy số thông báo chưa đọc thành công", count);
    }

    @Override
    public ApiResponse<NotificationResponse> markRead(String email, UUID notificationId) {
        User user = currentUser(email);
        Notification notification = owned(user, notificationId);

        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
            notification = notificationRepository.saveAndFlush(notification);
            realtimeEventPublisher.toUser(user.getId(), RealtimeEventType.NOTIFICATION_READ,
                    realtimeMapper.toNotificationReadEvent(List.of(notificationId), null, countUnread(user.getId())));
        }
        NotificationResponse response = notificationMapper.toResponse(notification);
        return ApiResponse.success("Đã đánh dấu thông báo là đã đọc", response);
    }

    @Override
    public ApiResponse<Long> markAllRead(String email) {
        User user = currentUser(email);
        long updated = notificationRepository.markAllRead(user.getId(), LocalDateTime.now());
        realtimeEventPublisher.toUser(user.getId(), RealtimeEventType.NOTIFICATION_READ,
                realtimeMapper.toNotificationReadEvent(null, true, countUnread(user.getId())));
        return ApiResponse.success("Đã đánh dấu tất cả thông báo là đã đọc", updated);
    }

    @Override
    public ApiResponse<Void> delete(String email, UUID notificationId) {
        User user = currentUser(email);
        Notification notification = owned(user, notificationId);
        notification.setDeletedAt(LocalDateTime.now());
        notificationRepository.saveAndFlush(notification);
        realtimeEventPublisher.toUser(user.getId(), RealtimeEventType.NOTIFICATION_DELETED,
                realtimeMapper.toNotificationDeletedEvent(List.of(notificationId), null, countUnread(user.getId())));
        return ApiResponse.success("Đã xoá thông báo");
    }

    @Override
    public ApiResponse<Long> deleteRead(String email) {
        User user = currentUser(email);
        long deleted = notificationRepository.softDeleteRead(user.getId(), LocalDateTime.now());
        realtimeEventPublisher.toUser(user.getId(), RealtimeEventType.NOTIFICATION_DELETED,
                realtimeMapper.toNotificationDeletedEvent(null, true, countUnread(user.getId())));
        return ApiResponse.success("Đã xoá các thông báo đã đọc", deleted);
    }

    @Override
    public boolean send(User user, NotificationDraft draft) {
        try {
            NotificationType type = draft.type();
            NotificationChannelPolicy.Channel channel = NotificationChannelPolicy.of(
                    preferenceService.preferenceOf(user.getId()).getChannels(), type.getCategory());
            if (!channel.inApp() && !type.isAlwaysInApp()) {
                return false; // người dùng tắt nhóm này — không bản ghi, không SSE (email là đường riêng)
            }
            if (draft.dedupeKey() != null && notificationRepository.existsByDedupeKey(draft.dedupeKey())) {
                return false;
            }
            Notification saved = notificationRepository.saveAndFlush(
                    notificationMapper.toNotification(user, draft, draft.dedupeKey()));
            long unread = countUnread(user.getId());
            NotificationResponse dto = notificationMapper.toResponse(saved);
            realtimeEventPublisher.toUser(user.getId(), RealtimeEventType.NOTIFICATION_CREATED, saved.getId().toString(),
                    realtimeMapper.toNotificationCreatedEvent(dto, unread, channel.toast()));
            return true;
        } catch (Exception e) {
            // Best-effort: thông báo hỏng không được phá luồng đăng bài/tạo nội dung đang gọi.
            log.error("[Notification] Không thể tạo thông báo {} ({}) cho user {}", draft.type(), draft.dedupeKey(),
                    user.getId(), e);
            return false;
        }
    }

    @Override
    public void sendToAdmins(NotificationDraft draft) {
        try {
            for (User admin : userRepository.findActiveByRoleName(ADMIN_ROLE, UserStatus.ACTIVE)) {
                String key = draft.dedupeKey() == null ? null : draft.dedupeKey() + ":" + admin.getId();
                send(admin, NotificationDraft.builder().type(draft.type()).title(draft.title()).message(draft.message())
                        .refType(draft.refType()).refId(draft.refId()).params(draft.params()).dedupeKey(key).build());
            }
        } catch (Exception e) {
            log.error("[Notification] Không gửi được thông báo {} cho admin", draft.type(), e);
        }
    }

    @Override
    public void notify(User user, NotificationType type, String title, String message, UUID refId) {
        send(user, NotificationDraft.builder().type(type).title(title).message(message).refId(refId).build());
    }

    @Override
    public boolean notifyOnce(User user, NotificationType type, String title, String message, UUID refId, String dedupeKey) {
        return send(user, NotificationDraft.builder().type(type).title(title).message(message).refId(refId)
                .dedupeKey(dedupeKey).build());
    }

    private long countUnread(UUID userId) {
        return notificationRepository.countByUser_IdAndReadAtIsNullAndDeletedAtIsNull(userId);
    }

    private Notification owned(User user, UUID notificationId) {
        return notificationRepository.findByIdAndUser_IdAndDeletedAtIsNull(notificationId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.NOTIFICATION_NOT_FOUND));
    }

    private static List<NotificationType> typesOf(String category) {
        NotificationCategory parsed;
        try {
            parsed = NotificationCategory.valueOf(category.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.NOTIFICATION_CATEGORY_INVALID);
        }
        return Arrays.stream(NotificationType.values()).filter(t -> t.getCategory() == parsed).toList();
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
