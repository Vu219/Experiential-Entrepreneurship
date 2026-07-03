package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Mirrors ai/src/schemas.py ContentVersion — one platform-formatted version in the /format response.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ContentVersionPayload {

    @JsonProperty("platform_name")
    String platformName;

    @JsonProperty("formatted_caption")
    String formattedCaption;

    @JsonProperty("formatted_hashtags")
    List<String> formattedHashtags;

    @JsonProperty("media_format")
    String mediaFormat;

    String notes;
}
