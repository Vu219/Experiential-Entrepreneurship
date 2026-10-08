package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

/**
 * Mirrors ai/src/schemas.py PreviousTrend — trend đã gợi ý ở phiên trước cùng brand + nền tảng,
 * để AI phân biệt trend MỚI / đang tiếp diễn và không lặp lại trend user đã xóa (rejected).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PreviousTrendPayload {

    @JsonProperty("trend_name")
    String trendName;

    @JsonProperty("researched_at")
    LocalDate researchedAt;

    boolean rejected;
}
