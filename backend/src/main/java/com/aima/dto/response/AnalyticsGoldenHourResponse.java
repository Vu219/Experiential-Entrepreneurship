package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Ô "Khung giờ vàng" của dải "Thông tin chi tiết" (khối H): ô heatmap có tương tác trung bình mỗi
 * bài CAO NHẤT trong số các ô ĐỦ MẪU ({@code posts >= minPostsForScale}).
 *
 * <p>Không đủ mẫu thì cả object này là {@code null} — FE hiển thị "Chưa đủ dữ liệu". Tuyệt đối
 * không suy ra khung giờ từ một hai bài lẻ: đó là bịa số liệu, không phải gợi ý.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AnalyticsGoldenHourResponse", description = "Khung giờ có tương tác TB cao nhất (chỉ tính ô đủ mẫu).")
public class AnalyticsGoldenHourResponse {

    @Schema(description = "Thứ theo ISO: 1 = Thứ 2 … 7 = Chủ nhật.", example = "3")
    int dow;

    @Schema(description = "Khung 3 giờ: 0 = 00:00–02:59 … 7 = 21:00–23:59.", example = "6")
    int slot;

    @Schema(description = "Giờ bắt đầu khung.", example = "18")
    int hourStart;

    @Schema(description = "Giờ kết thúc khung (không bao gồm).", example = "21")
    int hourEnd;

    @Schema(description = "Số bài trong khung — luôn >= ngưỡng mẫu tối thiểu.", example = "5")
    long posts;

    @Schema(description = "Tương tác trung bình mỗi bài của khung.", example = "310.0")
    double avgEngagement;
}
