package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Một điểm của biểu đồ đa series "Bài đã đăng & số liệu tổng quan" (khối C).
 * Ngày không có bài đăng vẫn được trả về với giá trị 0 để các đường liền mạch.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AnalyticsPointResponse", description = "Điểm dữ liệu theo ngày với đủ 4 metric.")
public class AnalyticsPointResponse {

    @Schema(description = "Ngày đăng, định dạng yyyy-MM-dd.", example = "2026-07-21")
    String date;

    @Schema(description = "Lượt xem cộng dồn của các bài đăng trong ngày.", example = "1280")
    long views;

    @Schema(description = "Lượt thích.", example = "96")
    long likes;

    @Schema(description = "Bình luận.", example = "24")
    long comments;

    @Schema(description = "Chia sẻ.", example = "12")
    long shares;

    @Schema(description = "true = số của ngày này có phần ƯỚC TÍNH (chia đều từ ngày đăng đến lần đồng bộ đầu tiên khi bài được "
            + "theo dõi muộn) — FE hiển thị điểm rỗng + chú thích.", example = "false")
    boolean estimated;
}
