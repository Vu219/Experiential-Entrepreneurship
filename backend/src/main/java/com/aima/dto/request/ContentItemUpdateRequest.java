package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * FR-33: manual edit of a generated content item before posting.
 * Partial update — null fields are left unchanged (MapStruct IGNORE).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ContentItemUpdateRequest", description = "Fields to overwrite on a content item (FR-33); omitted fields keep their value.")
public class ContentItemUpdateRequest {

    @Schema(description = "Video script as newline-separated lines.")
    String script;

    @Schema(description = "Caption text.")
    String caption;

    @Schema(description = "Hashtags without a leading '#'.")
    List<String> hashtags;

    @Schema(description = "Call-to-action.")
    String cta;

    @Schema(description = "Media prompt (text description only — no media generation in MVP).")
    String mediaPrompt;
}
