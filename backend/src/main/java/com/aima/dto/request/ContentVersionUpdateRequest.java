package com.aima.dto.request;

import com.aima.dto.common.VideoScriptDto;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * FR-33 trên bản nền tảng (B2): sửa thủ công từng phần của MỘT ContentVersion —
 * field bỏ trống giữ nguyên giá trị cũ (partial update, cùng kiểu ContentItemUpdateRequest).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ContentVersionUpdateRequest", description = "Partial manual edit of one per-platform content version.")
public class ContentVersionUpdateRequest {

    @Schema(description = "Structured video script (timed hook, numbered steps, timed CTA).")
    VideoScriptDto script;

    @Schema(description = "Posted caption for this platform.")
    String caption;

    @Schema(description = "Hashtags for this platform.")
    List<String> hashtags;

    @Schema(description = "Call-to-action.")
    String cta;

    @Schema(description = "TEXT description of the video to film.")
    String mediaPrompt;

    @Schema(description = "FR-30: whether the AI or reviewer judged this version on-brand.")
    Boolean voiceAligned;

    @Schema(description = "FR-30: brand-voice match score 0-100.")
    Integer voiceScore;

    @Schema(description = "FR-30: short brand-voice notes from the AI or reviewer.")
    String voiceNotes;
}
