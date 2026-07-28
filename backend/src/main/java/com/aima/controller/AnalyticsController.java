package com.aima.controller;

import com.aima.dto.response.AnalyticsContentTypeResponse;
import com.aima.dto.response.AnalyticsHeatmapResponse;
import com.aima.dto.response.AnalyticsInsightsResponse;
import com.aima.dto.response.AnalyticsPlatformResponse;
import com.aima.dto.response.AnalyticsSummaryResponse;
import com.aima.dto.response.AnalyticsTimeseriesResponse;
import com.aima.dto.response.AnalyticsTopPostResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.enums.Platform;
import com.aima.service.AnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * Trang Phân tích (UI-08) — số liệu GỘP theo kỳ/ngày. Khác {@link PostAnalyticsController}
 * ({@code /analytics/posts} — danh sách từng bài) dù cùng gốc {@code /analytics}: đường dẫn con
 * khác nhau nên không đụng nhau.
 *
 * <p>Bộ lọc dùng chung: {@code from}/{@code to} (yyyy-MM-dd, mặc định 7 ngày gần nhất) +
 * {@code platforms} (rỗng = mọi nền tảng) + {@code contentTypes} (rỗng = mọi loại nội dung). Service
 * validate và quy ra khoảng thật; khoảng ngược → mã 2050, quá dài → 2051. So sánh luôn theo kỳ liền
 * trước cùng độ dài.
 *
 * <p><b>Hai ngoại lệ CỐ Ý</b> — mỗi donut bỏ qua đúng chiều của chính nó, vì lọc còn một giá trị thì
 * donut chỉ còn một lát 100%: {@code /by-platform} không nhận {@code platforms},
 * {@code /by-content-type} không nhận {@code contentTypes}. Chiều còn lại vẫn được áp bình thường.
 */
@RestController
@RequestMapping("/analytics")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Analytics", description = "Số liệu tổng hợp trang Phân tích (UI-08): KPI + chuỗi theo ngày.")
public class AnalyticsController {

    AnalyticsService analyticsService;

    @GetMapping("/summary")
    @Operation(summary = "4 thẻ KPI (views/likes/comments/shares) kèm % so với kỳ liền trước và sparkline (khối B)",
            description = "from/to định dạng yyyy-MM-dd, mặc định 7 ngày gần nhất; platforms lọc theo nền tảng "
                    + "(FACEBOOK/INSTAGRAM/THREADS), contentTypes lọc theo loại nội dung (IMAGE/VIDEO/TEXT/OTHER), "
                    + "bỏ trống = tất cả. Kỳ so sánh = kỳ liền trước cùng độ dài; deltaPct = null khi kỳ trước bằng 0.")
    public ApiResponse<AnalyticsSummaryResponse> summary(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<Platform> platforms,
            @RequestParam(required = false) List<String> contentTypes) {
        return analyticsService.summary(principal.getUsername(),
                new AnalyticsService.AnalyticsQuery(from, to, platforms, contentTypes));
    }

    @GetMapping("/timeseries")
    @Operation(summary = "Chuỗi 4 metric theo ngày cho biểu đồ đa series, đã zero-fill (khối C)",
            description = "Cùng bộ lọc from/to/platforms/contentTypes như /summary. Trả đủ rangeDays điểm — ngày "
                    + "không có bài đăng có giá trị 0 để trục X co giãn theo range mà đường không gãy.")
    public ApiResponse<AnalyticsTimeseriesResponse> timeseries(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<Platform> platforms,
            @RequestParam(required = false) List<String> contentTypes) {
        return analyticsService.timeseries(principal.getUsername(),
                new AnalyticsService.AnalyticsQuery(from, to, platforms, contentTypes));
    }

    @GetMapping("/by-platform")
    @Operation(summary = "Hiệu suất theo nền tảng cho donut + danh sách (khối D)",
            description = "Luôn trả đủ 3 nền tảng FACEBOOK/INSTAGRAM/THREADS kèm số liệu, tỷ trọng tương tác "
                    + "và trạng thái kết nối (connected=false → FE hiển thị CTA 'Kết nối ngay'). KHÔNG áp bộ lọc "
                    + "platforms vì donut thể hiện tỷ trọng giữa các nền tảng — FE phải ghi chú rõ trên card; "
                    + "contentTypes vẫn được áp bình thường.")
    public ApiResponse<List<AnalyticsPlatformResponse>> byPlatform(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<String> contentTypes) {
        return analyticsService.byPlatform(principal.getUsername(),
                new AnalyticsService.AnalyticsQuery(from, to, null, contentTypes));
    }

    @GetMapping("/by-content-type")
    @Operation(summary = "Hiệu suất theo loại nội dung cho donut + legend (khối F)",
            description = "Nhãn lấy từ content_versions.media_format chuẩn hoá IN HOA (IMAGE/VIDEO/TEXT/…); bản "
                    + "chưa định dạng gom vào OTHER. Chỉ trả loại CÓ bài trong kỳ — MVP không có 'Reels' riêng. "
                    + "Đối xứng với /by-platform: KHÔNG áp bộ lọc contentTypes (chiều của chính donut này), "
                    + "vẫn áp platforms.")
    public ApiResponse<List<AnalyticsContentTypeResponse>> byContentType(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<Platform> platforms) {
        return analyticsService.byContentType(principal.getUsername(),
                new AnalyticsService.AnalyticsQuery(from, to, platforms, null));
    }

