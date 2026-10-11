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
import java.util.UUID;

/** Một lần thử đăng trong timeline admin — kèm chi tiết kỹ thuật ĐÃ REDACT (chỉ admin). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AdminFailedPostAttemptResponse", description = "One publishing attempt with redacted technical detail (admin only).")
public class AdminFailedPostAttemptResponse {

    int retryCount;

    PostingJobStatus status;

    PublishErrorCode code;

    String platformCode;

    String platformSubcode;

    Instant startedAt;

    Instant finishedAt;

    Instant nextRetryAt;

    String referenceCode;

    FailureResolution resolution;

    Instant resolvedAt;

    @Schema(description = "Admin/user id that handled this failure.")
    UUID resolvedBy;

    @Schema(description = "Technical message, redacted.")
    String errorMessage;

    @Schema(description = "Raw platform error as JSON, redacted (tokens/PII masked).")
    String errorDetail;
}
