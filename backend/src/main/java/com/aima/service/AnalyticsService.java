package com.aima.service;

import com.aima.dto.response.AnalyticsContentTypeResponse;
import com.aima.dto.response.AnalyticsHeatmapResponse;
import com.aima.dto.response.AnalyticsInsightsResponse;
import com.aima.dto.response.AnalyticsPlatformResponse;
import com.aima.dto.response.AnalyticsSummaryResponse;
import com.aima.dto.response.AnalyticsTimeseriesResponse;
import com.aima.dto.response.AnalyticsTopPostResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.enums.Platform;

import java.time.LocalDate;
import java.util.List;

/**
 * Số liệu tổng hợp cho trang Phân tích (UI-08, khối B + C). Khác {@link PostAnalyticsService}
 * (danh sách từng bài): dịch vụ này GỘP số liệu theo kỳ/ngày.
 *
 * <p>Nguồn dữ liệu là {@code post_analytics} — số cộng dồn ở các mốc 24h/48h/168h, nên mỗi bài chỉ
 * lấy MỘT snapshot mốc muộn nhất khi gộp (tránh đếm trùng). Mọi truy vấn scope theo user đang đăng
 * nhập qua chuỗi {@code posts → post_schedules → platform_accounts.user_id} (API-03/SEC-04).
 * So sánh luôn theo kỳ liền trước cùng độ dài ({@code compare=previous_period} — chế độ duy nhất).
 */
public interface AnalyticsService {

    /** Kỳ mặc định khi client không truyền from/to. */
    int DEFAULT_RANGE_DAYS = 7;

    /** Trần độ dài kỳ (kể cả tuỳ chọn) để giới hạn chi phí truy vấn và độ dài chuỗi. */
    int MAX_RANGE_DAYS = 366;

    /** Số bài mặc định của bảng "Top bài viết" khi client không truyền limit. */
    int DEFAULT_TOP_POSTS = 10;

    /** Trần số bài của bảng "Top bài viết" một lần trả. */
    int MAX_TOP_POSTS = 50;

    /** Độ dài một khung của heatmap (giờ) — 24 giờ chia thành {@link #HEATMAP_SLOTS} khung. */
    int HEATMAP_SLOT_HOURS = 3;

    /** Số khung mỗi ngày của heatmap (24 / {@link #HEATMAP_SLOT_HOURS}). */
    int HEATMAP_SLOTS = 24 / HEATMAP_SLOT_HOURS;

    /**
     * Số bài tối thiểu để một ô heatmap được tính vào thang màu và được coi là ứng viên "khung giờ
     * vàng". Dưới ngưỡng này, một bài lẻ tình cờ viral sẽ kéo giãn thang màu khiến mọi ô khác nhạt
     * hết, và "khung giờ vàng" suy ra từ một bài là số liệu bịa.
     */
    int MIN_HEATMAP_POSTS = 3;

    /** Trần số dòng một lần export — vượt thì báo lỗi để người dùng thu hẹp bộ lọc, KHÔNG cắt cụt. */
    int MAX_EXPORT_ROWS = 50_000;

    /** Khối B — 4 thẻ KPI kèm % so kỳ trước và sparkline. */
    ApiResponse<AnalyticsSummaryResponse> summary(String email, AnalyticsQuery query);

    /** Khối C — chuỗi 4 metric theo ngày (đã zero-fill). */
    ApiResponse<AnalyticsTimeseriesResponse> timeseries(String email, AnalyticsQuery query);

    /**
     * Khối D — số liệu + trạng thái kết nối theo nền tảng (luôn đủ FB/IG/Threads).
     * KHÔNG áp bộ lọc {@code platforms}: donut thể hiện tỷ trọng GIỮA các nền tảng (lọc còn một nền
     * tảng thì donut chỉ còn một lát 100%). Vẫn áp {@code contentTypes} — đó là chiều khác.
     */
    ApiResponse<List<AnalyticsPlatformResponse>> byPlatform(String email, AnalyticsQuery query);

    /**
     * Khối F — số liệu theo loại nội dung. Đối xứng với {@link #byPlatform}: KHÔNG áp bộ lọc
     * {@code contentTypes} (đó là chiều của chính donut này), nhưng vẫn áp {@code platforms}.
     * Chỉ trả loại CÓ bài trong kỳ.
     */
    ApiResponse<List<AnalyticsContentTypeResponse>> byContentType(String email, AnalyticsQuery query);

    /**
     * Khối G — heatmap 7 thứ × {@link #HEATMAP_SLOTS} khung {@link #HEATMAP_SLOT_HOURS} giờ, tô màu
     * theo TƯƠNG TÁC TRUNG BÌNH MỖI BÀI. Thang màu (max/min) chỉ tính trên ô có ít nhất
     * {@link #MIN_HEATMAP_POSTS} bài; chưa ô nào đủ → max/min = null.
     */
    ApiResponse<AnalyticsHeatmapResponse> activityHeatmap(String email, AnalyticsQuery query);

    /**
     * Khối H — dải "Thông tin chi tiết" (5 ô + % so kỳ liền trước). Khung giờ vàng lấy từ heatmap và
     * cũng chỉ xét ô đủ mẫu (null khi chưa đủ). Tỷ lệ tương tác chỉ tính trên bài CÓ lượt xem.
     */
    ApiResponse<AnalyticsInsightsResponse> insights(String email, AnalyticsQuery query);

    /**
     * Export danh sách bài đã đăng theo đúng bộ lọc đang chọn — CSV dạng chuỗi trong {@code result},
     * FE tự tạo file (cùng quy ước với export log hoạt động / doanh thu). Vượt
     * {@link #MAX_EXPORT_ROWS} dòng thì ném lỗi thay vì cắt cụt im lặng.
     */
    ApiResponse<String> export(String email, AnalyticsQuery query, String sort);

    /**
     * Khối E — bảng "Top bài viết hiệu quả". {@code sort} = một trong
     * {@code views|likes|comments|shares|engagement|date} kèm {@code ,asc|,desc} (mặc định
     * {@code views,desc}); {@code limit} kẹp về [1, {@link #MAX_TOP_POSTS}].
     */
    ApiResponse<List<AnalyticsTopPostResponse>> topPosts(String email, AnalyticsQuery query, String sort, int limit);

    /**
     * DEV-ONLY (cờ {@code aima.dev.analytics-seed-enabled}, mặc định tắt): sinh một hồ sơ thương hiệu
     * MẪU + 3 kết nối MẪU (FB/IG/Threads) + các bài đã đăng rải 60 ngày kèm snapshot 24h/48h/7d để
     * dựng/demo trang Phân tích khi chưa có bài thật đủ 24h. Idempotent (dọn dữ liệu mẫu cũ trước).
     * Trả số bài mẫu đã tạo.
     */
    ApiResponse<Integer> devSeed(String email);

    /** DEV-ONLY: xoá sạch dữ liệu do {@link #devSeed} sinh ra (chạy lại được). Trả số bài mẫu đã xoá. */
    ApiResponse<Integer> devSeedClear(String email);

    /**
     * Bộ lọc đã nhận từ query param, CHƯA phân giải. Service tự đặt mặc định (7 ngày gần nhất),
     * validate và quy ra khoảng thật. {@code platforms} rỗng/null = mọi nền tảng;
     * {@code contentTypes} rỗng/null = mọi loại nội dung (nhãn {@code media_format} IN HOA,
     * {@code OTHER} = bản chưa có định dạng).
     */
    record AnalyticsQuery(LocalDate from, LocalDate to, List<Platform> platforms, List<String> contentTypes) {
    }
}
