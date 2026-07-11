package com.aima.dto.request;

import com.aima.enums.AppliedStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AdjustmentDecisionRequest", description = "User decision on a proposed strategy adjustment (FR-68).")
public class AdjustmentDecisionRequest {

    @NotNull(message = "ADJUSTMENT_DECISION_REQUIRED")
    @Schema(description = "APPLIED to accept the proposal, REJECTED to dismiss it.", example = "APPLIED")
    AppliedStatus status;
}
