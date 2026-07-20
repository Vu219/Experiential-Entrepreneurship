package com.aima.service;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.PlanRevenueResponse;
import com.aima.dto.response.RevenueForecastResponse;
import com.aima.dto.response.RevenueSummaryResponse;
import com.aima.dto.response.RevenueTimeseriesResponse;
import com.aima.dto.response.RevenueTransactionResponse;
import com.aima.enums.PaymentStatus;
import com.aima.enums.RevenueGranularity;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Báo cáo doanh thu cho trang admin {@code /admin/revenue}. Nguồn dữ liệu duy nhất là sổ cái
 * {@code payments}; mọi phép gộp chạy ở tầng DB.
 *
 * <p><b>Công thức doanh thu (chốt 2026-07-20)</b> — NET theo kỳ PHÁT SINH hoàn tiền, KHÔNG hồi tố:
 * <pre>
 *   doanh thu(kỳ) = Σ amount   của đơn PAID/REFUNDED/PARTIALLY_REFUNDED có paid_at     ∈ kỳ
 *                 − Σ refunded_amount của đơn                          có refunded_at ∈ kỳ
 * </pre>
 * Nhờ vậy số liệu của một kỳ đã đóng sổ không bao giờ đổi khi phát sinh hoàn tiền về sau.
 * Đơn PENDING (đang chờ khách trả trên cổng) và FAILED KHÔNG vào doanh thu nhưng vẫn hiện
 * trong bảng giao dịch.
 */
public interface RevenueService {

    /** Trần số dòng cho một lần export — vượt thì báo lỗi kèm số thực tế, không cắt cụt im lặng. */
    int EXPORT_ROW_LIMIT = 50_000;

    ApiResponse<RevenueSummaryResponse> summary(RevenueFilter filter);

    ApiResponse<RevenueTimeseriesResponse> timeseries(RevenueFilter filter);

    ApiResponse<PageResponse<RevenueTransactionResponse>> transactions(RevenueFilter filter,
                                                                       TransactionFilter txFilter,
                                                                       int page, int size, String sort);

    ApiResponse<List<PlanRevenueResponse>> planBreakdown(RevenueFilter filter);

    /** Ước tính doanh thu tháng hiện tại (ngoại suy tuyến tính) — không nhận bộ lọc. */
    ApiResponse<RevenueForecastResponse> forecast();

    /** Số dòng khớp bộ lọc — FE gọi trước Export để báo số thực tế khi vượt trần. */
    ApiResponse<Long> countTransactions(RevenueFilter filter, TransactionFilter txFilter);

    /** Export theo ĐÚNG bộ lọc đang chọn. {@code format} = txt | csv (Excel đọc được csv). */
    ApiResponse<String> export(RevenueFilter filter, TransactionFilter txFilter, String format);

    /**
     * DEV-ONLY (cờ {@code aima.dev.payment-seed-enabled}, mặc định tắt): sinh dữ liệu thanh toán
     * mẫu rải đều 18 tháng gần nhất để dựng/demo giao diện trước khi có cổng thanh toán thật.
     * Trả số bản ghi đã tạo.
     */
    ApiResponse<Integer> devSeed(String actorEmail);

    /** DEV-ONLY: xoá sạch dữ liệu do {@link #devSeed} sinh ra (chạy lại được). Trả số bản ghi đã xoá. */
    ApiResponse<Integer> devSeedClear(String actorEmail);

    /**
     * Bộ lọc thời gian đã nhận từ query param, CHƯA phân giải. Service chịu trách nhiệm
     * validate theo {@code granularity} rồi quy ra khoảng {@code [start, end)} thật.
     */
    record RevenueFilter(RevenueGranularity granularity,
                         Integer year, Integer month, Integer half,
                         Integer fromYear, Integer toYear,
                         LocalDate from, LocalDate to) {
    }

    /** Bộ lọc bổ sung riêng cho bảng giao dịch / export. */
    record TransactionFilter(PaymentStatus status, UUID planId) {
    }
}
