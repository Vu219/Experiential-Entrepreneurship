package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Mirrors ai/src/schemas.py AnalyzeResponse — kết quả POST {ai-service}/analyze. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AnalyzeResultPayload {

    @JsonProperty("success_factors")
    List<SuccessFactorPayload> successFactors;

    List<OptimizationInsightPayload> insights;
}
