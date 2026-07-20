package com.aima.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * KPI của trang "Quản lý doanh thu": 3 thẻ trên cùng + % so kỳ trước + sparkline.
 * Doanh thu là NET (gộp − hoàn tiền phát sinh trong kỳ) — xem {@code RevenueServiceImpl}.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "RevenueSummaryResponse", description = "KPI doanh thu của kỳ đang lọc.")
public class RevenueSummaryResponse {

    @Schema(description = "Doanh thu NET của kỳ (VND): tổng đã thu − tổng hoàn tiền phát sinh trong kỳ.")
    Long totalRevenue;

    @Schema(description = "Tổng đã thu trước khi trừ hoàn tiền (VND).")
    Long grossRevenue;

    @Schema(description = "Tổng hoàn tiền PHÁT SINH trong kỳ này (VND) — không hồi tố về kỳ giao dịch gốc.")
    Long refundedAmount;

    @Schema(description = "Số giao dịch đã thu được tiền trong kỳ.")
    Long transactionCount;

    @Schema(description = "Giá trị trung bình mỗi giao dịch = totalRevenue / transactionCount (0 khi chưa có giao dịch).")
    Long avgPerTransaction;

    @Schema(description = "Số giao dịch THẤT BẠI trong kỳ (không tính vào doanh thu; theo dõi sức khoẻ cổng thanh toán).")
    Long failedCount;

    @Schema(description = "Tỉ lệ thất bại % = failedCount / (transactionCount + failedCount). null khi kỳ không có giao dịch nào.")
    Double failureRatePct;

    @Schema(description = "% thay đổi doanh thu so kỳ trước. null khi kỳ trước bằng 0 (không có mẫu số để so).")
    Double revenueDeltaPct;

    @Schema(description = "% thay đổi số giao dịch so kỳ trước. null khi kỳ trước bằng 0.")
    Double transactionDeltaPct;

    @Schema(description = "% thay đổi giá trị TB/giao dịch so kỳ trước. null khi kỳ trước bằng 0.")
    Double avgDeltaPct;

    @Schema(description = "Loại kỳ so sánh để FE hiển thị đúng chữ: PREV_MONTH | PREV_YEAR | PREV_HALF | PREV_RANGE.")
    String comparison;

    // Sparkline của 3 thẻ KPI KHÔNG trả ở đây: trang luôn tải kèm /timeseries, FE tự lấy
    // chuỗi revenue/transactions từ đó — tránh chạy lại y hệt bộ query gộp lần thứ hai.

    @Schema(description = "Đầu kỳ (inclusive), giờ VN.")
    LocalDateTime periodStart;

    @Schema(description = "Cuối kỳ (exclusive), giờ VN.")
    LocalDateTime periodEnd;
}
