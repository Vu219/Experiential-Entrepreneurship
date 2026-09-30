package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
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
@Schema(name = "ContentStatusRepairResult", description = "Outcome of applying a dry-run plan.")
public class ContentStatusRepairResult {
    int itemsUpdated;
    int instagramHeld;
    @Schema(description = "Changes still pending after apply (0 = idempotent; run dry-run again to confirm).")
    int remainingChanges;
}
