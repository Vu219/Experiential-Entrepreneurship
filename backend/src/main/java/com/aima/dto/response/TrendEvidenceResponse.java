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
@Schema(name = "TrendEvidenceResponse", description = "A real source backing a trend.")
public class TrendEvidenceResponse {

    @Schema(description = "Source title.")
    String title;

    @Schema(description = "Source URL (empty for calendar moments).")
    String url;

    @Schema(description = "Source kind.", example = "web", allowableValues = {"web", "google_trends", "calendar", "youtube", "instagram", "threads"})
    String source;
}