    @GetMapping("/activity-heatmap")
    @Operation(summary = "Heatmap 7 thứ × 8 khung 3 giờ theo tương tác TB mỗi bài (khối G)",
            description = "dow 1..7 (ISO, 1 = Thứ 2), slot 0..7 (0 = 00:00–02:59). Chỉ trả ô CÓ bài — ô vắng "
                    + "mặt = chưa từng đăng khung đó (FE tô nền trung tính NGOÀI thang màu). max/min CHỈ tính "
                    + "trên ô có posts >= minPostsForScale để một bài lẻ viral không kéo giãn cả thang màu; "
                    + "chưa ô nào đủ mẫu → max/min = null.")
    public ApiResponse<AnalyticsHeatmapResponse> activityHeatmap(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<Platform> platforms,
            @RequestParam(required = false) List<String> contentTypes) {
        return analyticsService.activityHeatmap(principal.getUsername(),
                new AnalyticsService.AnalyticsQuery(from, to, platforms, contentTypes));
    }

    @GetMapping("/insights")
    @Operation(summary = "Dải 'Thông tin chi tiết' — 5 ô tổng kết kèm % so kỳ trước (khối H)",
            description = "goodPosts = bài có tương tác TRÊN mức trung bình của kỳ; needsAttentionPosts = bài "
                    + "ĐĂNG THẤT BẠI trong kỳ (theo thời điểm thất bại, khớp trang 'Bài lỗi & cần xử lý'). "
                    + "goldenHour chỉ xét ô heatmap đủ mẫu, không đủ → null. engagementRatePct = tương tác/lượt "
                    + "xem CHỈ trên bài có lượt xem: Facebook thường không trả lượt xem nên bị loại khỏi mẫu số — "
                    + "ratedPosts/excludedPosts trả kèm để FE chú thích, tránh hiểu nhầm là tỷ lệ toàn kỳ.")
    public ApiResponse<AnalyticsInsightsResponse> insights(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<Platform> platforms,
            @RequestParam(required = false) List<String> contentTypes) {
        return analyticsService.insights(principal.getUsername(),
                new AnalyticsService.AnalyticsQuery(from, to, platforms, contentTypes));
    }

    @GetMapping("/export")
    @Operation(summary = "Export CSV danh sách bài đã đăng theo ĐÚNG bộ lọc đang chọn",
            description = "CSV dạng chuỗi trong result (FE tự tạo file) — cùng quy ước với export log hoạt động "
                    + "và doanh thu. Vượt trần 50.000 dòng → lỗi 2053 kèm hướng dẫn thu hẹp bộ lọc, KHÔNG cắt cụt "
                    + "im lặng. sort giống /top-posts.")
    public ApiResponse<String> export(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<Platform> platforms,
            @RequestParam(required = false) List<String> contentTypes,
            @RequestParam(required = false) String sort) {
        return analyticsService.export(principal.getUsername(),
                new AnalyticsService.AnalyticsQuery(from, to, platforms, contentTypes), sort);
    }

    @GetMapping("/top-posts")
    @Operation(summary = "Bảng 'Top bài viết hiệu quả' — sắp xếp theo cột, giới hạn số dòng (khối E)",
            description = "Cùng bộ lọc from/to/platforms/contentTypes. sort = views|likes|comments|shares|engagement|date "
                    + "[,asc|,desc] (mặc định views,desc); limit kẹp về [1, 50]. MVP không có thumbnail — FE dùng "
                    + "icon nền tảng + caption; contentItemId để mở chi tiết / lọc Quản lý nội dung.")
    public ApiResponse<List<AnalyticsTopPostResponse>> topPosts(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<Platform> platforms,
            @RequestParam(required = false) List<String> contentTypes,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "10") int limit) {
        return analyticsService.topPosts(principal.getUsername(),
                new AnalyticsService.AnalyticsQuery(from, to, platforms, contentTypes), sort, limit);
    }

    @PostMapping("/dev-seed")
    @Operation(summary = "DEV-ONLY: sinh số liệu Phân tích MẪU cho user hiện tại (dựng/demo giao diện)",
            description = "Bật bằng cờ aima.dev.analytics-seed-enabled (mặc định tắt — mã 2052). Tạo hồ sơ + "
                    + "3 kết nối MẪU + bài đã đăng rải 60 ngày kèm snapshot 24h/48h/7d. Idempotent (dọn dữ liệu "
                    + "mẫu cũ trước). PHẢI tắt/gỡ khi có bài đăng thật.")
    public ApiResponse<Integer> devSeed(@AuthenticationPrincipal UserDetails principal) {
        return analyticsService.devSeed(principal.getUsername());
    }

    @DeleteMapping("/dev-seed")
    @Operation(summary = "DEV-ONLY: xoá sạch số liệu Phân tích mẫu đã sinh (chạy lại seed được)")
    public ApiResponse<Integer> devSeedClear(@AuthenticationPrincipal UserDetails principal) {
        return analyticsService.devSeedClear(principal.getUsername());
    }
}
