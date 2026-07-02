package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Mirrors ai/src/schemas.py Trend (FR-20, FR-21) — element of ResearchResultPayload.trends.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TrendPayload {

    @JsonProperty("trend_name")
    String trendName;

    String platform;

    String relevance;

    @JsonProperty("relevance_score")
    Double relevanceScore;

    String description;
}
