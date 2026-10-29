package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "FeedbackSummaryResponse", description = "Tổng quan đánh giá: tổng lượt, điểm trung bình, phân bố theo số sao.")
public class FeedbackSummaryResponse {

    @Schema(example = "42")
    long total;

    @Schema(description = "Điểm trung bình, làm tròn 2 chữ số; 0 khi chưa có lượt nào.", example = "4.31")
    double averageRating;

    @Schema(description = "Số lượt theo từng mức sao, khoá \"1\"..\"5\" (luôn đủ 5 khoá).")
    Map<String, Long> distribution;
}
