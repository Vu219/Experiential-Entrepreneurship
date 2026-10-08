package com.aima.dto.response;

import com.aima.enums.Platform;
import com.aima.enums.SuitabilityLevel;
import com.aima.enums.TrendMomentum;
import com.aima.enums.TrendType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "TrendResponse", description = "Trend found in a research session (FR-20, FR-21).")
public class TrendResponse {

    @Schema(description = "Trend id.")
    UUID id;

    @Schema(description = "Trend name.")
    String trendName;

    @Schema(description = "Platform the trend applies to.")
    Platform platform;

    @Schema(description = "Relevance to the brand, 0.00–1.00.", example = "0.85")
    BigDecimal relevanceScore;

    @Schema(description = "Trend description (origin platform is noted here when cross-platform).")
    String description;

    @Schema(description = "Relevance level to the brand.", example = "HIGH")
    SuitabilityLevel relevance;

    @Schema(description = "Trend type (null for sessions before evidence-based research).", example = "NICHE")
    TrendType trendType;

    @Schema(description = "Momentum vs. earlier sessions.", example = "RISING")
    TrendMomentum momentum;

    @Schema(description = "Latest date to publish to ride the trend.")
    LocalDate actBy;

    @Schema(description = "Evidence strength from the number of independent sources.", example = "HIGH")
    SuitabilityLevel confidence;

    @Schema(description = "Hashtags people use for this trend.")
    List<String> hashtags;

    @Schema(description = "Real sources backing the trend.")
    List<TrendEvidenceResponse> evidence;

    @Schema(description = "Content ideas derived from this trend.")
    List<ContentIdeaResponse> contentIdeas;
}
