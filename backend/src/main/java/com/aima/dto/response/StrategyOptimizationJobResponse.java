package com.aima.dto.response;

import com.aima.enums.GenerationJobStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "StrategyOptimizationJobResponse", description = "An async strategy-optimization run (FR-65..FR-68, NFR-04).")
public class StrategyOptimizationJobResponse {

    @Schema(description = "Job identifier — poll GET /content-strategies/optimize-jobs/{id}.")
    UUID id;

    @Schema(description = "PENDING → RUNNING → SUCCESS | FAILED.")
    GenerationJobStatus status;

    @Schema(description = "Failure reason when FAILED.")
    String errorMessage;

    @Schema(description = "Improvements for future posts (FR-66); present when SUCCESS.")
    List<String> futureImprovements;

    @Schema(description = "Proposed adjustments awaiting the user's decision; present when SUCCESS.")
    List<StrategyAdjustmentResponse> adjustments;
}
