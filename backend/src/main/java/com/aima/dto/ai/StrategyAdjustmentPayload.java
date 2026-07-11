package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Mirrors ai/src/schemas.py StrategyAdjustment — một đề xuất điều chỉnh chiến lược (FR-65). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class StrategyAdjustmentPayload {

    @JsonProperty("adjustment_content")
    String adjustmentContent;

    String rationale;
}
