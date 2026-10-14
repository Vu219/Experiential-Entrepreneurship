package com.aima.mapper;

import com.aima.enums.RealtimeJobKind;
import com.aima.enums.Platform;
import com.aima.dto.realtime.PostUpdatedEvent;
import com.aima.dto.realtime.AiDeltaEvent;
import com.aima.dto.realtime.AiResetEvent;
import com.aima.dto.realtime.JobUpdatedEvent;
import com.aima.dto.realtime.NotificationCreatedEvent;
import com.aima.dto.realtime.NotificationDeletedEvent;
import com.aima.dto.realtime.NotificationReadEvent;
import com.aima.dto.realtime.RealtimeReadyEvent;
import com.aima.dto.response.NotificationResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Payload các sự kiện SSE (luồng {@code GET /realtime/stream}). */
@Mapper(componentModel = "spring")
public interface RealtimeMapper {

    RealtimeReadyEvent toReadyEvent(long unreadCount, boolean resync, Instant serverTime);

    NotificationReadEvent toNotificationReadEvent(List<UUID> ids, Boolean all, long unreadCount);

    NotificationDeletedEvent toNotificationDeletedEvent(List<UUID> ids, Boolean read, long unreadCount);

    // Tham số `progress` cũng có thuộc tính platform → chỉ rõ nguồn, không MapStruct lấy nhầm progress.platform.
    @Mapping(target = "platform", source = "platform")
    JobUpdatedEvent toJobUpdatedEvent(RealtimeJobKind kind, UUID jobId, UUID itemId, Platform platform, String status,
                                      String stage, JobUpdatedEvent.JobProgress progress, String errorCode, UUID resultId);

    JobUpdatedEvent.JobProgress toJobProgress(int done, int total, Platform platform);

    PostUpdatedEvent toPostUpdatedEvent(UUID scheduleId, UUID postId, UUID itemId, Platform platform, String status,
                                        Integer attempt, Instant nextRetryAt, String holdReason, String errorCode);

    AiDeltaEvent toAiDeltaEvent(UUID jobId, long seq, String path, String append, Boolean replace);

    AiResetEvent toAiResetEvent(UUID jobId, String reason);

    NotificationCreatedEvent toNotificationCreatedEvent(NotificationResponse notification, long unreadCount,
                                                        boolean toast);
}
