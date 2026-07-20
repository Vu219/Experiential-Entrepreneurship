package com.aima.controller;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.PlanRevenueResponse;
import com.aima.dto.response.RevenueForecastResponse;
import com.aima.dto.response.RevenueSummaryResponse;
import com.aima.dto.response.RevenueTimeseriesResponse;
import com.aima.dto.response.RevenueTransactionResponse;
import com.aima.enums.PaymentStatus;
import com.aima.enums.RevenueGranularity;
import com.aima.service.RevenueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Quản lý doanh thu (trang admin {@code /admin/revenue}). Nguồn dữ liệu: sổ cái {@code payments}.
 *
 * <p>Bộ lọc thời gian dùng CHUNG cho mọi endpoint để chart, KPI, bảng giao dịch và export luôn
 * nói về cùng một kỳ: {@code granularity} + các tham số phạm vi tương ứng. Service validate
 * và quy ra khoảng thật; thiếu tham số → mã 2038, khoảng vô lý → 2039, quá dài → 2040.
 */
@RestController
@RequestMapping("/admin/revenue")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin · Revenue", description = "Báo cáo doanh thu gộp từ sổ cái payments — "
        + "doanh thu NET theo kỳ phát sinh hoàn tiền, không hồi tố về kỳ giao dịch gốc.")
public class AdminRevenueController {

    RevenueService revenueService;

    @GetMapping("/summary")
    @Operation(summary = "KPI của kỳ: doanh thu net, số giao dịch, giá trị TB/giao dịch, tỉ lệ thất bại "
            + "+ % so kỳ trước (loại kỳ so sánh trả về ở trường comparison)")
    public ApiResponse<RevenueSummaryResponse> summary(
            @RequestParam(required = false) RevenueGranularity granularity,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer half,
            @RequestParam(required = false) Integer fromYear,
            @RequestParam(required = false) Integer toYear,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return revenueService.summary(new RevenueService.RevenueFilter(
                granularity, year, month, half, fromYear, toYear, from, to));
    }

    @GetMapping("/timeseries")
    @Operation(summary = "Chuỗi doanh thu theo thời gian — đã ĐIỀN 0 cho các kỳ không có giao dịch "
            + "để chart không bị gãy; FE cũng lấy sparkline của thẻ KPI từ đây")
    public ApiResponse<RevenueTimeseriesResponse> timeseries(
            @RequestParam(required = false) RevenueGranularity granularity,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer half,
            @RequestParam(required = false) Integer fromYear,
            @RequestParam(required = false) Integer toYear,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return revenueService.timeseries(new RevenueService.RevenueFilter(
                granularity, year, month, half, fromYear, toYear, from, to));
    }

    @GetMapping("/transactions")
    @Operation(summary = "Bảng giao dịch của kỳ, phân trang server-side. Đơn PENDING/FAILED KHÔNG vào "
            + "doanh thu nhưng vẫn hiện ở đây. sort = date|amount[,asc|desc]")
    public ApiResponse<PageResponse<RevenueTransactionResponse>> transactions(
            @RequestParam(required = false) RevenueGranularity granularity,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer half,
            @RequestParam(required = false) Integer fromYear,
            @RequestParam(required = false) Integer toYear,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) UUID planId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String sort) {
        return revenueService.transactions(
                new RevenueService.RevenueFilter(granularity, year, month, half, fromYear, toYear, from, to),
                new RevenueService.TransactionFilter(status, planId), page, size, sort);
    }

    @GetMapping("/plan-breakdown")
    @Operation(summary = "Cơ cấu theo gói (donut). Danh sách gói lấy ĐỘNG từ bảng plans — gói chưa bán "
            + "được vẫn trả về với số 0, gói admin thêm mới tự xuất hiện")
    public ApiResponse<List<PlanRevenueResponse>> planBreakdown(
            @RequestParam(required = false) RevenueGranularity granularity,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer half,
            @RequestParam(required = false) Integer fromYear,
            @RequestParam(required = false) Integer toYear,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return revenueService.planBreakdown(new RevenueService.RevenueFilter(
                granularity, year, month, half, fromYear, toYear, from, to));
    }

    @GetMapping("/forecast")
    @Operation(summary = "Doanh thu dự kiến THÁNG HIỆN TẠI — ngoại suy tuyến tính từ thực tế đã ghi nhận; "
            + "không nhận bộ lọc")
    public ApiResponse<RevenueForecastResponse> forecast() {
        return revenueService.forecast();
    }

    @GetMapping("/transactions/count")
    @Operation(summary = "Số dòng khớp bộ lọc — FE gọi trước Export để báo số thực tế khi vượt trần 50.000")
    public ApiResponse<Long> countTransactions(
            @RequestParam(required = false) RevenueGranularity granularity,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer half,
            @RequestParam(required = false) Integer fromYear,
            @RequestParam(required = false) Integer toYear,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) UUID planId) {
        return revenueService.countTransactions(
                new RevenueService.RevenueFilter(granularity, year, month, half, fromYear, toYear, from, to),
                new RevenueService.TransactionFilter(status, planId));
    }

    @GetMapping("/export")
    @Operation(summary = "Export theo ĐÚNG bộ lọc đang chọn (chuỗi trong result — FE tạo file). "
            + "format = txt | csv (Excel đọc được csv). Vượt 50.000 dòng → lỗi 2041, không cắt cụt im lặng. "
            + "PDF do FE in bằng window.print(), không đi qua endpoint này")
    public ApiResponse<String> export(
            @RequestParam(required = false) RevenueGranularity granularity,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer half,
            @RequestParam(required = false) Integer fromYear,
            @RequestParam(required = false) Integer toYear,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) UUID planId,
            @RequestParam(defaultValue = "csv") String format) {
        return revenueService.export(
                new RevenueService.RevenueFilter(granularity, year, month, half, fromYear, toYear, from, to),
                new RevenueService.TransactionFilter(status, planId), format);
    }

    @PostMapping("/dev-seed")
    @Operation(summary = "DEV-ONLY (cờ aima.dev.payment-seed-enabled, mặc định tắt — mã 2042): sinh dữ liệu "
            + "thanh toán MẪU rải 18 tháng để dựng/demo giao diện trước khi có cổng payOS. "
            + "PHẢI tắt/gỡ khi có thanh toán thật")
    public ApiResponse<Integer> devSeed(@AuthenticationPrincipal UserDetails principal) {
        return revenueService.devSeed(principal.getUsername());
    }

    @DeleteMapping("/dev-seed")
    @Operation(summary = "DEV-ONLY: xoá sạch dữ liệu do dev-seed sinh ra (chạy lại seed được)")
    public ApiResponse<Integer> devSeedClear(@AuthenticationPrincipal UserDetails principal) {
        return revenueService.devSeedClear(principal.getUsername());
    }
}
