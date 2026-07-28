package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Khối H — dải "Thông tin chi tiết": 5 ô tổng kết kỳ, mỗi ô kèm % thay đổi so với kỳ liền trước
 * (null khi kỳ trước bằng 0 — cùng quy ước với các thẻ KPI).
 *
 * <p><b>Hai ô KHÔNG cùng một thang, không được trình bày như hai nửa của một tổng:</b>
 * <ul>
 *   <li>{@code goodPosts} — bài đã đăng có tương tác TRÊN mức trung bình của chính kỳ này.</li>
 *   <li>{@code needsAttentionPosts} — bài ĐĂNG THẤT BẠI (trạng thái FAILED) trong kỳ, tính theo
 *       thời điểm thất bại giống hệt trang "Bài lỗi & cần xử lý" mà ô này điều hướng tới.</li>
 * </ul>
 *
 * <p><b>Cảnh báo diễn giải {@code engagementRatePct}:</b> tỷ lệ = tương tác / lượt xem, mà Facebook
 * chỉ trả lượt xem khi có quyền {@code read_insights} → phần lớn bài Facebook có views null và bị
 * LOẠI khỏi mẫu số. Vì vậy chỉ số này thực tế chủ yếu phản ánh Instagram/Threads. {@code ratedPosts}
 * / {@code excludedPosts} trả kèm để FE chú thích rõ trên ô, tránh hiểu nhầm là tỷ lệ toàn kỳ.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AnalyticsInsightsResponse", description = "5 ô tổng kết kỳ kèm % thay đổi so kỳ liền trước.")
public class AnalyticsInsightsResponse {

    @Schema(description = "Ngày đầu kỳ.", example = "2026-07-13")
    String from;

    @Schema(description = "Ngày cuối kỳ.", example = "2026-07-19")
    String to;

    @Schema(description = "Ngày đầu kỳ so sánh.", example = "2026-07-06")
    String compareFrom;

    @Schema(description = "Ngày cuối kỳ so sánh.", example = "2026-07-12")
    String compareTo;

    @Schema(description = "Tổng bài đã đăng trong kỳ.", example = "24")
    long totalPosts;

    @Schema(description = "% thay đổi tổng bài so kỳ trước; null khi kỳ trước = 0.", example = "20.0")
    Double totalPostsDeltaPct;

    @Schema(description = "Số bài có tương tác TRÊN mức trung bình của kỳ.", example = "9")
    long goodPosts;

    @Schema(description = "% thay đổi số bài trên trung bình; null khi kỳ trước = 0.", example = "12.5")
    Double goodPostsDeltaPct;

    @Schema(description = "Mức tương tác trung bình mỗi bài của kỳ — chính là ngưỡng của goodPosts.",
            example = "148.5")
    double avgEngagementPerPost;

    @Schema(description = "Số bài đăng THẤT BẠI trong kỳ (đích điều hướng: trang Bài lỗi & cần xử lý).",
            example = "3")
    long needsAttentionPosts;

    @Schema(description = "% thay đổi số bài lỗi; null khi kỳ trước = 0.", example = "-25.0")
    Double needsAttentionDeltaPct;

    @Schema(description = "Khung giờ vàng; null khi chưa ô nào đủ mẫu → FE hiện 'Chưa đủ dữ liệu'.")
    AnalyticsGoldenHourResponse goldenHour;

    @Schema(description = "Tỷ lệ tương tác TB (%) = tương tác / lượt xem trên các bài CÓ lượt xem; "
            + "null khi không bài nào có lượt xem.", example = "4.8")
    Double engagementRatePct;

    @Schema(description = "% thay đổi tỷ lệ tương tác; null khi kỳ trước không tính được.", example = "6.2")
    Double engagementRateDeltaPct;

    @Schema(description = "Số bài ĐƯỢC tính vào tỷ lệ tương tác (có lượt xem).", example = "11")
    long ratedPosts;

    @Schema(description = "Số bài BỊ LOẠI khỏi tỷ lệ tương tác vì nền tảng không trả lượt xem "
            + "(chủ yếu Facebook thiếu quyền read_insights).", example = "13")
    long excludedPosts;
}
