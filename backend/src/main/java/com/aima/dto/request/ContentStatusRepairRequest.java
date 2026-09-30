package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
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
@Schema(name = "ContentStatusRepairRequest", description = "Apply exactly the plan reviewed in the dry-run.")
public class ContentStatusRepairRequest {
    @NotBlank(message = "REPAIR_PLAN_TOKEN_REQUIRED")
    @Schema(description = "planToken returned by the dry-run.")
    String planToken;
}
