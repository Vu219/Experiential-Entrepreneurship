package com.aima.dto.response;

import com.aima.enums.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "GoldenHourResponse", description = "Suggested posting time slots for a platform (FR-48).")
public class GoldenHourResponse {

    @Schema(description = "Platform the suggestions apply to.")
    Platform platform;

    @Schema(description = "False = platform defaults; true = derived from ≥10 analyzed posts.")
    boolean dataDriven;

    @Schema(description = "Suggested time slots, e.g. \"20:00-21:00\".")
    List<String> suggestedHours;

    @Schema(description = "Why these slots were suggested.")
    String rationale;
}
