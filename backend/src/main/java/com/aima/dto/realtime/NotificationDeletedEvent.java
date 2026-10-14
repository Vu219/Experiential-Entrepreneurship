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

/** Payload SSE {@code notification.deleted}. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class NotificationDeletedEvent {
    List<UUID> ids;
    /** true = đã xoá mọi thông báo ĐÃ ĐỌC. */
    Boolean read;
    long unreadCount;
}
