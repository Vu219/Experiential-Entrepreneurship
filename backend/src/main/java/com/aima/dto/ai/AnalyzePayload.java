package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Mirrors ai/src/schemas.py AnalyzeRequest — body của POST {ai-service}/analyze (FR-63/FR-64). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AnalyzePayload {

    @JsonProperty("brand_profile")
    BrandProfileInputPayload brandProfile;

    List<AnalyzedPostPayload> posts;
}
