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
 * Mirrors ai/src/schemas.py ContentIdea (FR-22) — element of ResearchResultPayload.content_ideas.
 * trend_name links the idea back to the trend it derives from.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ContentIdeaPayload {

    @JsonProperty("idea_title")
    String ideaTitle;

    @JsonProperty("idea_description")
    String ideaDescription;

    @JsonProperty("trend_name")
    String trendName;

    String platform;

    @JsonProperty("suitability_level")
    String suitabilityLevel;

    @JsonProperty("execution_suggestions")
    List<String> executionSuggestions;

    @JsonProperty("related_goals")
    List<String> relatedGoals;
}
