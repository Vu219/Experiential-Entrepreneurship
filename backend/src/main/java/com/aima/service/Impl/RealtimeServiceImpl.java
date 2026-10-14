package com.aima.service.Impl;

import com.aima.config.RealtimeProperties;
import com.aima.dto.realtime.RealtimeMessage;
import com.aima.dto.response.NotificationResponse;
import com.aima.entity.Notification;
import com.aima.entity.User;
import com.aima.enums.RealtimeEventType;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.NotificationMapper;
import com.aima.mapper.RealtimeMapper;
import com.aima.repository.NotificationRepository;
import com.aima.repository.UserRepository;
import com.aima.security.JwtAuthenticationFilter;
import com.aima.service.RealtimeConnectionRegistry;
import com.aima.service.RealtimeService;
import com.aima.util.RealtimePayloads;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class RealtimeServiceImpl implements RealtimeService {

    /** Gợi ý client chờ trước khi tự nối lại (EventSource chuẩn); client AIMA có backoff riêng. */
    static final long CLIENT_RETRY_MS = 3000;
    static final String CAPACITY_RETRY_AFTER_SECONDS = "30";

    RealtimeConnectionRegistry registry;
    RealtimeProperties properties;
    UserRepository userRepository;
    NotificationRepository notificationRepository;
    NotificationMapper notificationMapper;
    RealtimeMapper realtimeMapper;
    TransactionTemplate transactionTemplate;
    ObjectMapper objectMapper;

    private record Owner(UUID userId, boolean admin) {
    }

    private record Snapshot(List<NotificationResponse> replay, long unreadCount, boolean resync) {
    }

    @Override
    public SseEmitter open(String email, String lastEventId, HttpServletRequest request, HttpServletResponse response) {
        Owner owner = transactionTemplate.execute(status -> {
            User user = userRepository.findByEmail(email).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
            boolean admin = user.getRole() != null && RealtimeMessage.ROLE_ADMIN.equals(user.getRole().getRoleName());
            return new Owner(user.getId(), admin);
        });

        Instant tokenExpiresAt = request.getAttribute(JwtAuthenticationFilter.TOKEN_EXPIRES_AT_ATTRIBUTE) instanceof Instant exp
                ? exp : null;
        RealtimeConnectionRegistry.Connection connection;
        try {
            // Đăng ký TRƯỚC khi chụp phần bù: sự kiện phát giữa hai bước vẫn tới (FE loại trùng theo id).
            connection = registry.register(owner.userId(), owner.admin(), tokenExpiresAt);
        } catch (AppException e) {
            if (e.getErrorCode() == ErrorCode.REALTIME_CAPACITY_EXCEEDED) {
                response.setHeader(HttpHeaders.RETRY_AFTER, CAPACITY_RETRY_AFTER_SECONDS);
            }
            throw e;
        }
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache, no-transform");
        response.setHeader("X-Accel-Buffering", "no");

        Snapshot snapshot = transactionTemplate.execute(status -> snapshot(owner.userId(), lastEventId));
        connection.sendRetry(CLIENT_RETRY_MS);
        for (NotificationResponse notification : snapshot.replay()) {
            Object payload = realtimeMapper.toNotificationCreatedEvent(notification, snapshot.unreadCount(), false);
            connection.send(RealtimeEventType.NOTIFICATION_CREATED.getWireName(), notification.getId().toString(),
                    json(payload));
        }
        Object ready = realtimeMapper.toReadyEvent(snapshot.unreadCount(), snapshot.resync(), Instant.now());
        connection.send(RealtimeEventType.READY.getWireName(), null, json(ready));
        return connection.emitter();
    }

    private Snapshot snapshot(UUID userId, String lastEventId) {
        long unread = notificationRepository.countByUser_IdAndReadAtIsNullAndDeletedAtIsNull(userId);
        if (lastEventId == null || lastEventId.isBlank()) {
            return new Snapshot(List.of(), unread, false);
        }
        Optional<Notification> anchor = parseUuid(lastEventId)
                .flatMap(id -> notificationRepository.findByIdAndUser_IdAndDeletedAtIsNull(id, userId));
        if (anchor.isEmpty()) {
            return new Snapshot(List.of(), unread, true);
        }
        int limit = properties.replayLimit();
        List<Notification> newer = notificationRepository
                .findByUser_IdAndDeletedAtIsNullAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(
                        userId, anchor.get().getCreatedAt(), PageRequest.of(0, limit + 2))
                .stream().filter(n -> !n.getId().equals(anchor.get().getId())).toList();
        if (newer.size() > limit) {
            return new Snapshot(List.of(), unread, true);
        }
        return new Snapshot(notificationMapper.toResponseList(newer), unread, false);
    }

    private String json(Object payload) {
        return RealtimePayloads.envelope(objectMapper, payload).toString();
    }

    private static Optional<UUID> parseUuid(String value) {
        try {
            return Optional.of(UUID.fromString(value.trim()));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
