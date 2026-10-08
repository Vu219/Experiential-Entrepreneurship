package com.aima.dto.response;

import com.aima.enums.Platform;
import com.aima.enums.ResearchStatus;
import com.aima.enums.ResearchTrigger;
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

    @Schema(description = "Name of the content strategy the session was started with (null for older sessions).")
    String strategyName;

    @Schema(description = "Desired number of content ideas requested by the user (null = default).")
    Integer articleCount;

    @Schema(description = "When the research started.")
    LocalDateTime researchTime;

    @Schema(description = "Session status.", example = "COMPLETED")
    ResearchStatus status;

    @Schema(description = "MANUAL (\"Research now\") or SCHEDULED (daily 2:00 AM run).", example = "MANUAL")
    ResearchTrigger triggerType;

    @Schema(description = "True when live web search succeeded; false/null = limited sources.")
    Boolean grounded;

    @Schema(description = "AI summary of the session, present when COMPLETED.")
    String summary;

    @Schema(description = "Error message, present only when FAILED.")
    String errorMessage;

    @Schema(description = "Number of web searches the AI ran.")
    Integer webSearches;

    @Schema(description = "Data sources used by the session and what each returned.")
    List<ResearchSourceResponse> dataSources;

    @Schema(description = "Trends found (each with its content ideas).")
    List<TrendResponse> trends;
}
