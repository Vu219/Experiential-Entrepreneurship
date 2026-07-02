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
import java.util.UUID;

/**
 * List item for the research history — counts only, no embedded trends/ideas.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "TrendResearchSessionSummaryResponse", description = "Research session history entry (FR-23).")
public class TrendResearchSessionSummaryResponse {

    @Schema(description = "Session id.")
    UUID id;

    @Schema(description = "Industry researched.")
    String industry;

    @Schema(description = "Main platform of the session.")
    Platform platform;

    @Schema(description = "When the research started.")
    LocalDateTime researchTime;

    @Schema(description = "Session status.", example = "COMPLETED")
    ResearchStatus status;

    @Schema(description = "Number of trends found.")
    int trendsFound;

    @Schema(description = "Number of content ideas created.")
    int ideasCreated;
}
