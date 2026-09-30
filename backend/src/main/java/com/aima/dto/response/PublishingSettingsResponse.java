package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PublishingSettingsResponse", description = "Publishing policy of the current user.")
public class PublishingSettingsResponse {
    String timezone;
    boolean requireApproval;
    int conflictWindowMinutes;
    boolean brandVoiceBlockingEnabled;
    Integer brandVoiceThreshold;
}
