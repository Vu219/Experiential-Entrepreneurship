package com.aima.dto.response;

import com.aima.enums.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
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

    @Schema(description = "Content ideas derived from this trend.")
    List<ContentIdeaResponse> contentIdeas;
}
