package com.aima.dto.response;

import com.aima.enums.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "BrandProfileResponse", description = "Brand profile details.")
public class BrandProfileResponse {

    @Schema(description = "Unique brand profile identifier.", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    UUID id;

    @Schema(description = "Brand name.", example = "Aima Coffee")
    String brandName;

    @Schema(description = "Industry.", example = "Food & Beverage")
    String industry;

    @Schema(description = "Brand description.")
    String description;

    @Schema(description = "Tone of voice.", example = "Friendly and warm")
    String brandVoice;

    @Schema(description = "Target audience.", example = "Young professionals 25-35")
    String targetAudience;

    @Schema(description = "Content goal.", example = "Increase brand awareness")
    String contentGoal;

    @Schema(description = "Platforms to publish on.")
    Set<Platform> platforms;

    @Schema(description = "Brand keywords.")
    List<String> brandKeywords;

    @Schema(description = "Things the brand should do in its content.")
    List<String> brandDos;

    @Schema(description = "Things the brand should avoid in its content.")
    List<String> brandDonts;

    @Schema(description = "Logo URL.", example = "https://.../logo.png")
    String logoUrl;

    @Schema(description = "Whether this is the profile currently in use (max 1 active per user).")
    Boolean isActive;

    @Schema(description = "Number of non-deleted content strategies linked to this brand.", example = "3")
    Long strategyCount;

    @Schema(description = "Creation timestamp.", example = "2026-06-08T09:30:00")
    LocalDateTime createdAt;

    @Schema(description = "Last update timestamp.", example = "2026-06-08T09:30:00")
    LocalDateTime updatedAt;
}
