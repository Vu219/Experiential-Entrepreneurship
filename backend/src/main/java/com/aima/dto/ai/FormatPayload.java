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
 * Mirrors ai/src/schemas.py FormatRequest — the body sent to POST {ai-service}/format (FR-40..FR-46).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class FormatPayload implements LlmRoutedPayload {

    @JsonProperty("llm_config")
    LlmConfigPayload llmConfig;

    @JsonProperty("brand_profile")
    BrandProfileInputPayload brandProfile;

    FormatContentPayload content;

    List<String> platforms;
}
