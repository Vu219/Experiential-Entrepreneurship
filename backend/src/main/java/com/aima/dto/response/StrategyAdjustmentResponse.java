package com.aima.dto.response;

import com.aima.enums.AppliedStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "StrategyAdjustmentResponse", description = "An AI-proposed strategy adjustment with the user's decision (FR-65, FR-67, FR-68).")
public class StrategyAdjustmentResponse {

    @Schema(description = "Unique adjustment identifier.")
    UUID id;

    @Schema(description = "Strategy the adjustment targets.")
    UUID strategyId;

    @Schema(description = "The proposed change.")
    String adjustmentContent;

    @Schema(description = "Why the AI proposed it.")
    String rationale;

    @Schema(description = "Insight the proposal derives from (FR-64).")
    String insightContent;

    @Schema(description = "Actionable recommendation of that insight.")
    String recommendation;

    @Schema(description = "PENDING (awaiting decision), APPLIED or REJECTED.", example = "PENDING")
    AppliedStatus appliedStatus;

    @Schema(description = "When the user decided; null while PENDING.")
    LocalDateTime decidedAt;

    @Schema(description = "When the proposal was created.")
    LocalDateTime createdAt;
}
