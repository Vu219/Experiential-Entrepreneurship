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
 * Mirrors ai/src/schemas.py GoldenHourRequest — body sent to POST {ai-service}/golden-hours (FR-48).
 * `posts` = the user's own published AIMA posts on this platform with a milestone snapshot; fewer than 10
 * → the AI service falls back to platform defaults (data_driven = false).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GoldenHourPayload implements LlmRoutedPayload {

    String platform;

    List<AnalyzedPostPayload> posts;

    @JsonProperty("llm_config")
    LlmConfigPayload llmConfig;
}
