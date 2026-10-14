package com.aima.dto.realtime;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/** Payload SSE {@code ai.reset} — AI chuyển model dự phòng giữa chừng: FE xoá khung xem trước của job. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiResetEvent {
    UUID jobId;
    String reason;
}
