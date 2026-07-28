package com.aima.analytics;

import com.aima.dto.response.AnalyticsContentTypeResponse;
import com.aima.dto.response.AnalyticsHeatmapCellResponse;
import com.aima.dto.response.AnalyticsHeatmapResponse;
import com.aima.dto.response.AnalyticsInsightsResponse;
import com.aima.dto.response.AnalyticsPlatformResponse;
import com.aima.dto.response.AnalyticsSummaryResponse;
import com.aima.dto.response.AnalyticsTimeseriesResponse;
import com.aima.entity.PlatformAccount;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.Platform;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.AnalyticsMapper;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostAnalyticsRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.UserRepository;
import com.aima.repository.projection.ContentTypeMetricProjection;
import com.aima.repository.projection.DailyEngagementProjection;
import com.aima.repository.projection.HeatmapCellProjection;
import com.aima.repository.projection.PlatformMetricProjection;
import com.aima.repository.projection.PostEngagementProjection;
import com.aima.repository.projection.TopPostProjection;
import com.aima.service.AnalyticsService;
import com.aima.service.Impl.AnalyticsServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Logic gộp của trang Phân tích: zero-fill ngày trống, tổng theo kỳ, % so kỳ liền trước, quy kỳ
 * mặc định và chặn khoảng vô lý. Repository được mock nên test kiểm phần TÍNH TOÁN của service,
 * không phải SQL — chạy nhanh, không cần DB.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AnalyticsAggregateTest {

    static final String EMAIL = "u@a.com";
    static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Mock PostAnalyticsRepository postAnalyticsRepository;
    @Mock PlatformAccountRepository platformAccountRepository;
    @Mock BrandProfileRepository brandProfileRepository;
    @Mock PostRepository postRepository;
    @Mock UserRepository userRepository;
    @Mock AnalyticsMapper analyticsMapper;
    @Mock org.springframework.core.env.Environment environment;

    @InjectMocks AnalyticsServiceImpl service;

    @BeforeEach
    void stubUser() {
        User user = new User();
        user.setId(USER_ID);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
    }

    // ---------- helper ----------

    private DailyEngagementProjection row(String day, long views, long likes, long comments, long shares) {
        return new DailyEngagementProjection() {
            public String getDay() { return day; }
            public long getViews() { return views; }
            public long getLikes() { return likes; }
            public long getComments() { return comments; }
            public long getShares() { return shares; }
        };
    }

    private AnalyticsService.AnalyticsQuery range(String from, String to) {
        return new AnalyticsService.AnalyticsQuery(LocalDate.parse(from), LocalDate.parse(to), null, null);
    }

    // ---------- tổng + zero-fill + series ----------

    @Test
    void summary_tinhTongVaSeries7Ngay_zeroFillNgayTrong() {
        // Kỳ 01→07/06 (7 ngày); DB chỉ trả 2 ngày có bài. Kỳ so sánh trả rỗng.
        when(postAnalyticsRepository.findDailyEngagementForUser(any(), any(), any(), any(), any()))
                .thenReturn(
                        List.of(row("2026-06-02", 100, 10, 2, 1),
                                row("2026-06-05", 50, 5, 1, 0)),
                        List.of());

        AnalyticsSummaryResponse summary = service.summary(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertEquals(7, summary.getRangeDays());
        assertEquals(150, summary.getViews().getTotal(), "tổng views = 100 + 50");
        assertEquals(15, summary.getLikes().getTotal());
        assertEquals(3, summary.getComments().getTotal());
        assertEquals(1, summary.getShares().getTotal());

        List<Long> viewsSeries = summary.getViews().getSeries();
        assertEquals(7, viewsSeries.size(), "đủ 7 điểm dù DB chỉ trả 2 ngày");
        assertEquals(0L, viewsSeries.get(0), "01/06 không có bài → 0");
        assertEquals(100L, viewsSeries.get(1), "02/06");
        assertEquals(50L, viewsSeries.get(4), "05/06");

        // Nhãn kỳ so sánh = 7 ngày liền trước.
        assertEquals("2026-05-25", summary.getCompareFrom());
        assertEquals("2026-05-31", summary.getCompareTo());
    }

    @Test
    void summary_deltaPctNull_khiKyTruocBangKhong() {
        when(postAnalyticsRepository.findDailyEngagementForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(row("2026-06-02", 100, 10, 2, 1)), List.of());

        AnalyticsSummaryResponse summary = service.summary(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertNull(summary.getViews().getDeltaPct(), "kỳ trước = 0 thì trả null, không phải +∞%");
    }

    @Test
    void summary_deltaPct_soSanhKyTruoc() {
        // Kỳ này views 150, kỳ trước views 100 → +50%.
        when(postAnalyticsRepository.findDailyEngagementForUser(any(), any(), any(), any(), any()))
                .thenReturn(
                        List.of(row("2026-06-02", 100, 0, 0, 0), row("2026-06-05", 50, 0, 0, 0)),
                        List.of(row("2026-05-26", 100, 0, 0, 0)));

        AnalyticsSummaryResponse summary = service.summary(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertEquals(50.0, summary.getViews().getDeltaPct());
    }

    @Test
    void timeseries_zeroFillDuSoNgay() {
        when(postAnalyticsRepository.findDailyEngagementForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(row("2026-06-03", 80, 8, 2, 1)));

        AnalyticsTimeseriesResponse ts = service.timeseries(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertEquals(7, ts.getPoints().size());
        assertEquals("2026-06-01", ts.getPoints().get(0).getDate());
        assertEquals(0L, ts.getPoints().get(0).getViews());
        assertEquals(80L, ts.getPoints().get(2).getViews(), "03/06");
        assertEquals(8L, ts.getPoints().get(2).getLikes());
    }

    // ---------- quy kỳ mặc định + biên truy vấn ----------

    @Test
    void summary_khongTruyenNgay_macDinh7NgayGanNhat() {
        when(postAnalyticsRepository.findDailyEngagementForUser(any(), any(), any(), any(), any())).thenReturn(List.of());

        AnalyticsSummaryResponse summary = service.summary(EMAIL,
                new AnalyticsService.AnalyticsQuery(null, null, null, null)).getResult();

        assertEquals(7, summary.getRangeDays());
        assertEquals(7, summary.getViews().getSeries().size());
    }

    @Test
    void fetch_mocKetThucExclusive_baoGomCaNgayCuoi() {
        when(postAnalyticsRepository.findDailyEngagementForUser(any(), any(), any(), any(), any())).thenReturn(List.of());
        ArgumentCaptor<LocalDateTime> from = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> to = ArgumentCaptor.forClass(LocalDateTime.class);

        service.timeseries(EMAIL, range("2026-06-01", "2026-06-07"));

        verify(postAnalyticsRepository).findDailyEngagementForUser(eq(USER_ID), from.capture(), to.capture(), any(), any());
        assertEquals(LocalDateTime.of(2026, 6, 1, 0, 0), from.getValue());
        assertEquals(LocalDateTime.of(2026, 6, 8, 0, 0), to.getValue(), "mốc kết thúc exclusive = đầu ngày 08 để 07 vẫn trong kỳ");
    }

    // ---------- lọc nền tảng ----------

    @Test
    void platformFilter_noiTenBangDauPhay() {
        when(postAnalyticsRepository.findDailyEngagementForUser(any(), any(), any(), anyString(), any())).thenReturn(List.of());
        ArgumentCaptor<String> csv = ArgumentCaptor.forClass(String.class);

        service.timeseries(EMAIL, new AnalyticsService.AnalyticsQuery(
                LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-07"),
                List.of(Platform.FACEBOOK, Platform.THREADS), null));

        verify(postAnalyticsRepository).findDailyEngagementForUser(any(), any(), any(), csv.capture(), any());
        assertEquals("FACEBOOK,THREADS", csv.getValue());
    }

    @Test
    void platformFilter_rong_truyenNull() {
        when(postAnalyticsRepository.findDailyEngagementForUser(any(), any(), any(), any(), any())).thenReturn(List.of());
        ArgumentCaptor<String> csv = ArgumentCaptor.forClass(String.class);

        service.timeseries(EMAIL, range("2026-06-01", "2026-06-07"));

        verify(postAnalyticsRepository).findDailyEngagementForUser(any(), any(), any(), csv.capture(), any());
        assertNull(csv.getValue(), "không lọc nền tảng → null để truy vấn bỏ điều kiện");
    }

    // ---------- chặn khoảng vô lý ----------

    @Test
    void resolve_tuNgaySauDenNgay_baoLoi() {
        AppException error = assertThrows(AppException.class,
                () -> service.summary(EMAIL, range("2026-06-10", "2026-06-01")));
        assertEquals(ErrorCode.ANALYTICS_RANGE_INVALID, error.getErrorCode());
    }

    @Test
    void resolve_khoangQuaDai_baoLoi() {
        AppException error = assertThrows(AppException.class,
                () -> service.summary(EMAIL, range("2020-01-01", "2026-01-01")));
        assertEquals(ErrorCode.ANALYTICS_RANGE_TOO_LARGE, error.getErrorCode());
    }

    // ---------- khối D — hiệu suất theo nền tảng ----------

    private PlatformMetricProjection platformRow(String platform, long views, long likes,
                                                 long comments, long shares, long engagement) {
        return new PlatformMetricProjection() {
            public String getPlatform() { return platform; }
            public long getViews() { return views; }
            public long getLikes() { return likes; }
            public long getComments() { return comments; }
            public long getShares() { return shares; }
            public long getEngagement() { return engagement; }
        };
    }

    private PlatformAccount account(Platform platform, ConnectionStatus status, String name) {
        PlatformAccount account = new PlatformAccount();
        account.setPlatformName(platform);
        account.setConnectionStatus(status);
        account.setAccountName(name);
        return account;
    }

    @Test
    void byPlatform_du3NenTang_tyTrongVaTrangThaiKetNoi() {
        when(postAnalyticsRepository.findPlatformMetricsForUser(any(), any(), any(), any()))
                .thenReturn(List.of(
                        platformRow("FACEBOOK", 8000, 600, 150, 50, 800),
                        platformRow("THREADS", 2000, 150, 40, 10, 200)));
        when(platformAccountRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(
                        account(Platform.FACEBOOK, ConnectionStatus.ACTIVE, "FB Page"),
                        account(Platform.THREADS, ConnectionStatus.EXPIRED, "Threads acc")));

        List<AnalyticsPlatformResponse> list = service.byPlatform(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertEquals(3, list.size(), "luôn đủ FB/IG/Threads");
        // Thứ tự theo Platform.values(): FACEBOOK, INSTAGRAM, THREADS.
        AnalyticsPlatformResponse fb = list.get(0);
        assertEquals(Platform.FACEBOOK, fb.getPlatform());
        assertTrue(fb.isConnected());
        assertEquals("FB Page", fb.getAccountName());
        assertEquals(80.0, fb.getSharePct(), "800 / 1000 tương tác");

        AnalyticsPlatformResponse ig = list.get(1);
        assertEquals(Platform.INSTAGRAM, ig.getPlatform());
        assertFalse(ig.isConnected(), "chưa kết nối → FE hiện CTA");
        assertNull(ig.getAccountName());
        assertEquals(0L, ig.getViews());
        assertEquals(0.0, ig.getSharePct());

        AnalyticsPlatformResponse threads = list.get(2);
        assertFalse(threads.isConnected(), "EXPIRED không phải ACTIVE");
        assertEquals(ConnectionStatus.EXPIRED, threads.getStatus());
        assertEquals(20.0, threads.getSharePct());
    }

    @Test
    void byPlatform_khongCoTuongTac_sharePct0_khongChiaCho0() {
        when(postAnalyticsRepository.findPlatformMetricsForUser(any(), any(), any(), any())).thenReturn(List.of());
        when(platformAccountRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of());

        List<AnalyticsPlatformResponse> list = service.byPlatform(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertEquals(3, list.size());
        list.forEach(p -> {
            assertEquals(0.0, p.getSharePct());
            assertFalse(p.isConnected());
        });
    }

    // ---------- khối E — top bài viết ----------

    private TopPostProjection topRow(long views) {
        return new TopPostProjection() {
            public UUID getPostId() { return UUID.randomUUID(); }
            public UUID getContentItemId() { return null; }
            public String getPlatform() { return "FACEBOOK"; }
            public String getCaption() { return null; }
            public String getAccountName() { return null; }
            public LocalDateTime getPublishedAt() { return LocalDateTime.of(2026, 6, 3, 9, 0); }
            public long getViews() { return views; }
            public long getLikes() { return 0; }
            public long getComments() { return 0; }
            public long getShares() { return 0; }
            public long getEngagement() { return 0; }
        };
    }

    @SuppressWarnings("unchecked")
    @Test
    void topPosts_macDinhViewsGiamDan_vaKepLimit() {
        when(analyticsMapper.toTopPostResponseList(any())).thenReturn(List.of());
        when(postAnalyticsRepository.findTopPostsForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(topRow(10), topRow(30), topRow(20)));
        ArgumentCaptor<List<TopPostProjection>> captor = ArgumentCaptor.forClass(List.class);

        service.topPosts(EMAIL, range("2026-06-01", "2026-06-07"), null, 2);

        verify(analyticsMapper).toTopPostResponseList(captor.capture());
        List<TopPostProjection> passed = captor.getValue();
        assertEquals(2, passed.size(), "limit 2");
        assertEquals(30, passed.get(0).getViews(), "views giảm dần");
        assertEquals(20, passed.get(1).getViews());
    }

    @SuppressWarnings("unchecked")
    @Test
    void topPosts_sortTuyChon_tangDan() {
        when(analyticsMapper.toTopPostResponseList(any())).thenReturn(List.of());
        when(postAnalyticsRepository.findTopPostsForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(topRow(10), topRow(30), topRow(20)));
        ArgumentCaptor<List<TopPostProjection>> captor = ArgumentCaptor.forClass(List.class);

        service.topPosts(EMAIL, range("2026-06-01", "2026-06-07"), "views,asc", 10);

        verify(analyticsMapper).toTopPostResponseList(captor.capture());
        List<TopPostProjection> passed = captor.getValue();
        assertEquals(10, passed.get(0).getViews(), "views tăng dần");
        assertEquals(30, passed.get(2).getViews());
    }

    @SuppressWarnings("unchecked")
    @Test
    void topPosts_sortLa_roiVeMacDinh() {
        when(analyticsMapper.toTopPostResponseList(any())).thenReturn(List.of());
        when(postAnalyticsRepository.findTopPostsForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(topRow(10), topRow(30), topRow(20)));
        ArgumentCaptor<List<TopPostProjection>> captor = ArgumentCaptor.forClass(List.class);

        service.topPosts(EMAIL, range("2026-06-01", "2026-06-07"), "hacky_column;drop", 10);

        verify(analyticsMapper).toTopPostResponseList(captor.capture());
        assertEquals(30, captor.getValue().get(0).getViews(), "cột lạ → mặc định views giảm dần, không ném lỗi");
    }

    // ---------- khối F — hiệu suất theo loại nội dung ----------

    private ContentTypeMetricProjection typeRow(String label, long posts, long engagement) {
        return new ContentTypeMetricProjection() {
            public String getLabel() { return label; }
            public long getPosts() { return posts; }
            public long getViews() { return 0; }
            public long getLikes() { return 0; }
            public long getComments() { return 0; }
            public long getShares() { return 0; }
            public long getEngagement() { return engagement; }
        };
    }

    /** Mapper thật là MapStruct; ở đây mock nên tự dựng DTO để test phần TÍNH của service. */
    private void stubContentTypeMapper() {
        when(analyticsMapper.toContentTypeResponseList(any())).thenAnswer(call -> {
            List<ContentTypeMetricProjection> rows = call.getArgument(0);
            return rows.stream()
                    .map(r -> AnalyticsContentTypeResponse.builder()
                            .label(r.getLabel()).posts(r.getPosts()).engagement(r.getEngagement()).build())
                    .collect(Collectors.toCollection(ArrayList::new));
        });
    }

    @Test
    void byContentType_boQuaLocLoaiNoiDung_nhungVanApLocNenTang() {
        stubContentTypeMapper();
        when(postAnalyticsRepository.findContentTypeMetricsForUser(any(), any(), any(), any()))
                .thenReturn(List.of(typeRow("IMAGE", 6, 750), typeRow("VIDEO", 2, 250)));
        ArgumentCaptor<String> platformCsv = ArgumentCaptor.forClass(String.class);

        List<AnalyticsContentTypeResponse> rows = service.byContentType(EMAIL,
                new AnalyticsService.AnalyticsQuery(LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-07"),
                        List.of(Platform.FACEBOOK), List.of("image"))).getResult();

        // Truy vấn chỉ có 4 tham số (không có typeCsv) — donut là tỷ trọng GIỮA các loại nên lọc
        // loại nội dung sẽ để lại đúng một lát 100%.
        verify(postAnalyticsRepository).findContentTypeMetricsForUser(any(), any(), any(), platformCsv.capture());
        assertEquals("FACEBOOK", platformCsv.getValue(), "vẫn áp lọc nền tảng — đó là chiều khác");
        assertEquals(75.0, rows.get(0).getSharePct(), "750 / 1000 tương tác");
        assertEquals(25.0, rows.get(1).getSharePct());
    }

    @Test
    void byPlatform_vanApLocLoaiNoiDung() {
        when(postAnalyticsRepository.findPlatformMetricsForUser(any(), any(), any(), any())).thenReturn(List.of());
        when(platformAccountRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of());
        ArgumentCaptor<String> typeCsv = ArgumentCaptor.forClass(String.class);

        service.byPlatform(EMAIL, new AnalyticsService.AnalyticsQuery(
                LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-07"), null, List.of("image", "Video")));

        verify(postAnalyticsRepository).findPlatformMetricsForUser(any(), any(), any(), typeCsv.capture());
        assertEquals("IMAGE,VIDEO", typeCsv.getValue(), "nhãn media_format chuẩn hoá IN HOA để khớp SQL");
    }

    // ---------- khối G — heatmap ----------

    private HeatmapCellProjection cell(int dow, int slot, long posts, long engagement) {
        return new HeatmapCellProjection() {
            public int getDow() { return dow; }
            public int getSlot() { return slot; }
            public long getPosts() { return posts; }
            public long getEngagement() { return engagement; }
        };
    }

    private void stubHeatmapMapper() {
        when(analyticsMapper.toHeatmapCellList(any())).thenAnswer(call -> {
            List<HeatmapCellProjection> rows = call.getArgument(0);
            return rows.stream()
                    .map(r -> AnalyticsHeatmapCellResponse.builder()
                            .dow(r.getDow()).slot(r.getSlot()).posts(r.getPosts()).engagement(r.getEngagement()).build())
                    .collect(Collectors.toCollection(ArrayList::new));
        });
    }

    @Test
    void heatmap_thangMauChiTinhODuMau_khongBiOViralMotBaiKeoGian() {
        stubHeatmapMapper();
        when(postAnalyticsRepository.findHeatmapForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(
                        cell(1, 2, 1, 9000),   // 1 bài viral: avg 9000 nhưng KHÔNG được vào thang màu
                        cell(2, 6, 4, 1200),   // đủ mẫu: avg 300
                        cell(3, 6, 5, 500)));  // đủ mẫu: avg 100

        AnalyticsHeatmapResponse heatmap =
                service.activityHeatmap(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertEquals(300.0, heatmap.getMax(), "max lấy từ ô đủ mẫu, không phải ô 1 bài avg 9000");
        assertEquals(100.0, heatmap.getMin());
        assertEquals(2, heatmap.getScaledCells());
        assertEquals(3, heatmap.getMinPostsForScale());
    }

    @Test
    void heatmap_oDuoiNguongMau_vanTraVeNhungDanhDauLowSample() {
        stubHeatmapMapper();
        when(postAnalyticsRepository.findHeatmapForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(cell(1, 2, 1, 9000), cell(2, 6, 4, 1200)));

        AnalyticsHeatmapResponse heatmap =
                service.activityHeatmap(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        AnalyticsHeatmapCellResponse low = heatmap.getCells().get(0);
        assertTrue(low.isLowSample(), "1 bài < ngưỡng 3 → đánh dấu chưa đủ dữ liệu");
        assertEquals(9000.0, low.getAvgEngagement(), "vẫn có giá trị để tooltip hiện, chỉ không vào thang màu");
        assertEquals(6, low.getHourStart(), "slot 2 = 06:00–08:59");
        assertFalse(heatmap.getCells().get(1).isLowSample());
    }

    @Test
    void heatmap_chuaODuMau_maxMinNull() {
        stubHeatmapMapper();
        when(postAnalyticsRepository.findHeatmapForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(cell(1, 2, 1, 300), cell(4, 5, 2, 800)));

        AnalyticsHeatmapResponse heatmap =
                service.activityHeatmap(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertNull(heatmap.getMax(), "chưa ô nào đủ mẫu → không vẽ thang màu");
        assertNull(heatmap.getMin());
        assertEquals(0, heatmap.getScaledCells());
        assertEquals(2, heatmap.getCells().size(), "ô vẫn trả về để hiện tooltip số bài");
    }

    // ---------- khối H — thông tin chi tiết ----------

    private PostEngagementProjection post(long engagement, Long views) {
        return new PostEngagementProjection() {
            public long getEngagement() { return engagement; }
            public Long getViews() { return views; }
        };
    }

    @Test
    void insights_goodPosts_demBaiTrenMucTrungBinhKy() {
        stubHeatmapMapper();
        when(postAnalyticsRepository.findHeatmapForUser(any(), any(), any(), any(), any())).thenReturn(List.of());
        // TB = (10 + 20 + 300 + 30) / 4 = 90 → chỉ bài 300 vượt.
        when(postAnalyticsRepository.findPostEngagementForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(post(10, null), post(20, null), post(300, null), post(30, null)), List.of());

        AnalyticsInsightsResponse insights = service.insights(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertEquals(4, insights.getTotalPosts());
        assertEquals(1, insights.getGoodPosts());
        assertEquals(90.0, insights.getAvgEngagementPerPost(), "ngưỡng là TB của chính kỳ này");
    }

    @Test
    void insights_tyLeTuongTac_loaiBaiKhongCoLuotXem() {
        stubHeatmapMapper();
        when(postAnalyticsRepository.findHeatmapForUser(any(), any(), any(), any(), any())).thenReturn(List.of());
        // 2 bài Facebook views null (không thu được) + 2 bài có lượt xem: 60/1000 = 6%.
        when(postAnalyticsRepository.findPostEngagementForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(post(500, null), post(400, null), post(40, 600L), post(20, 400L)), List.of());

        AnalyticsInsightsResponse insights = service.insights(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertEquals(6.0, insights.getEngagementRatePct(), "chỉ tính trên bài CÓ lượt xem");
        assertEquals(2, insights.getRatedPosts());
        assertEquals(2, insights.getExcludedPosts(), "FE phải chú thích số bài bị loại khỏi mẫu số");
    }

    @Test
    void insights_khongBaiNaoCoLuotXem_tyLeNull_khongPhaiKhong() {
        stubHeatmapMapper();
        when(postAnalyticsRepository.findHeatmapForUser(any(), any(), any(), any(), any())).thenReturn(List.of());
        when(postAnalyticsRepository.findPostEngagementForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(post(500, null), post(400, null)), List.of());

        AnalyticsInsightsResponse insights = service.insights(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertNull(insights.getEngagementRatePct(), "null = chưa tính được, khác hẳn 0%");
        assertEquals(0, insights.getRatedPosts());
    }

    @Test
    void insights_goldenHour_chonODuMauCaoNhat() {
        stubHeatmapMapper();
        when(postAnalyticsRepository.findPostEngagementForUser(any(), any(), any(), any(), any())).thenReturn(List.of());
        when(postAnalyticsRepository.findHeatmapForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(
                        cell(1, 2, 1, 9000),   // viral 1 bài — không đủ mẫu
                        cell(3, 6, 4, 1200),   // avg 300 — đủ mẫu, cao nhất
                        cell(5, 7, 3, 300)));  // avg 100

        AnalyticsInsightsResponse insights = service.insights(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertEquals(3, insights.getGoldenHour().getDow());
        assertEquals(18, insights.getGoldenHour().getHourStart(), "slot 6 = 18:00");
        assertEquals(21, insights.getGoldenHour().getHourEnd());
        assertEquals(300.0, insights.getGoldenHour().getAvgEngagement());
    }

    @Test
    void insights_goldenHourNull_khiChuaODuMau() {
        stubHeatmapMapper();
        when(postAnalyticsRepository.findPostEngagementForUser(any(), any(), any(), any(), any())).thenReturn(List.of());
        when(postAnalyticsRepository.findHeatmapForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(cell(1, 2, 1, 9000), cell(4, 5, 2, 800)));

        AnalyticsInsightsResponse insights = service.insights(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertNull(insights.getGoldenHour(), "thà báo 'chưa đủ dữ liệu' còn hơn bịa khung giờ từ 1–2 bài");
    }

    @Test
    void insights_baiLoi_demTheoKyVaKyTruoc() {
        stubHeatmapMapper();
        when(postAnalyticsRepository.findHeatmapForUser(any(), any(), any(), any(), any())).thenReturn(List.of());
        when(postAnalyticsRepository.findPostEngagementForUser(any(), any(), any(), any(), any())).thenReturn(List.of());
        when(postRepository.countFailedForUserInRange(any(), any(), any(), any(), any())).thenReturn(3L, 4L);

        AnalyticsInsightsResponse insights = service.insights(EMAIL, range("2026-06-01", "2026-06-07")).getResult();

        assertEquals(3, insights.getNeedsAttentionPosts());
        assertEquals(-25.0, insights.getNeedsAttentionDeltaPct(), "3 so với 4 của kỳ trước");
        assertEquals("2026-05-25", insights.getCompareFrom());
    }

    // ---------- export ----------

    @Test
    void export_vuotTran_baoLoiThayViCatCut() {
        when(postAnalyticsRepository.countPostsForUser(any(), any(), any(), any(), any()))
                .thenReturn((long) AnalyticsService.MAX_EXPORT_ROWS + 1);

        AppException error = assertThrows(AppException.class,
                () -> service.export(EMAIL, range("2026-06-01", "2026-06-07"), null));

        assertEquals(ErrorCode.ANALYTICS_EXPORT_TOO_LARGE, error.getErrorCode());
    }

    @Test
    void export_csvCoHeaderVaDongTheoSort() {
        when(postAnalyticsRepository.countPostsForUser(any(), any(), any(), any(), any())).thenReturn(2L);
        when(postAnalyticsRepository.findTopPostsForUser(any(), any(), any(), any(), any()))
                .thenReturn(List.of(topRow(10), topRow(30)));

        String csv = service.export(EMAIL, range("2026-06-01", "2026-06-07"), null).getResult();

        String[] lines = csv.split("\n");
        assertEquals("published_at,platform,account_name,caption,views,likes,comments,shares,engagement", lines[0]);
        assertEquals(3, lines.length, "header + 2 dòng");
        assertTrue(lines[1].contains(",30,"), "mặc định views giảm dần");
    }

    // ---------- dev seeder (cờ mặc định tắt) ----------

    @Test
    void devSeed_bicChanKhiCoTat() {
        AppException error = assertThrows(AppException.class, () -> service.devSeed(EMAIL));
        assertEquals(ErrorCode.ANALYTICS_SEED_DISABLED, error.getErrorCode(),
                "cờ mặc định false nên seeder phải từ chối");
    }

    @Test
    void devSeedClear_bicChanKhiCoTat() {
        AppException error = assertThrows(AppException.class, () -> service.devSeedClear(EMAIL));
        assertEquals(ErrorCode.ANALYTICS_SEED_DISABLED, error.getErrorCode());
    }
}
