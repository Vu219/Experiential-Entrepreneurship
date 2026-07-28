package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Khối G — "Thời điểm hoạt động nhiều nhất": lưới 7 thứ × 8 khung 3 giờ, giá trị tô màu là
 * TƯƠNG TÁC TRUNG BÌNH MỖI BÀI (không phải tổng — nếu dùng tổng thì khung nào đăng nhiều bài sẽ
 * luôn "nóng", phản ánh tần suất đăng chứ không phải hiệu quả).
 *
 * <p><b>Chống méo thang màu:</b> {@code max}/{@code min} chỉ tính trên các ô có
 * {@code posts >= minPostsForScale}. Một ô duy nhất tình cờ viral (1 bài) sẽ không kéo giãn thang
 * màu làm mọi ô còn lại nhạt hết. Khi chưa ô nào đủ mẫu, {@code max}/{@code min} = null → FE hiển
 * thị trạng thái "chưa đủ dữ liệu" thay vì vẽ thang màu vô nghĩa.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AnalyticsHeatmapResponse", description = "Heatmap 7 thứ × 8 khung 3 giờ theo tương tác TB mỗi bài.")
public class AnalyticsHeatmapResponse {

    @Schema(description = "Ngày đầu kỳ (yyyy-MM-dd).", example = "2026-07-13")
    String from;

    @Schema(description = "Ngày cuối kỳ (yyyy-MM-dd).", example = "2026-07-19")
    String to;

    @Schema(description = "Chỉ các ô CÓ bài đăng; ô vắng mặt = chưa từng đăng khung đó.")
    List<AnalyticsHeatmapCellResponse> cells;

    @Schema(description = "avgEngagement lớn nhất trong các ô ĐỦ MẪU; null khi chưa ô nào đủ.", example = "310.0")
    Double max;

    @Schema(description = "avgEngagement nhỏ nhất trong các ô ĐỦ MẪU; null khi chưa ô nào đủ.", example = "40.0")
    Double min;

    @Schema(description = "Số bài tối thiểu để một ô được tính vào thang màu (chống méo do mẫu nhỏ).", example = "3")
    int minPostsForScale;

    @Schema(description = "Số ô đạt ngưỡng mẫu — 0 nghĩa là thang màu chưa đáng tin.", example = "5")
    int scaledCells;
}
