package com.aima.dto.realtime;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/** Payload SSE {@code ready} — gửi ngay khi mở luồng, SAU phần phát bù. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RealtimeReadyEvent {

    long unreadCount;

    /** true = không phát bù được (id lạ / quá {@code replayLimit}) → FE tải lại danh sách thông báo từ đầu. */
    boolean resync;

    Instant serverTime;
}
