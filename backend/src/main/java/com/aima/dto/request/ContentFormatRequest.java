package com.aima.dto.request;

import com.aima.enums.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Starts an async platform-formatting job for one content item (FR-40..FR-46, BR-04).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ContentFormatRequest", description = "Platforms to format the content item for — one ContentVersion each.")
public class ContentFormatRequest {

    @NotEmpty(message = "FORMAT_PLATFORMS_REQUIRED")
    @Schema(description = "Target platforms (FACEBOOK/INSTAGRAM/THREADS).", requiredMode = Schema.RequiredMode.REQUIRED)
    List<Platform> platforms;
}
