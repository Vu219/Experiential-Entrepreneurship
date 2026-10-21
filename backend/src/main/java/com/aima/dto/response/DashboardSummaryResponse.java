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
 * Toàn bộ dữ liệu của tab "Bảng điều khiển" trong MỘT lần gọi (giảm số request từ 7 xuống 1).
 * Timeline "Hoạt động gần đây" KHÔNG nằm ở đây — FE tái dùng {@code GET /notifications} vốn đã
 * là nhật ký sự kiện có sẵn (FR-75..FR-79).
 *
 * <p>Mọi số liệu đều được lọc theo user đang đăng nhập (API-03/SEC-04).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "DashboardSummaryResponse", description = "Dữ liệu tổng hợp cho tab Bảng điều khiển.")
public class DashboardSummaryResponse {

    @Schema(description = "Bốn thẻ số liệu đầu trang.")
    DashboardStatsResponse stats;

    @Schema(description = "Số bài đang chờ duyệt (NEED_REVIEW) — dòng phụ của banner chào mừng.", example = "2")
    long awaitingReview;

    @Schema(description = "Số bài đã lên lịch đăng (SCHEDULED) — dòng phụ của banner chào mừng.", example = "3")
    long scheduled;

    @Schema(description = "Chuỗi hiệu suất theo ngày, đủ rangeDays điểm liên tục (ngày trống = 0).")
    List<DashboardPointResponse> performance;

    @Schema(description = "Số ngày của khoảng đang xem (7 hoặc 30).", example = "7")
    int rangeDays;

    @Schema(description = "Loại nội dung của bài đăng trong 7 ngày gần nhất — cùng số với khối loại nội dung trang Phân tích.")
    List<AnalyticsContentTypeResponse> contentTypes;

    @Schema(description = "Top chủ đề hiệu quả (tối đa 5).")
    List<DashboardTopicResponse> topTopics;

    @Schema(description = "Trạng thái kết nối của cả 3 nền tảng trong scope (FB/IG/Threads).")
    List<DashboardPlatformResponse> platforms;

    @Schema(description = "Tiến độ thiết lập 4 bước (FR-86).")
    DashboardOnboardingResponse onboarding;
}
