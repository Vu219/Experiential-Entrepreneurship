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

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PostScheduleUpdateRequest", description = "Move a schedule to a new time (FR-50; unpublished only).")
public class PostScheduleUpdateRequest {

    @NotNull(message = "SCHEDULE_TIME_REQUIRED")
    @Future(message = "SCHEDULE_TIME_IN_PAST")
    @Schema(description = "New publishing time (server timezone).", example = "2026-07-11T08:30:00")
    LocalDateTime scheduledTime;
}
