package com.aima.dto.request;

import com.aima.enums.ScheduleMode;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.UUID;

/** Một dòng của POST /schedules/batch — mỗi dòng một transaction độc lập, idempotent theo key riêng. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ScheduleBatchRowRequest", description = "One schedule row; processed and retried independently.")
public class ScheduleBatchRowRequest {

    @NotBlank(message = "SCHEDULE_ROW_ID_REQUIRED")
    @Size(max = 64, message = "SCHEDULE_ROW_ID_REQUIRED")
    @Schema(description = "Client-side row id echoed back in the result.")
    String clientRowId;

    @NotBlank(message = "IDEMPOTENCY_KEY_INVALID")
    @Size(max = 64, message = "IDEMPOTENCY_KEY_INVALID")
    @Schema(description = "Same key + same payload returns the stored result; same key + other payload is rejected.")
    String idempotencyKey;

    @NotNull(message = "SCHEDULE_CONTENT_VERSION_REQUIRED")
    UUID contentVersionId;

    @NotNull(message = "SCHEDULE_PLATFORM_ACCOUNT_REQUIRED")
    UUID platformAccountId;

    @Schema(description = "SCHEDULE (default, needs scheduledTime) or NOW (server time, job created at once).")
    ScheduleMode mode;

    @Future(message = "SCHEDULE_TIME_IN_PAST")
    @Schema(description = "Absolute time with Z/offset; required for SCHEDULE, ignored for NOW.")
    Instant scheduledTime;
}
