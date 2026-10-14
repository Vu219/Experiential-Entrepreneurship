package com.aima.service.Impl;

import com.aima.config.RealtimeProperties;
import com.aima.dto.realtime.RealtimeMessage;
import com.aima.enums.RealtimeEventType;
import com.aima.service.RealtimeEventPublisher;
import com.aima.util.RealtimePayloads;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class RealtimeEventPublisherImpl implements RealtimeEventPublisher {

    RealtimeProperties properties;
    StringRedisTemplate redis;
    ObjectMapper objectMapper;
    RealtimeMessageListener listener;

    @Override
    public void toUser(UUID userId, RealtimeEventType type, Object payload) {
        toUser(userId, type, null, payload);
    }

    @Override
    public void toUser(UUID userId, RealtimeEventType type, String eventId, Object payload) {
        if (userId == null) return;
        afterCommit(RealtimeMessage.builder().userId(userId).event(type.getWireName()).id(eventId)
                .data(envelope(payload)).build());
    }

    @Override
    public void toAdmins(RealtimeEventType type, Object payload) {
        afterCommit(RealtimeMessage.builder().role(RealtimeMessage.ROLE_ADMIN).event(type.getWireName())
                .data(envelope(payload)).build());
    }

    @Override
    public void revokeSessions(UUID userId) {
        toUser(userId, RealtimeEventType.SESSION_REVOKED, null);
    }

    @Override
    public void control(String command, Object payload) {
        afterCommit(RealtimeMessage.builder().control(true).event(command).data(envelope(payload)).build());
    }

    /** Dựng message NGAY (payload có thể chạm entity lazy — chỉ an toàn trong transaction), phát sau commit. */
    private void afterCommit(RealtimeMessage message) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publish(message);
                }
            });
        } else {
            publish(message);
        }
    }

    private void publish(RealtimeMessage message) {
        try {
            String json = objectMapper.writeValueAsString(message);
            if (properties.redisBus()) {
                redis.convertAndSend(properties.channel(), json);
            } else {
                listener.handle(json);
            }
        } catch (Exception e) {
            // Best-effort: mất một sự kiện thì client vẫn bù được (resync khi nối lại / polling dự phòng).
            log.warn("[Realtime] Không phát được sự kiện: {}", e.toString());
        }
    }

    private JsonNode envelope(Object payload) {
        return RealtimePayloads.envelope(objectMapper, payload);
    }
}
