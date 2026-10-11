package com.aima.dto.response;

import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCategory;
import com.aima.enums.PublishErrorCode;
import com.aima.enums.PublishErrorType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AdminFailedPostResponse", description = "A failed/rejected post for the admin dashboard (FR-82/FR-83).")
public class AdminFailedPostResponse {

    @Schema(description = "Post identifier.")
    UUID id;

    Platform platformName;

    @Schema(description = "Platform account the post targeted.")
    String accountName;

    @Schema(description = "Email of the owning user.")
    String ownerEmail;

    @Schema(description = "Published caption (platform-formatted).")
    String caption;

    @Schema(description = "POLICY_VIOLATION = rejected content (FR-82); others = posting error (FR-83).")
    PublishErrorType errorType;

    @Schema(description = "Original platform error code (FR-35).")
    String errorCode;

    @Schema(description = "Original platform message, REDACTED (tokens/PII masked). Admin only — never sent to users.")
    String errorMessage;

    @Schema(description = "Normalized AIMA error code (PublishErrorCode) — what the user sees, translated by the FE catalog.")
    PublishErrorCode code;

    @Schema(description = "Group of the normalized code (policy, auth, rate_limit...).")
    PublishErrorCategory category;

    @Schema(description = "Platform error_subcode of the final failure, when the platform sent one.")
    String platformSubcode;

    @Schema(description = "Reference code shown to the user (ERR-XXXXXX) — search it in the admin list.")
    String referenceCode;

    @Schema(description = "Retries already attempted for this post (FR-56, max 3).")
    Integer retryCount;

    @Schema(description = "When the next retry is due; null once retries are exhausted or the error is permanent.")
    Instant nextRetryAt;

    @Schema(description = "When the final failure happened.")
    Instant failedAt;
}
