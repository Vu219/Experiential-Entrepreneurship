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
 * Biểu đồ "Hiệu quả nội dung" + donut "Loại nội dung" theo khoảng ngày người dùng lọc (preset 7/30 ngày hoặc tùy chỉnh).
 * {@code from}/{@code to} là khoảng ĐÃ kẹp theo gói — có thể khác khoảng FE gửi lên.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "DashboardPerformanceResponse", description = "Chuỗi lượt xem + tương tác theo ngày của khoảng đã lọc.")
public class DashboardPerformanceResponse {

    @Schema(description = "Ngày bắt đầu thực tế (yyyy-MM-dd), sau khi kẹp theo số ngày lịch sử của gói.", example = "2026-10-15")
    String from;

    @Schema(description = "Ngày kết thúc thực tế (yyyy-MM-dd).", example = "2026-10-21")
    String to;

    @Schema(description = "Số ngày trong khoảng = số điểm trả về.", example = "7")
    int rangeDays;

    @Schema(description = "Đủ rangeDays điểm liên tục; ngày không có số liệu = 0.")
    List<DashboardPointResponse> points;

    @Schema(description = "Loại nội dung của bài đăng trong cùng khoảng — cùng số với khối loại nội dung trang Phân tích.")
    List<AnalyticsContentTypeResponse> contentTypes;
}
