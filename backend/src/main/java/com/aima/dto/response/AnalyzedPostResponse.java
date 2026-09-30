package com.aima.dto.response;

import com.aima.enums.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AnalyzedPostResponse", description = "A published post with its collected metric snapshots (FR-60..FR-62).")
public class AnalyzedPostResponse {

    @Schema(description = "Post identifier.")
    UUID id;

    @Schema(description = "Platform the post went to.")
    Platform platformName;

    @Schema(description = "Post id on the platform.")
    String platformPostId;

    @Schema(description = "Account the post was published on.")
    String accountName;

    @Schema(description = "Original content item id (for navigation).")
    UUID contentItemId;

    @Schema(description = "The published caption (platform-formatted).")
    String formattedCaption;

    @Schema(description = "When it was published.")
    Instant publishedAt;

    @Schema(description = "Metric snapshots ordered by milestone (24h → 48h → 7d).")
    List<PostAnalyticsResponse> analytics;
}
