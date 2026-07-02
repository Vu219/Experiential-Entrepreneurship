package com.aima.dto.request;

import com.aima.enums.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/**
 * Starts an async trend-research session ("Research now", FR-19). All fields optional:
 * the active brand profile and FACEBOOK are used as defaults.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "TrendResearchRequest", description = "Payload to start a trend-research session.")
public class TrendResearchRequest {

    @Schema(description = "Brand profile id; defaults to the caller's active brand profile.",
            example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    UUID brandProfileId;

    @Schema(description = "Main platform of the session; defaults to FACEBOOK.")
    Platform platform;
}
