package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Mirrors ai/src/schemas.py OptimizeResponse — kết quả POST {ai-service}/optimize. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class OptimizeResultPayload {

    @JsonProperty("strategy_adjustments")
    List<StrategyAdjustmentPayload> strategyAdjustments;

    @JsonProperty("future_improvements")
    List<String> futureImprovements;
}
