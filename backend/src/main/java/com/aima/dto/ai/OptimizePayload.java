package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Mirrors ai/src/schemas.py OptimizeRequest — body của POST {ai-service}/optimize (FR-65/FR-66). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class OptimizePayload {

    @JsonProperty("brand_profile")
    BrandProfileInputPayload brandProfile;

    ContentStrategyInputPayload strategy;

    List<OptimizationInsightPayload> insights;
}
