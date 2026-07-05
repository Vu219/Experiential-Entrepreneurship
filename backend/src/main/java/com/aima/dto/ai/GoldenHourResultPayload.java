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
 * Mirrors ai/src/schemas.py GoldenHourResponse — the POST /golden-hours result (FR-48).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GoldenHourResultPayload {

    String platform;

    @JsonProperty("data_driven")
    boolean dataDriven;

    @JsonProperty("suggested_hours")
    List<String> suggestedHours;

    String rationale;
}
