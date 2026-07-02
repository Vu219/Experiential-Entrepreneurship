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
 * Mirrors ai/src/schemas.py ResearchResponse — the body returned by POST {ai-service}/research.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ResearchResultPayload {

    String industry;

    List<TrendPayload> trends;

    @JsonProperty("content_ideas")
    List<ContentIdeaPayload> contentIdeas;

    String summary;
}
