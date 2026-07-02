package com.aima.dto.response;

import com.aima.enums.Platform;
import com.aima.enums.SuitabilityLevel;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ContentIdeaResponse", description = "Content idea derived from a trend (FR-22).")
public class ContentIdeaResponse {

    @Schema(description = "Content idea id.")
    UUID id;

    @Schema(description = "Idea title.")
    String ideaTitle;

    @Schema(description = "Idea description / execution notes.")
    String ideaDescription;

    @Schema(description = "Most suitable platform.")
    Platform platform;

    @Schema(description = "Suitability level.", example = "HIGH")
    SuitabilityLevel suitabilityLevel;
}
