package com.aima.dto.response;

import com.aima.enums.FailureResolution;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.PublishErrorCode;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/** Một lần thử đăng (một {@code PostingJob}) trong timeline của bài lỗi — không có message gốc. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "FailedPostAttemptResponse", description = "One publishing attempt in a failed post's timeline.")
public class FailedPostAttemptResponse {

    @Schema(description = "Retries before this attempt in its cycle (0 = first attempt).")
    int retryCount;

    PostingJobStatus status;

    @Schema(description = "Normalized error code (FAILED attempts only).")
    PublishErrorCode code;

    @Schema(description = "Original platform error code (FAILED attempts only).")
    String platformCode;

    Instant startedAt;

    Instant finishedAt;

    @Schema(description = "Planned time of this retry (RETRYING attempts).")
    Instant nextRetryAt;

    @Schema(description = "Reference code of this attempt (ERR-XXXXXX).")
    String referenceCode;

    @Schema(description = "How this failure was handled: DISMISSED / RETRIED / CANCELLED; null = not handled.")
    FailureResolution resolution;
}
