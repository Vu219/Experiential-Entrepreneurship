package com.aima.admin;

import com.aima.dto.response.AdminOverviewSummaryResponse;
import com.aima.dto.response.AdminOverviewSummaryResponse.AdminOverviewStatResponse;
import com.aima.dto.response.AdminOverviewSummaryResponse.PlanDistributionResponse;
import com.aima.entity.User;
import com.aima.enums.SubscriptionStatus;
import com.aima.mapper.AdminOverviewMapper;
import com.aima.repository.ActivityLogRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.repository.projection.DailyCountProjection;
import com.aima.repository.projection.PlanSubscriptionProjection;
import com.aima.service.Impl.AdminOverviewServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.when;

/**
 * Phần TÍNH TOÁN của trang Tổng quan quản trị: công thức doanh thu định kỳ tháng (quy chuẩn theo
 * chu kỳ gói), chuỗi sparkline tích lũy + zero-fill, và % thay đổi lấy từ kỳ trước truy vấn riêng.
 * Repository được mock nên test không cần DB — thứ đang kiểm là logic service, không phải SQL.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminOverviewAggregateTest {

    static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Mock UserRepository userRepository;
    @Mock ContentItemRepository contentItemRepository;
    @Mock ActivityLogRepository activityLogRepository;
    @Mock SubscriptionRepository subscriptionRepository;
    @Mock AdminOverviewMapper adminOverviewMapper;

    @InjectMocks AdminOverviewServiceImpl service;

    @BeforeEach
    void setUp() {
        // @Value không được inject trong unit test — đặt tay để múi giờ tính "hôm nay" là VN.
        ReflectionTestUtils.setField(service, "appTimezone", "Asia/Ho_Chi_Minh");

        when(userRepository.findByDeletedAtIsNullOrderByCreatedAtDesc(any(Pageable.class))).thenReturn(List.of());
        when(subscriptionRepository.aggregateByPlan(any())).thenReturn(List.of());
        when(userRepository.countDailyNewUsers(any())).thenReturn(List.of());
        when(contentItemRepository.countDailyCreated(any())).thenReturn(List.of());
        when(activityLogRepository.countDailyActiveUsers(any())).thenReturn(List.of());
        // Mapper thật chỉ copy field; ở đây chỉ cần sharePct đi đúng đường nên dựng DTO tối giản.
        when(adminOverviewMapper.toPlanDistribution(any(), anyDouble())).thenAnswer(inv -> {
            PlanSubscriptionProjection row = inv.getArgument(0);
            return PlanDistributionResponse.builder()
                    .code(row.getCode())
                    .userCount(row.getUserCount())
                    .sharePct(inv.getArgument(1))
                    .build();
        });
        when(adminOverviewMapper.toRecentUser(any(User.class), anyLong())).thenReturn(null);
    }

    // ---------- helper dựng dữ liệu giả ----------

    private PlanSubscriptionProjection plan(String code, long price, short interval, long userCount) {
        return new PlanSubscriptionProjection() {
            public UUID getPlanId() { return UUID.randomUUID(); }
            public String getCode() { return code; }
            public String getNameVi() { return code; }
            public String getNameEn() { return code; }
            public long getPrice() { return price; }
            public short getBillingIntervalMonths() { return interval; }
            public int getDisplayOrder() { return 1; }
            public long getUserCount() { return userCount; }
        };
    }

    private DailyCountProjection day(LocalDate date, long total) {
        return new DailyCountProjection() {
            public String getDay() { return date.toString(); }
            public long getTotal() { return total; }
        };
    }

    private AdminOverviewSummaryResponse summary() {
        return service.getSummary(5).getResult();
    }

    // ---------- Doanh thu định kỳ tháng ----------

    @Test
    void mrrQuyGiaVeThangTheoChuKyCuaTungGoi() {
        when(subscriptionRepository.aggregateByPlan(SubscriptionStatus.ACTIVE)).thenReturn(List.of(
                plan("FREE", 0L, (short) 1, 10),          // gói 0đ không đóng góp gì
                plan("PLUS", 499_000L, (short) 1, 4),     // gói tháng: cộng nguyên giá
                plan("ANNUAL", 12_000_000L, (short) 12, 3) // gói năm: chia 12 trước khi cộng
        ));

        long mrr = summary().getStats().getMonthlyRecurringRevenue().getTotal();

        // 0 + 499.000×4 + (12.000.000/12)×3 = 1.996.000 + 3.000.000
        assertEquals(4_996_000L, mrr);
    }

    @Test
    void mrrGoiNamKhongBiCongNguyenCucVaoMotThang() {
        when(subscriptionRepository.aggregateByPlan(SubscriptionStatus.ACTIVE)).thenReturn(List.of(
                plan("ANNUAL", 12_000_000L, (short) 12, 1)));

        long mrr = summary().getStats().getMonthlyRecurringRevenue().getTotal();

        assertEquals(1_000_000L, mrr, "Gói năm phải được chia cho 12, không cộng trọn 12 triệu vào MRR");
    }

    @Test
    void mrrChiLamTronOBuocCuoiChuKhongLamTronTungDong() {
        // 1.000 / 3 = 333,33…/user. Làm tròn TỪNG DÒNG sẽ ra 333×3 = 999.
        when(subscriptionRepository.aggregateByPlan(SubscriptionStatus.ACTIVE)).thenReturn(List.of(
                plan("QUARTERLY", 1_000L, (short) 3, 3)));

        long mrr = summary().getStats().getMonthlyRecurringRevenue().getTotal();

        assertEquals(1_000L, mrr);
    }

    @Test
    void mrrGoiGia0KhongDongGopVaKhongLamVoPhepTinh() {
        when(subscriptionRepository.aggregateByPlan(SubscriptionStatus.ACTIVE)).thenReturn(List.of(
                plan("FREE", 0L, (short) 1, 5_000)));

        assertEquals(0L, summary().getStats().getMonthlyRecurringRevenue().getTotal());
    }

    @Test
    void mrrBoQuaGoiCoChuKyKhongHopLeThayViChiaCho0() {
        when(subscriptionRepository.aggregateByPlan(SubscriptionStatus.ACTIVE)).thenReturn(List.of(
                plan("BROKEN", 900_000L, (short) 0, 2),
                plan("PLUS", 499_000L, (short) 1, 1)));

        long mrr = summary().getStats().getMonthlyRecurringRevenue().getTotal();

        assertEquals(499_000L, mrr, "Gói chu kỳ ≤ 0 phải bị bỏ qua, không tạo Infinity");
    }

    @Test
    void mrrKhongCoLichSuNenKhongBaoMocSoSanh() {
        when(subscriptionRepository.aggregateByPlan(SubscriptionStatus.ACTIVE)).thenReturn(List.of(
                plan("PLUS", 499_000L, (short) 1, 2)));

        AdminOverviewStatResponse mrr = summary().getStats().getMonthlyRecurringRevenue();

        assertNull(mrr.getDeltaPct(), "subscriptions cập nhật tại chỗ nên MRR quá khứ không dựng lại được");
        assertTrue(mrr.getSeries().isEmpty());
        assertEquals("NONE", mrr.getComparison());
    }

    // ---------- Phân bổ gói ----------

    @Test
    void phanBoGoiTinhTiLeTrenTongNguoiDungCoSubscription() {
        when(subscriptionRepository.aggregateByPlan(SubscriptionStatus.ACTIVE)).thenReturn(List.of(
                plan("FREE", 0L, (short) 1, 60),
                plan("PLUS", 499_000L, (short) 1, 40)));

        AdminOverviewSummaryResponse summary = summary();

        assertEquals(100L, summary.getTotalSubscribedUsers());
        assertEquals(60.0, summary.getPlanDistribution().get(0).getSharePct());
        assertEquals(40.0, summary.getPlanDistribution().get(1).getSharePct());
    }

    @Test
    void phanBoGoiKhongChiaCho0KhiChuaCoAiDangKy() {
        AdminOverviewSummaryResponse summary = summary();

        assertEquals(0L, summary.getTotalSubscribedUsers());
        assertTrue(summary.getPlanDistribution().isEmpty());
    }

    // ---------- Tổng người dùng (tích lũy, so với tuần trước) ----------

    @Test
    void tongNguoiDungLaySoSanhTuTruyVanKyTruocChuKhongTuHaiDauChuoi() {
        LocalDate today = LocalDate.now(ZONE);
        when(userRepository.countByDeletedAtIsNull()).thenReturn(120L);
        // Tổng tích lũy tại đầu cửa sổ — đây mới là mẫu số của % thay đổi.
        when(userRepository.countByCreatedAtLessThanAndDeletedAtIsNull(any(LocalDateTime.class))).thenReturn(100L);
        when(userRepository.countDailyNewUsers(any())).thenReturn(List.of(
                day(today.minusDays(6), 5),
                day(today, 15)));

        AdminOverviewStatResponse stat = summary().getStats().getTotalUsers();

        assertEquals(120L, stat.getTotal());
        assertEquals(20.0, stat.getDeltaPct()); // (120-100)/100
        assertEquals("PREV_WEEK", stat.getComparison());
    }

    @Test
    void tongNguoiDungDungChuoiTichLuyDu7Diem() {
        LocalDate today = LocalDate.now(ZONE);
        when(userRepository.countByDeletedAtIsNull()).thenReturn(112L);
        when(userRepository.countByCreatedAtLessThanAndDeletedAtIsNull(any(LocalDateTime.class))).thenReturn(100L);
        when(userRepository.countDailyNewUsers(any())).thenReturn(List.of(
                day(today.minusDays(6), 2),
                day(today.minusDays(3), 10)));

        List<Long> series = summary().getStats().getTotalUsers().getSeries();

        assertEquals(7, series.size());
        // Tích lũy, ngày không có user mới vẫn giữ mức cũ (không tụt về 0).
        assertEquals(List.of(102L, 102L, 102L, 112L, 112L, 112L, 112L), series);
    }

    @Test
    void deltaLaNullKhiKyTruocBang0() {
        when(userRepository.countByDeletedAtIsNull()).thenReturn(7L);
        when(userRepository.countByCreatedAtLessThanAndDeletedAtIsNull(any(LocalDateTime.class))).thenReturn(0L);

        assertNull(summary().getStats().getTotalUsers().getDeltaPct(),
                "Kỳ trước = 0 thì không có mẫu số để so — FE hiển thị \"—\"");
    }

    // ---------- Hoạt động hôm nay (theo ngày, so với hôm qua) ----------

    @Test
    void hoatDongHomNayDemUserKhacNhauVaSoVoiHomQua() {
        LocalDate today = LocalDate.now(ZONE);
        when(activityLogRepository.countDailyActiveUsers(any())).thenReturn(List.of(
                day(today.minusDays(1), 25),
                day(today, 30)));

        AdminOverviewStatResponse stat = summary().getStats().getActiveToday();

        assertEquals(30L, stat.getTotal());
        assertEquals(20.0, stat.getDeltaPct()); // (30-25)/25
        assertEquals("PREV_DAY", stat.getComparison());
    }

    @Test
    void hoatDongHomNayZeroFillNgayKhongCoAiHoatDong() {
        LocalDate today = LocalDate.now(ZONE);
        when(activityLogRepository.countDailyActiveUsers(any())).thenReturn(List.of(day(today, 3)));

        List<Long> series = summary().getStats().getActiveToday().getSeries();

        assertEquals(7, series.size());
        assertEquals(List.of(0L, 0L, 0L, 0L, 0L, 0L, 3L), series);
    }

    // ---------- Nội dung đã tạo ----------

    @Test
    void noiDungDaTaoLaTichLuyToanHeThong() {
        LocalDate today = LocalDate.now(ZONE);
        when(contentItemRepository.countAllCreatedBefore(any(LocalDateTime.class))).thenReturn(1_000L);
        when(contentItemRepository.countDailyCreated(any())).thenReturn(List.of(
                day(today.minusDays(6), 100),
                day(today, 100)));

        AdminOverviewStatResponse stat = summary().getStats().getContentCreated();

        assertEquals(1_200L, stat.getTotal());
        assertEquals(20.0, stat.getDeltaPct()); // (1200-1000)/1000
    }
}
