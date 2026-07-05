package com.aima.dto.response;

import com.aima.enums.Platform;
import com.aima.enums.ScheduleStatus;
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
@Schema(name = "PostScheduleResponse", description = "A posting schedule entry (FR-47..FR-51).")
public class PostScheduleResponse {

    @Schema(description = "Unique schedule identifier.")
    UUID id;

    @Schema(description = "Schedule status.", example = "SCHEDULED")
    ScheduleStatus status;

    @Schema(description = "When the post will be published (server timezone).")
    LocalDateTime scheduledTime;

    @Schema(description = "Target platform (from the content version).")
    Platform platformName;

    @Schema(description = "Connected platform account the post goes to.")
    UUID platformAccountId;

    @Schema(description = "Display name of the platform account.")
    String platformAccountName;

    @Schema(description = "Avatar of the platform account, if any.")
    String platformAccountAvatarUrl;

    @Schema(description = "Original content item the version belongs to.")
    UUID contentItemId;

    @Schema(description = "The formatted content version being scheduled.")
    ContentVersionResponse contentVersion;
}
