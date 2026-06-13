package com.aima.brand.dto;

import com.aima.brand.BrandProfile;
import com.aima.brand.Platform;
import com.aima.brand.PostingFrequency;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public record BrandProfileResponse(
        UUID id,
        String brandName,
        String industry,
        String description,
        String brandVoice,
        String targetAudience,
        String contentGoal,
        Set<Platform> platforms,
        PostingFrequency postingFrequency,
        List<String> preferredTimes,
        Instant createdAt,
        Instant updatedAt
) {

    public static BrandProfileResponse from(BrandProfile p) {
        return new BrandProfileResponse(
                p.getId(),
                p.getBrandName(),
                p.getIndustry(),
                p.getDescription(),
                p.getBrandVoice(),
                p.getTargetAudience(),
                p.getContentGoal(),
                p.getPlatforms(),
                p.getPostingFrequency(),
                p.getPreferredTimes(),
                p.getCreatedAt(),
                p.getUpdatedAt());
    }
}
