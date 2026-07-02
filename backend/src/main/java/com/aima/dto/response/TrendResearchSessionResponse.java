package com.aima.dto.response;

import com.aima.enums.Platform;
import com.aima.enums.ResearchStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Polled by the frontend (NFR-04): trends/ideas are present once status is COMPLETED.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "TrendResearchSessionResponse", description = "A trend-research session with its results (FR-19, FR-23).")
public class TrendResearchSessionResponse {

    @Schema(description = "Session id.")
    UUID id;

    @Schema(description = "Industry researched (from the brand profile).")
    String industry;

    @Schema(description = "Main platform of the session.")
    Platform platform;

    @Schema(description = "When the research started.")
    LocalDateTime researchTime;

    @Schema(description = "Session status.", example = "COMPLETED")
    ResearchStatus status;

    @Schema(description = "AI summary of the session, present when COMPLETED.")
    String summary;

    @Schema(description = "Error message, present only when FAILED.")
    String errorMessage;

    @Schema(description = "Trends found (each with its content ideas).")
    List<TrendResponse> trends;
}
