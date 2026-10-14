package com.aima.dto.realtime;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.UUID;

/** Payload SSE {@code notification.read} — đồng bộ "đã đọc" giữa các tab / thiết bị. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class NotificationReadEvent {
    List<UUID> ids;
    /** true = "Đọc tất cả". */
    Boolean all;
    long unreadCount;
}
