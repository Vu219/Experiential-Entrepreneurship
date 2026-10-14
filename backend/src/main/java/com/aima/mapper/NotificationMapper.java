package com.aima.mapper;

import com.aima.dto.notification.NotificationDraft;
import com.aima.dto.response.NotificationResponse;
import com.aima.entity.Notification;
import com.aima.entity.User;
import com.aima.enums.NotificationType;
import com.aima.util.JsonColumns;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Mapper(componentModel = "spring", imports = JsonColumns.class)
public interface NotificationMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true) // audit fields — không lấy từ user
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "readAt", ignore = true)
    @Mapping(target = "refType", ignore = true)
    @Mapping(target = "params", ignore = true)
    @Mapping(target = "dedupeKey", ignore = true)
    Notification toNotification(User user, NotificationType type, String title, String message, UUID refId);

    /** Thông báo từ {@link NotificationDraft} (params → JSON, dedupeKey có thể null). */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "readAt", ignore = true)
    @Mapping(target = "user", source = "user")
    @Mapping(target = "type", source = "draft.type")
    @Mapping(target = "title", source = "draft.title")
    @Mapping(target = "message", source = "draft.message")
    @Mapping(target = "refId", source = "draft.refId")
    @Mapping(target = "refType", source = "draft.refType")
    @Mapping(target = "dedupeKey", source = "dedupeKey")
    @Mapping(target = "params", expression = "java(JsonColumns.writeMap(draft.params()))")
    Notification toNotification(User user, NotificationDraft draft, String dedupeKey);

    @Mapping(target = "category", expression = "java(notification.getType() == null ? null : notification.getType().getCategory())")
    @Mapping(target = "params", expression = "java(readParams(notification.getParams()))")
    NotificationResponse toResponse(Notification notification);

    List<NotificationResponse> toResponseList(List<Notification> notifications);

    /** null khi không có tham số (bản ghi cũ) — FE dùng title/message dự phòng. */
    default Map<String, Object> readParams(String json) {
        Map<String, Object> params = JsonColumns.readMap(json);
        return params.isEmpty() ? null : params;
    }
}
