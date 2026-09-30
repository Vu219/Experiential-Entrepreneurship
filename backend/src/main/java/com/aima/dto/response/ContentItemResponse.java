package com.aima.dto.response;

import com.aima.dto.common.VideoScriptDto;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.Platform;
import com.aima.enums.ReviewStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ContentItemResponse", description = "AI-generated content item (FR-24..FR-30).")
public class ContentItemResponse {

    @Schema(description = "Unique content item identifier.")
    UUID id;

    @Schema(description = "Structured video script (timed hook, numbered steps, timed CTA).")
    VideoScriptDto script;

    @Schema(description = "Generated caption (FR-26).")
    String caption;

    @Schema(description = "Generated hashtags (FR-27), without a leading '#'.")
    List<String> hashtags;

    @Schema(description = "Generated call-to-action (FR-28).")
    String cta;

    @Schema(description = "Text description of the image/video to create (FR-29) — no media is generated.")
    String mediaPrompt;

    @Schema(description = "Derived aggregate status (versions + schedules).", example = "GENERATED")
    ContentItemStatus status;

    @Schema(description = "FR-34 review status, independent of the aggregate status.", example = "NONE")
    ReviewStatus reviewStatus;

    @Schema(description = "True when a current version's schedule is FAILED or ON_HOLD (user action needed).")
    boolean needsAttention;

    // ===== B2: bài là MỘT thực thể chứa N bản nền tảng =====

    @Schema(description = "Per-platform versions of this item (active only — soft-deleted excluded).")
    List<ContentVersionResponse> versions;

    @Schema(description = "Owning brand profile's id (for the content-library brand filter).")
    UUID brandProfileId;

    @Schema(description = "Owning brand profile's display name (for list cards).")
    String brandName;

    @Schema(description = "Attached content-idea id (set at create/wizard time; null if none).")
    UUID ideaId;

    // ===== Trạng thái wizard (auto-save/resume) — chỉ có nghĩa khi DRAFT, null sau khi rời DRAFT =====

    @Schema(description = "Wizard step the draft stopped at (1-4); null when not a wizard draft.")
    Integer wizardStep;

    @Schema(description = "Platforms picked in the wizard for this item.")
    List<Platform> wizardPlatforms;

    @Schema(description = "Extra user note for the AI from the wizard's source step.")
    String wizardNote;

    @Schema(description = "Attached trend id chosen in the wizard (soft reference).")
    UUID trendId;

    @Schema(description = "Last update time.")
    LocalDateTime updatedAt;
}
