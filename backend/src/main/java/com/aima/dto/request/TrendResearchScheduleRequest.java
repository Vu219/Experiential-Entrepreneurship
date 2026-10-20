package com.aima.dto.request;

import com.aima.enums.Platform;
import com.aima.enums.TrendScheduleFrequency;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.UUID;

/** Lưu lịch nghiên cứu xu hướng tự động (PUT /trend-research/schedule) — thay toàn bộ lịch cũ. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "TrendResearchScheduleRequest")
public class TrendResearchScheduleRequest {

    @NotNull(message = "TREND_SCHEDULE_INVALID")
    Boolean enabled;

    @Schema(description = "Hồ sơ thương hiệu; null = hồ sơ đang hoạt động.")
    UUID brandProfileId;

    @Schema(description = "Chiến lược ưu tiên; null = chiến lược ACTIVE mới nhất.")
    UUID strategyId;

    @NotEmpty(message = "TREND_SCHEDULE_INVALID")
    List<Platform> platforms;

    @NotNull(message = "TREND_SCHEDULE_INVALID")
    TrendScheduleFrequency frequency;

    @Schema(description = "WEEKLY: 0 = Thứ Hai … 6 = Chủ nhật.")
    List<@Min(value = 0, message = "TREND_SCHEDULE_INVALID") @Max(value = 6, message = "TREND_SCHEDULE_INVALID") Integer> days;

    @NotNull(message = "TREND_SCHEDULE_INVALID")
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "TREND_SCHEDULE_INVALID")
    @Schema(example = "02:00")
    String time;
}
