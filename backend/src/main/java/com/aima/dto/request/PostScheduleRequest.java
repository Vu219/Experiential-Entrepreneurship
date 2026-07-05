package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PostScheduleRequest", description = "Create a posting schedule for one formatted content version (FR-47).")
public class PostScheduleRequest {

    @NotNull(message = "SCHEDULE_CONTENT_VERSION_REQUIRED")
    @Schema(description = "Formatted content version to publish (must be FORMATTED).")
    UUID contentVersionId;

    @NotNull(message = "SCHEDULE_PLATFORM_ACCOUNT_REQUIRED")
    @Schema(description = "Connected platform account to publish to (must be ACTIVE, BR-05).")
    UUID platformAccountId;

    @NotNull(message = "SCHEDULE_TIME_REQUIRED")
    @Future(message = "SCHEDULE_TIME_IN_PAST")
    @Schema(description = "When to publish (server timezone).", example = "2026-07-10T20:00:00")
    LocalDateTime scheduledTime;
}
