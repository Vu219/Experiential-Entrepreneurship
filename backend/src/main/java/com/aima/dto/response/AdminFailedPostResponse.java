package com.aima.dto.response;

import com.aima.enums.Platform;
import com.aima.enums.PublishErrorType;
import io.swagger.v3.oas.annotations.media.Schema;
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

    String errorMessage;

    @Schema(description = "When the final failure happened.")
    LocalDateTime failedAt;
}
