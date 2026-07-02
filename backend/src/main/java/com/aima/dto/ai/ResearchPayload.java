package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Mirrors ai/src/schemas.py ResearchRequest — sent as the body of POST {ai-service}/research.
 * `sources` is omitted (no page/group ids configured yet); the Python side defaults to an
 * empty TrendSource and falls back to mock/cross-platform signal.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ResearchPayload {

    @JsonProperty("brand_profile")
    BrandProfileInputPayload brandProfile;

    ContentStrategyInputPayload strategy;

    @JsonProperty("max_trends")
    Integer maxTrends;

    @JsonProperty("max_ideas")
    Integer maxIdeas;
}
