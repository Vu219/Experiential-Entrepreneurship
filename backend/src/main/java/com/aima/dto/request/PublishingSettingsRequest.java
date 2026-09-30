package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Cài đặt đăng bài của user (workspace cá nhân — plan §2.3). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PublishingSettingsRequest", description = "Publishing policy of the current user.")
public class PublishingSettingsRequest {

    @NotBlank(message = "PUBLISHING_TIMEZONE_INVALID")
    @Schema(description = "IANA timezone used to enter/show publishing times.", example = "Asia/Ho_Chi_Minh")
    String timezone;

    @NotNull(message = "PUBLISHING_SETTING_REQUIRED")
    @Schema(description = "Posts must be APPROVED before they can publish; unapproved schedules are held.")
    Boolean requireApproval;

    @NotNull(message = "PUBLISHING_SETTING_REQUIRED")
    @Min(value = 0, message = "PUBLISHING_CONFLICT_WINDOW_INVALID")
    @Max(value = 1440, message = "PUBLISHING_CONFLICT_WINDOW_INVALID")
    @Schema(description = "Warn when two schedules on one account are closer than this (minutes).", example = "60")
    Integer conflictWindowMinutes;

    @NotNull(message = "PUBLISHING_SETTING_REQUIRED")
    @Schema(description = "Block scheduling versions whose brand-voice score is below the threshold.")
    Boolean brandVoiceBlockingEnabled;

    @Min(value = 0, message = "BRAND_VOICE_THRESHOLD_INVALID")
    @Max(value = 100, message = "BRAND_VOICE_THRESHOLD_INVALID")
    @Schema(description = "0-100; required when brandVoiceBlockingEnabled.", example = "70")
    Integer brandVoiceThreshold;
}
