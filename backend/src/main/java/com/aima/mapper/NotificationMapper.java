package com.aima.mapper;

import com.aima.dto.response.NotificationResponse;
import com.aima.entity.Notification;
import com.aima.entity.User;
import com.aima.enums.NotificationType;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;
import java.util.UUID;

@Mapper(componentModel = "spring")
public interface NotificationMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true) // audit fields — không lấy từ user
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "readAt", ignore = true)
    Notification toNotification(User user, NotificationType type, String title, String message, UUID refId);

    NotificationResponse toResponse(Notification notification);

    List<NotificationResponse> toResponseList(List<Notification> notifications);
}
