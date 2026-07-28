package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Một ô heatmap (khối G) = giao của một thứ trong tuần và một khung 3 giờ.
 *
 * <p>Chỉ ô CÓ bài đăng mới được trả về. FE tự điền phần còn lại thành ô "chưa từng đăng" và phải
 * hiển thị ô đó bằng nền trung tính NGOÀI thang màu — khác hẳn ô có bài nhưng tương tác thấp.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AnalyticsHeatmapCellResponse", description = "Một ô (thứ × khung 3 giờ) của heatmap.")
public class AnalyticsHeatmapCellResponse {

    @Schema(description = "Thứ theo ISO: 1 = Thứ 2 … 7 = Chủ nhật.", example = "3")
    int dow;

    @Schema(description = "Khung 3 giờ: 0 = 00:00–02:59 … 7 = 21:00–23:59.", example = "6")
    int slot;

    @Schema(description = "Giờ bắt đầu khung (0/3/6/…/21).", example = "18")
    int hourStart;

    @Schema(description = "Số bài đã đăng rơi vào ô này.", example = "4")
    long posts;

    @Schema(description = "Tổng tương tác của các bài trong ô.", example = "1240")
    long engagement;

    @Schema(description = "Tương tác trung bình mỗi bài — giá trị dùng để tô màu.", example = "310.0")
    double avgEngagement;

    @Schema(description = "true khi posts < minPostsForScale — mẫu quá nhỏ, FE đánh dấu 'chưa đủ dữ liệu'.",
            example = "false")
    boolean lowSample;
}
