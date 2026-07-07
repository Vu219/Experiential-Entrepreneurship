package com.aima.dto.request;

import com.aima.enums.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/**
 * Starts an async content-generation job (BR-01, BR-03) for an ACTIVE strategy.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ContentGenerationRequest", description = "Payload to start generating one content item.")
public class ContentGenerationRequest {

    @NotNull(message = "STRATEGY_ID_REQUIRED")
    @Schema(description = "Content strategy id; must be ACTIVE and owned by the caller.",
            example = "3fa85f64-5717-4562-b3fc-2c963f66afa6", requiredMode = Schema.RequiredMode.REQUIRED)
    UUID strategyId;

    @NotNull(message = "GENERATION_PLATFORM_REQUIRED")
    @Schema(description = "Target platform for the draft.", requiredMode = Schema.RequiredMode.REQUIRED)
    Platform platform;

    @Schema(description = "Free-text topic to ground the generation (optional).", example = "Ưu đãi mùa hè")
    String topic;

    @Schema(description = "Trend to ground the generation (optional); must belong to the caller — "
            + "unknown/foreign ids are ignored, not an error.")
    UUID trendId;

    @Schema(description = "Content idea to ground the generation (optional); must belong to the caller — "
            + "unknown/foreign ids are ignored, not an error.")
    UUID ideaId;

    @Schema(description = "Extra instruction from the user (optional), e.g. 'nhấn mạnh khuyến mãi tháng này'.")
    String note;

    @Schema(description = "Prior caption/version to improve on (regenerate flow, FR-32).")
    String regenerateFrom;
}
