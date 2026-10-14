package com.aima.dto.response;

import com.aima.enums.NotificationCategory;
import com.aima.enums.NotificationRefType;
import com.aima.enums.NotificationType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "NotificationResponse", description = "An in-app notification (FR-75..FR-79).")
public class NotificationResponse {

    @Schema(description = "Unique notification identifier.")
    UUID id;

    @Schema(description = "Notification type.", example = "POST_PUBLISHED")
    NotificationType type;

    @Schema(description = "Short title.")
    String title;

    @Schema(description = "Detail message (platform, reason, next steps — FR-38).")
    String message;

    @Schema(description = "Id of the related object (post/content item/connection) for navigation.")
    UUID refId;

    @Schema(description = "When the user read it; null = unread.")
    LocalDateTime readAt;

    @Schema(description = "When the notification was created.")
    LocalDateTime createdAt;

    @Schema(description = "Settings group of the type (channel preferences).", example = "PUBLISHING")
    NotificationCategory category;

    @Schema(description = "What refId points to (deep link); null for notifications created before V17.", example = "SCHEDULE")
    NotificationRefType refType;

    @Schema(description = "Parameters for the localized text (FE keys ntf_<TYPE>_title/_body). title/message stay as the "
            + "Vietnamese fallback. Platform error text is in params.detail, never translated.")
    Map<String, Object> params;
}
