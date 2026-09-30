package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/** Một khung giờ gợi ý còn trống (không giữ chỗ — server tính lại cảnh báo lúc tạo lịch). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "SuggestedSlotResponse", description = "A free golden-hour slot for the account (not reserved).")
public class SuggestedSlotResponse {
    Instant time;
    @Schema(description = "Golden-hour window the slot comes from, e.g. 20:00-21:00.")
    String window;
}
