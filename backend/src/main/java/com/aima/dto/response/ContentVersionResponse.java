package com.aima.dto.response;

import com.aima.dto.common.VideoScriptDto;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.Platform;
import com.aima.enums.ScheduleStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ContentVersionResponse", description = "Per-platform version of a content item (BR-04). "
        + "Generate flow fills the rich fields; format flow fills the formatted_* subset.")
public class ContentVersionResponse {

    @Schema(description = "Unique content version identifier.")
    UUID id;

    @Schema(description = "Platform this version targets.")
    Platform platformName;

    @Schema(description = "Platform-native caption.")
    String formattedCaption;

    @Schema(description = "Platform-adapted hashtags, without a leading '#'.")
    List<String> formattedHashtags;

    @Schema(description = "Suggested media format, e.g. 'vertical video', 'square image', 'link post'.")
    String mediaFormat;

    // ===== Bản giàu (B2) — luồng generate điền; luồng format trả null =====

    @Schema(description = "Structured video script (timed hook, numbered steps, timed CTA).")
    VideoScriptDto script;

    @Schema(description = "Call-to-action for this platform (FR-28).")
    String cta;

    @Schema(description = "TEXT description of the video to film (FR-29).")
    String mediaPrompt;

    @Schema(description = "TEXT prompt for ONE static image (reserved for the image feature; may be empty).")
    String imagePrompt;

    @Schema(description = "FR-30: whether the AI judged this version on-brand.")
    Boolean voiceAligned;

    @Schema(description = "FR-30: brand-voice match score 0-100.")
    Integer voiceScore;

    @Schema(description = "FR-30: short brand-voice notes from the AI.")
    String voiceNotes;

    @Schema(description = "Production status of this version.", example = "FORMATTED")
    ContentVersionStatus status;

    @Schema(description = "Status of this version's live schedule; null when never scheduled or the schedule was cancelled.")
    ScheduleStatus scheduleStatus;
}
