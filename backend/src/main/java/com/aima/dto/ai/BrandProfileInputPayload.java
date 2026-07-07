package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Mirrors ai/src/schemas.py BrandProfileInput — field names map to its snake_case JSON.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BrandProfileInputPayload {

    @JsonProperty("brand_name")
    String brandName;

    String industry;

    String description;

    @JsonProperty("brand_voice")
    String brandVoice;

    @JsonProperty("target_audience")
    String targetAudience;

    @JsonProperty("content_goals")
    List<String> contentGoals;

    List<String> platforms;

    // Brand guardrails (FR-05) — AI dệt keywords tự nhiên, theo dos, TRÁNH donts.
    @JsonProperty("brand_keywords")
    List<String> brandKeywords;

    @JsonProperty("brand_dos")
    List<String> brandDos;

    @JsonProperty("brand_donts")
    List<String> brandDonts;
}
