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

import java.time.Instant;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PostScheduleUpdateRequest", description = "Move a schedule to a new time (FR-50; unpublished only).")
public class PostScheduleUpdateRequest {

    @NotNull(message = "SCHEDULE_TIME_REQUIRED")
    @Future(message = "SCHEDULE_TIME_IN_PAST")
    @Schema(description = "Absolute publishing time; ISO-8601 with Z or offset is required.", example = "2026-10-11T08:30:00+07:00")
    Instant scheduledTime;

    @Schema(description = "Optional: move the schedule to another ACTIVE account of the same platform "
            + "(clears ACCOUNT_REMOVED/ACCOUNT_ISSUE holds tied to the old account).")
    java.util.UUID platformAccountId;
}
