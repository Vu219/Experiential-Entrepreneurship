package com.aima.revenue;

import com.aima.dto.response.RevenueSeriesPointResponse;
import com.aima.dto.response.RevenueSummaryResponse;
import com.aima.dto.response.RevenueTimeseriesResponse;
import com.aima.enums.RevenueGranularity;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.RevenueMapper;
import com.aima.repository.PaymentRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.UserRepository;
import com.aima.service.RevenueService;
import com.aima.service.SystemLogService;
import com.aima.service.Impl.RevenueServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.core.env.Environment;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Logic gộp doanh thu: điền kỳ trống, ranh giới kỳ, và công thức NET (hoàn tiền quy về kỳ
 * PHÁT SINH, không hồi tố). Repository được mock nên test chạy nhanh và không cần DB —
 * thứ đang kiểm là phần tính toán của service, không phải SQL.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RevenueAggregateTest {

    @Mock PaymentRepository paymentRepository;
    @Mock PlanRepository planRepository;
    @Mock UserRepository userRepository;
    @Mock RevenueMapper revenueMapper;
    @Mock SystemLogService systemLogService;
    @Mock Environment environment;

    @InjectMocks RevenueServiceImpl service;

    // ---------- helper dựng dữ liệu giả ----------

    private PaymentRepository.RevenueBucket bucket(LocalDateTime at, long gross, long txn, long refunded) {
        return new PaymentRepository.RevenueBucket() {
            public LocalDateTime getBucket() { return at; }
            public Long getGross() { return gross; }
            public Long getTxnCount() { return txn; }
            public Long getRefunded() { return refunded; }
        };
    }

    private PaymentRepository.RevenueTotals totals(long gross, long txn, long refunded, long failed) {
        return new PaymentRepository.RevenueTotals() {
            public Long getGross() { return gross; }
            public Long getTxnCount() { return txn; }
            public Long getRefunded() { return refunded; }
            public Long getFailedCount() { return failed; }
        };
    }

    private RevenueService.RevenueFilter monthOf(int year, int month) {
        return new RevenueService.RevenueFilter(
                RevenueGranularity.DAY, year, month, null, null, null, null, null);
    }

    // ---------- điền kỳ trống ----------

    @Test
    void timeseries_fillsEmptyBucketsWithZero_soChartKhongGay() {
        // Tháng 2/2026 có 28 ngày; DB chỉ trả về đúng 2 ngày có giao dịch.
        when(paymentRepository.aggregateByBucket(anyString(), any(), any(), any()))
                .thenReturn(List.of(
                        bucket(LocalDateTime.of(2026, 2, 3, 0, 0), 500_000L, 2L, 0L),
                        bucket(LocalDateTime.of(2026, 2, 20, 0, 0), 300_000L, 1L, 0L)));

        RevenueTimeseriesResponse series = service.timeseries(monthOf(2026, 2)).getResult();

        assertEquals(28, series.getPoints().size(), "phải có đủ 28 cột dù DB chỉ trả 2");
        assertEquals(500_000L, series.getPoints().get(2).getRevenue());
        assertEquals(0L, series.getPoints().get(3).getRevenue(), "ngày không có giao dịch = 0, không bị thiếu cột");
        assertEquals(300_000L, series.getPoints().get(19).getRevenue());
        assertEquals("1", series.getPoints().get(0).getLabel());
        assertEquals("28", series.getPoints().get(27).getLabel());
    }

    @Test
    void timeseries_monthGranularity_luonTra12Cot() {
        when(paymentRepository.aggregateByBucket(anyString(), any(), any(), any())).thenReturn(List.of());

        RevenueTimeseriesResponse series = service.timeseries(new RevenueService.RevenueFilter(
                RevenueGranularity.MONTH, 2026, null, null, null, null, null, null)).getResult();

        assertEquals(12, series.getPoints().size());
        assertTrue(series.getPoints().stream().allMatch(p -> p.getRevenue() == 0L));
    }

    @Test
    void timeseries_halfYear_traDung6ThangCuaNuaNamSau() {
        when(paymentRepository.aggregateByBucket(anyString(), any(), any(), any())).thenReturn(List.of());

        RevenueTimeseriesResponse series = service.timeseries(new RevenueService.RevenueFilter(
                RevenueGranularity.HALF_YEAR, 2026, null, 2, null, null, null, null)).getResult();

        assertEquals(6, series.getPoints().size());
        assertEquals("7", series.getPoints().get(0).getLabel());
        assertEquals("12", series.getPoints().get(5).getLabel());
    }

    // ---------- ranh giới kỳ ----------

    @Test
    void resolve_day_dungRanhGioiThangVaKyTruocLaThangTruoc() {
        when(paymentRepository.aggregateByBucket(anyString(), any(), any(), any())).thenReturn(List.of());
        ArgumentCaptor<LocalDateTime> from = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> to = ArgumentCaptor.forClass(LocalDateTime.class);

        service.timeseries(monthOf(2026, 1));

        org.mockito.Mockito.verify(paymentRepository)
                .aggregateByBucket(eq("day"), from.capture(), to.capture(), any());
        assertEquals(LocalDateTime.of(2026, 1, 1, 0, 0), from.getValue());
        // Mốc kết thúc EXCLUSIVE = đầu tháng sau, nên 31/01 23:59 vẫn nằm trong kỳ.
        assertEquals(LocalDateTime.of(2026, 2, 1, 0, 0), to.getValue());
    }

    @Test
    void resolve_custom_coiNgayKetThucLaInclusive() {
        when(paymentRepository.aggregateByBucket(anyString(), any(), any(), any())).thenReturn(List.of());

        RevenueTimeseriesResponse series = service.timeseries(new RevenueService.RevenueFilter(
                RevenueGranularity.CUSTOM, null, null, null, null, null,
                LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5))).getResult();

        assertEquals(5, series.getPoints().size(), "1..5/3 là 5 ngày — ngày cuối phải được tính");
        assertEquals(LocalDateTime.of(2026, 3, 6, 0, 0), series.getPeriodEnd());
    }

    // ---------- công thức NET ----------

    @Test
    void summary_truHoanTienTheoKyPhatSinh() {
        // Kỳ này: thu 10.000.000 từ 20 giao dịch, có 1.000.000 hoàn tiền phát sinh trong kỳ.
        when(paymentRepository.aggregateTotals(any(), any(), any()))
                .thenReturn(totals(10_000_000L, 20L, 1_000_000L, 5L));

        RevenueSummaryResponse summary = service.summary(monthOf(2026, 5)).getResult();

        assertEquals(10_000_000L, summary.getGrossRevenue());
        assertEquals(1_000_000L, summary.getRefundedAmount());
        assertEquals(9_000_000L, summary.getTotalRevenue(), "doanh thu = gộp − hoàn tiền");
        assertEquals(450_000L, summary.getAvgPerTransaction(), "TB tính trên doanh thu NET");
    }

    @Test
    void timeseries_bucketCoTheAm_khiHoanTienLonHonDoanhSo() {
        // Ngày 2: không bán được gì nhưng có hoàn tiền của giao dịch kỳ trước → net âm.
        when(paymentRepository.aggregateByBucket(anyString(), any(), any(), any()))
                .thenReturn(List.of(bucket(LocalDateTime.of(2026, 4, 2, 0, 0), 0L, 0L, 2_000_000L)));

        RevenueTimeseriesResponse series = service.timeseries(monthOf(2026, 4)).getResult();

        RevenueSeriesPointResponse day2 = series.getPoints().get(1);
        assertEquals(-2_000_000L, day2.getRevenue(), "không được kẹp về 0 — âm là con số đúng");
        assertEquals(0L, day2.getGross());
        assertEquals(2_000_000L, day2.getRefunded());
    }

    @Test
    void summary_deltaPctNullKhiKyTruocBangKhong() {
        when(paymentRepository.aggregateTotals(any(), any(), any()))
                .thenReturn(totals(0L, 0L, 0L, 0L));

        RevenueSummaryResponse summary = service.summary(monthOf(2026, 6)).getResult();

        assertNull(summary.getRevenueDeltaPct(), "không có mẫu số thì trả null, không phải +∞%");
        assertNull(summary.getFailureRatePct(), "kỳ không có giao dịch nào thì tỉ lệ lỗi vô nghĩa");
        assertEquals(0L, summary.getAvgPerTransaction());
    }

    @Test
    void summary_tinhTiLeThatBaiTrenTongSoLanThu() {
        when(paymentRepository.aggregateTotals(any(), any(), any()))
                .thenReturn(totals(9_000_000L, 9L, 0L, 1L));

        RevenueSummaryResponse summary = service.summary(monthOf(2026, 6)).getResult();

        assertEquals(10.0, summary.getFailureRatePct(), "1 hỏng / (9 thành công + 1 hỏng)");
    }

    @Test
    void summary_comparisonDoiTheoCheDoLoc() {
        when(paymentRepository.aggregateTotals(any(), any(), any())).thenReturn(totals(0L, 0L, 0L, 0L));

        assertEquals("PREV_MONTH", service.summary(monthOf(2026, 6)).getResult().getComparison());
        assertEquals("PREV_YEAR", service.summary(new RevenueService.RevenueFilter(
                RevenueGranularity.MONTH, 2026, null, null, null, null, null, null))
                .getResult().getComparison());
        assertEquals("PREV_HALF", service.summary(new RevenueService.RevenueFilter(
                RevenueGranularity.HALF_YEAR, 2026, null, 1, null, null, null, null))
                .getResult().getComparison());
    }

    // ---------- validate tham số ----------

    @Test
    void resolve_thieuThamSoThiBaoLoiRoRang() {
        AppException error = assertThrows(AppException.class, () -> service.timeseries(
                new RevenueService.RevenueFilter(RevenueGranularity.DAY, 2026, null, null, null, null, null, null)));
        assertEquals(ErrorCode.REVENUE_PARAM_REQUIRED, error.getErrorCode());
    }

    @Test
    void resolve_chanKhoangTuyChinhQuaDai() {
        AppException error = assertThrows(AppException.class, () -> service.timeseries(
                new RevenueService.RevenueFilter(RevenueGranularity.CUSTOM, null, null, null, null, null,
                        LocalDate.of(2020, 1, 1), LocalDate.of(2026, 1, 1))));
        assertEquals(ErrorCode.REVENUE_RANGE_TOO_LARGE, error.getErrorCode());
    }

    @Test
    void resolve_chanKhoangNamNguoc() {
        AppException error = assertThrows(AppException.class, () -> service.timeseries(
                new RevenueService.RevenueFilter(RevenueGranularity.YEAR, null, null, null, 2026, 2022, null, null)));
        assertEquals(ErrorCode.REVENUE_RANGE_INVALID, error.getErrorCode());
    }

    @Test
    void devSeed_bịChanKhiCoTat() {
        AppException error = assertThrows(AppException.class, () -> service.devSeed("admin@gmail.com"));
        assertEquals(ErrorCode.DEV_PAYMENT_SEED_DISABLED, error.getErrorCode(),
                "cờ mặc định false nên seeder phải từ chối");
    }
}
