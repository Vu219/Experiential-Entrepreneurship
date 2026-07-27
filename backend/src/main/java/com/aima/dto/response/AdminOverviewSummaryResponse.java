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
import java.util.UUID;

/**
 * UI-10 — dữ liệu gộp của trang Quản trị → Tổng quan: 4 thẻ KPI, phân bổ gói và bảng người dùng
 * gần đây. MỘT request thay cho ba, cùng mẫu {@code DashboardSummaryResponse} của trang user.
 *
 * <p>Card "Tình trạng hệ thống" KHÔNG nằm ở đây: nó tái dùng {@code GET /admin/system} sẵn có —
 * endpoint đó phải probe DB/Redis/AI nên chậm và dễ lỗi hơn hẳn, tách riêng để một dịch vụ
 * ngoài tầm kiểm soát chết không kéo sập cả trang.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AdminOverviewSummaryResponse", description = "Số liệu gộp của trang Tổng quan quản trị (UI-10).")
public class AdminOverviewSummaryResponse {

    @Schema(description = "4 thẻ KPI trên cùng.")
    AdminOverviewStatsResponse stats;

    @Schema(description = "Phân bổ người dùng theo gói, sắp theo displayOrder của gói.")
    List<PlanDistributionResponse> planDistribution;

    @Schema(description = "Tổng người dùng có subscription — dòng tổng kết cuối card Phân bổ gói.")
    long totalSubscribedUsers;

    @Schema(description = "Người dùng đăng ký gần đây nhất.")
    List<RecentUserResponse> recentUsers;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @Schema(name = "AdminOverviewStatsResponse", description = "Bốn thẻ số liệu của trang Tổng quan.")
    public static class AdminOverviewStatsResponse {

        @Schema(description = "Tổng người dùng (tích lũy).")
        AdminOverviewStatResponse totalUsers;

        @Schema(description = "Số user KHÁC NHAU có hoạt động trong ngày hôm nay.")
        AdminOverviewStatResponse activeToday;

        @Schema(description = "Tổng nội dung đã tạo toàn hệ thống (tích lũy).")
        AdminOverviewStatResponse contentCreated;

        @Schema(description = "Doanh thu định kỳ tháng (VND).")
        AdminOverviewStatResponse monthlyRecurringRevenue;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @Schema(name = "AdminOverviewStatResponse", description = "Một thẻ KPI: giá trị + % thay đổi + chuỗi sparkline.")
    public static class AdminOverviewStatResponse {

        @Schema(description = "Giá trị hiện tại của chỉ số.")
        long total;

        @Schema(description = "% thay đổi so với kỳ trước, đã truy vấn RIÊNG từ DB (không suy ra từ "
                + "hai đầu chuỗi sparkline). null = kỳ trước bằng 0 hoặc không có dữ liệu lịch sử "
                + "để so → FE hiển thị \"—\".")
        Double deltaPct;

        @Schema(description = "7 giá trị, cũ → mới, để vẽ sparkline. Rỗng khi chỉ số không dựng lại "
                + "được lịch sử.")
        List<Long> series;

        @Schema(description = "Mốc so sánh để FE hiển thị đúng chữ: PREV_WEEK | PREV_DAY | NONE.")
        String comparison;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @Schema(name = "PlanDistributionResponse", description = "Một dòng trong card Phân bổ gói.")
    public static class PlanDistributionResponse {

        UUID planId;

        @Schema(example = "PLUS")
        String code;

        String nameVi;
        String nameEn;

        @Schema(description = "Số người dùng đang ở gói này.")
        long userCount;

        @Schema(description = "Tỉ lệ % trên tổng người dùng có subscription, làm tròn 1 chữ số.")
        double sharePct;

        @Schema(description = "Thứ tự hiển thị của gói — FE lấy màu theo chỉ số này (planColor).")
        int displayOrder;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @Schema(name = "RecentUserResponse", description = "Một dòng bảng \"Người dùng gần đây\". "
            + "DTO RIÊNG của module Tổng quan — cố tình không dùng chung UserResponse để trang "
            + "Quản lý người dùng không phải gánh thêm truy vấn đếm nội dung mà nó không cần.")
    public static class RecentUserResponse {

        UUID id;

        String fullName;
        String email;
        String avatarUrl;

        @Schema(description = "Mã gói hiện tại (nhãn trên User).", example = "PLUS")
        String plan;

        @Schema(description = "ACTIVE | LOCKED | PENDING_DELETE.")
        String status;

        @Schema(description = "Số nội dung user đã tạo — lấy bằng MỘT truy vấn GROUP BY cho cả "
                + "danh sách, không đếm từng dòng.")
        long postCount;

        LocalDateTime createdAt;
    }
}
