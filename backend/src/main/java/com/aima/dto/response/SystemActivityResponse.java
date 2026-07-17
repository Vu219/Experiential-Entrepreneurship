package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Biểu đồ "Hoạt động hệ thống" theo khoảng thời gian — suy từ dữ liệu có timestamp sẵn
 * (bài POSTED, posting jobs, log ERROR) gộp theo bucket. KHÔNG phải %CPU; là khối lượng
 * nghiệp vụ. Không có bảng metrics riêng: mỗi lần gọi tổng hợp on-the-fly bằng date_bin.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "SystemActivityResponse", description = "Chuỗi hoạt động hệ thống theo bucket thời gian.")
public class SystemActivityResponse {

    @Schema(description = "Khoảng đã chọn: 1h | 24h | 7d | 30d | 1y.")
    String range;

    @Schema(description = "Độ mịn bucket, vd \"1m\", \"30m\", \"1h\", \"6h\", \"1d\".")
    String granularity;

    @Schema(description = "Các bucket theo thứ tự thời gian tăng dần; buckets rỗng vẫn có (count 0).")
    List<ActivityBucket> buckets;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @Schema(name = "ActivityBucket", description = "Một bucket thời gian với số đếm theo nguồn.")
    public static class ActivityBucket {

        @Schema(description = "Mốc bắt đầu bucket.")
        LocalDateTime time;

        @Schema(description = "Bài đăng thành công (POSTED) trong bucket.")
        long posts;

        @Schema(description = "Lượt chạy job đăng bài (posting_jobs) trong bucket.")
        long jobs;

        @Schema(description = "Số log ERROR trong bucket.")
        long errors;

        @Schema(description = "Tổng hoạt động = posts + jobs + errors.")
        long total;
    }
}
