package com.aima.dto.response;

import com.aima.enums.ContentLifecycle;
import com.aima.enums.Platform;
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
@Schema(name = "ContentVersionResponse", description = "Platform-formatted version of a content item (BR-04, FR-46).")
public class ContentVersionResponse {

    @Schema(description = "Unique content version identifier.")
    UUID id;

    @Schema(description = "Platform this version was formatted for.")
    Platform platformName;

    @Schema(description = "Platform-native caption.")
    String formattedCaption;

    @Schema(description = "Platform-adapted hashtags, without a leading '#'.")
    List<String> formattedHashtags;

    @Schema(description = "Suggested media format, e.g. 'vertical video', 'square image', 'link post'.")
    String mediaFormat;

    @Schema(description = "Lifecycle status of this version.", example = "FORMATTED")
    ContentLifecycle status;
}
