package com.aima.dto.realtime;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.UUID;

/** Payload SSE {@code post.updated} — lịch đăng đổi trạng thái (Lịch đăng, Bài lỗi, Bảng điều khiển patch tại chỗ / tải lại). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PostUpdatedEvent {
    UUID scheduleId;
    UUID postId;
    UUID itemId;
    String platform;
    /** {@code ScheduleStatus} của lịch; {@code RETRYING} khi đang chờ thử lại (lịch vẫn POSTING). */
    String status;
    /** Lần thử đang chạy/đã chạy (0 = lần đầu). */
    Integer attempt;
    Instant nextRetryAt;
    String holdReason;
    String errorCode;
}
