package com.aima.brand.dto;

import com.aima.brand.Platform;
import com.aima.brand.PostingFrequency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Set;

/**
 * FR-09 validation: brand name, industry and target audience must not be empty;
 * at least one platform; a valid posting frequency.
 */
public record BrandProfileRequest(
        @NotBlank(message = "Brand name is required")
        String brandName,

        @NotBlank(message = "Industry is required")
        String industry,

        String description,

        String brandVoice,

        @NotBlank(message = "Target audience is required")
        String targetAudience,

        String contentGoal,

        @NotEmpty(message = "Select at least one platform")
        Set<Platform> platforms,

        @NotNull(message = "Posting frequency is required")
        PostingFrequency postingFrequency,

        List<String> preferredTimes
) {
}
