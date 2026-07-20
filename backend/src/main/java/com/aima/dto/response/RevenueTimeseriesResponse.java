package com.aima.dto.response;

import com.aima.enums.RevenueGranularity;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;

/** Chuỗi thời gian doanh thu — đã điền đủ mọi kỳ trong khoảng để chart không bị gãy. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "RevenueTimeseriesResponse", description = "Chuỗi doanh thu theo thời gian của kỳ đang lọc.")
public class RevenueTimeseriesResponse {

    @Schema(description = "Chế độ gộp đang áp dụng.")
    RevenueGranularity granularity;

    @Schema(description = "Đầu kỳ (inclusive), giờ VN.")
    LocalDateTime periodStart;

    @Schema(description = "Cuối kỳ (exclusive), giờ VN.")
    LocalDateTime periodEnd;

    @Schema(description = "Các bucket theo thứ tự thời gian tăng dần; kỳ trống có giá trị 0.")
    List<RevenueSeriesPointResponse> points;
}
