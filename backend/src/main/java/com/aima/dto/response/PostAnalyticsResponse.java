package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PostAnalyticsResponse", description = "One collected metrics snapshot of a published post (FR-59/FR-60).")
public class PostAnalyticsResponse {

    @Schema(description = "Unique analytics record identifier.")
    UUID id;

    @Schema(description = "Collection milestone in hours after publishing: 24, 48 or 168 (7 days).", example = "24")
    Integer milestoneHours;

    @Schema(description = "Impressions/views; null when the platform does not expose it.")
    Long views;

    Long likes;

    Long comments;

    @Schema(description = "Shares (Threads: reposts + quotes).")
    Long shares;

    @Schema(description = "Saves; null — not exposed for FB Page/Threads posts in MVP.")
    Long saves;

    @Schema(description = "Click-through rate; null in MVP (no link tracking yet).")
    BigDecimal ctr;

    @Schema(description = "Conversion rate; null in MVP.")
    BigDecimal conversion;

    @Schema(description = "Watch time in seconds; null for text posts.")
    Long watchTime;

    @Schema(description = "When this snapshot was collected.")
    Instant collectedAt;
}
