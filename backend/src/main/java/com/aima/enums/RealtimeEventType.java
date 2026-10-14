package com.aima.enums;

import lombok.Getter;

/**
 * Tên sự kiện trên luồng SSE {@code GET /realtime/stream} (trường {@code event:}). Hợp đồng HAI ĐẦU với
 * {@code frontend/src/realtime/events.ts} — thêm/đổi tên phải sửa cả hai nơi.
 */
@Getter
public enum RealtimeEventType {
    READY("ready"),
    NOTIFICATION_CREATED("notification.created"),
    NOTIFICATION_READ("notification.read"),
    NOTIFICATION_DELETED("notification.deleted"),
    JOB_UPDATED("job.updated"),
    AI_DELTA("ai.delta"),
    AI_RESET("ai.reset"),
    POST_UPDATED("post.updated"),
    USAGE_UPDATED("usage.updated"),
    SESSION_REVOKED("session.revoked"),
    REPLACED("replaced"),
    RECONNECT("reconnect");

    private final String wireName;

    RealtimeEventType(String wireName) {
        this.wireName = wireName;
    }
}
