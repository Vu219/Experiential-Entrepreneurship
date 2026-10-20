package com.aima.dto.response;

import com.aima.enums.Platform;
import com.aima.enums.TrendScheduleFrequency;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "TrendResearchScheduleResponse", description = "Lịch nghiên cứu xu hướng tự động của user.")
public class TrendResearchScheduleResponse {
    Boolean enabled;
    UUID brandProfileId;
    String brandName;
    UUID strategyId;
    String strategyName;
    List<Platform> platforms;
    TrendScheduleFrequency frequency;
    List<Integer> days;
    @Schema(example = "02:00")
    String time;
    LocalDateTime lastRunAt;
}
