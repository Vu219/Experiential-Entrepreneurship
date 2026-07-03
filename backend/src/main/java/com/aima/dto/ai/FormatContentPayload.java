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
 * Mirrors ai/src/schemas.py FormatContentInput — the original content sent to POST {ai-service}/format
 * (script flattened to text, exactly as persisted on ContentItem).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class FormatContentPayload {

    String script;

    String caption;

    List<String> hashtags;

    String cta;

    @JsonProperty("media_prompt")
    String mediaPrompt;
}
