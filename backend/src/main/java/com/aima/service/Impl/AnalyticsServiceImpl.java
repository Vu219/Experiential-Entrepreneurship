package com.aima.service.Impl;

import com.aima.dto.response.AnalyticsContentTypeResponse;
import com.aima.dto.response.AnalyticsGoldenHourResponse;
import com.aima.dto.response.AnalyticsHeatmapCellResponse;
import com.aima.dto.response.AnalyticsHeatmapResponse;
import com.aima.dto.response.AnalyticsInsightsResponse;
import com.aima.dto.response.AnalyticsPlatformResponse;
import com.aima.dto.response.AnalyticsPointResponse;
import com.aima.dto.response.AnalyticsStatResponse;
import com.aima.dto.response.AnalyticsSummaryResponse;
import com.aima.dto.response.AnalyticsTimeseriesResponse;
import com.aima.dto.response.AnalyticsTopPostResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.Post;
import com.aima.entity.PostAnalytics;
import com.aima.entity.PostSchedule;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentLifecycle;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PostStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
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
import com.aima.util.CsvUtil;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import java.util.function.ToLongFunction;
import java.util.stream.Collectors;

/**
 * UI-08 khối B (4 KPI + so kỳ trước) và khối C (chuỗi 4 metric theo ngày).
 *
 * <p>Mỗi lời gọi chỉ dùng truy vấn gộp (GROUP BY theo ngày) — {@code summary} chạy 2 truy vấn
 * (kỳ hiện tại + kỳ liền trước), {@code timeseries} chạy 1; không nạp entity rồi đếm trong bộ nhớ
 * (không N+1). Số liệu cộng dồn ở các mốc 24h/48h/168h nên truy vấn tự lấy mốc muộn nhất mỗi bài.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional(readOnly = true)
public class AnalyticsServiceImpl implements AnalyticsService {

    // Cột hợp lệ để sắp xếp bảng "Top bài viết" — chặn ORDER BY tuỳ ý từ client.
    static Set<String> TOP_SORT_FIELDS = Set.of("views", "likes", "comments", "shares", "engagement", "date");

    // Cache ngắn cho các số liệu GỘP: người dùng bật/tắt bộ lọc qua lại rất nhanh, mỗi lần đổi là 7
    // request. Dự án chưa có cache manager nên dùng map thủ công (cùng cách PlatformVersionServiceImpl).
    // TTL cố tình ngắn để số liệu mới thu về chậm nhất một phút là hiện.
    static Duration CACHE_TTL = Duration.ofSeconds(45);

    // Chặn map phình vô hạn (mỗi user × mỗi tổ hợp bộ lọc là một key): chạm trần thì xoá sạch,
    // đơn giản hơn LRU và chấp nhận được với cache TTL 45 giây.
    static int CACHE_MAX_ENTRIES = 500;

    // Header CSV export — snake_case như các endpoint export sẵn có (usage, log hoạt động).
    static String EXPORT_HEADER =
            "published_at,platform,account_name,caption,views,likes,comments,shares,engagement\n";

    // ===== Đánh dấu dữ liệu dev-seed để dọn sạch khi seed lại / clear =====
    static String DEV_BRAND_NAME = "[DEV-SEED] Phân tích demo";
    static String DEV_MARKER_PREFIX = "devseed-";
    static int DEV_SEED_POSTS = 30;
    static int DEV_SEED_SPREAD_DAYS = 60;
    static int[] DEV_MILESTONES = {24, 48, 168};

    PostAnalyticsRepository postAnalyticsRepository;
    PlatformAccountRepository platformAccountRepository;
    BrandProfileRepository brandProfileRepository;
    PostRepository postRepository;
    UserRepository userRepository;
    AnalyticsMapper analyticsMapper;
    Environment environment;

    // Có khởi tạo sẵn nên KHÔNG vào constructor của @RequiredArgsConstructor (Lombok bỏ qua final
    // đã gán giá trị) — đây là state cục bộ của service, không phải dependency.
    ConcurrentHashMap<String, CachedResult> resultCache = new ConcurrentHashMap<>();

    // Cờ dev-only cho dev-seed — mặc định TẮT, chỉ bật ở môi trường dev (.env).
    @NonFinal
    @Value("${aima.dev.analytics-seed-enabled:false}")
    boolean analyticsSeedEnabled;

    @NonFinal
    @Value("${aima.production-mode:false}")
    boolean productionMode;

    @Override
    public ApiResponse<AnalyticsSummaryResponse> summary(String email, AnalyticsQuery query) {
        UUID userId = currentUser(email).getId();
        ResolvedRange range = resolveRange(query);
        Filters filters = filters(query);

        AnalyticsSummaryResponse summary = cached(key("summary", userId, range, filters), () -> {
            List<AnalyticsPointResponse> current = fetchPoints(userId, range.from(), range.to(), filters);
            ComparePeriod previousPeriod = comparePeriod(range);
            List<AnalyticsPointResponse> previous =
                    fetchPoints(userId, previousPeriod.from(), previousPeriod.to(), filters);

            return AnalyticsSummaryResponse.builder()
                    .from(range.from().toString())
                    .to(range.to().toString())
                    .rangeDays(range.rangeDays())
                    .compareFrom(previousPeriod.from().toString())
                    .compareTo(previousPeriod.to().toString())
                    .views(buildStat(current, previous, AnalyticsPointResponse::getViews))
                    .likes(buildStat(current, previous, AnalyticsPointResponse::getLikes))
                    .comments(buildStat(current, previous, AnalyticsPointResponse::getComments))
                    .shares(buildStat(current, previous, AnalyticsPointResponse::getShares))
                    .build();
        });
        return ApiResponse.success("Lấy tổng quan phân tích thành công", summary);
    }

    @Override
    public ApiResponse<AnalyticsTimeseriesResponse> timeseries(String email, AnalyticsQuery query) {
        UUID userId = currentUser(email).getId();
        ResolvedRange range = resolveRange(query);
        Filters filters = filters(query);

        AnalyticsTimeseriesResponse response = cached(key("timeseries", userId, range, filters), () ->
                AnalyticsTimeseriesResponse.builder()
                        .from(range.from().toString())
                        .to(range.to().toString())
                        .rangeDays(range.rangeDays())
                        .points(fetchPoints(userId, range.from(), range.to(), filters))
                        .build());
        return ApiResponse.success("Lấy chuỗi số liệu phân tích thành công", response);
    }

    // ===== Gộp theo ngày + zero-fill =====

    // Nạp số liệu gộp theo ngày rồi ĐIỀN 0 cho ngày không có bài đăng — nếu không, chuỗi bị đứt
    // quãng và tổng/sparkline lệch theo số ngày thực có dữ liệu.
    private List<AnalyticsPointResponse> fetchPoints(UUID userId, LocalDate from, LocalDate to, Filters filters) {
        Map<String, DailyEngagementProjection> byDay = postAnalyticsRepository
                .findDailyEngagementForUser(userId, from.atStartOfDay(), to.plusDays(1).atStartOfDay(),
                        filters.platformCsv(), filters.typeCsv())
                .stream()
                .collect(Collectors.toMap(DailyEngagementProjection::getDay, row -> row, (first, second) -> first));

        int days = (int) (ChronoUnit.DAYS.between(from, to) + 1);
        List<AnalyticsPointResponse> points = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            LocalDate day = from.plusDays(i);
            DailyEngagementProjection row = byDay.get(day.toString());
            points.add(AnalyticsPointResponse.builder()
                    .date(day.toString())
                    .views(row == null ? 0 : row.getViews())
                    .likes(row == null ? 0 : row.getLikes())
                    .comments(row == null ? 0 : row.getComments())
                    .shares(row == null ? 0 : row.getShares())
                    .build());
        }
        return points;
    }

    private AnalyticsStatResponse buildStat(List<AnalyticsPointResponse> current,
                                            List<AnalyticsPointResponse> previous,
                                            ToLongFunction<AnalyticsPointResponse> metric) {
        List<Long> series = current.stream().map(metric::applyAsLong).toList();
        long total = series.stream().mapToLong(Long::longValue).sum();
        long previousTotal = previous.stream().mapToLong(metric).sum();
        return AnalyticsStatResponse.builder()
                .total(total)
                .deltaPct(deltaPct(total, previousTotal))
                .series(series)
                .build();
    }

    // null khi kỳ trước bằng 0 (không có mốc so sánh) — FE hiển thị "—" thay vì +∞%,
    // cùng quy ước với các thẻ của Bảng điều khiển / Doanh thu.
    private Double deltaPct(long current, long previous) {
        if (previous == 0) {
            return null;
        }
        double pct = ((double) (current - previous) / previous) * 100;
        return Math.round(pct * 10) / 10.0;
    }

    // ===== Khối D — hiệu suất theo nền tảng =====

    @Override
    public ApiResponse<List<AnalyticsPlatformResponse>> byPlatform(String email, AnalyticsQuery query) {
        UUID userId = currentUser(email).getId();
        ResolvedRange range = resolveRange(query);
        // NGOẠI LỆ 1/2 của trang: bỏ qua bộ lọc NỀN TẢNG (đó là chiều của chính donut này), vẫn áp
        // bộ lọc loại nội dung. Ngoại lệ còn lại là byContentType — xem docs/Analytics.md.
        Filters filters = filters(query);

        List<AnalyticsPlatformResponse> result = cached(key("by-platform", userId, range, filters), () -> {
            Map<Platform, PlatformMetricProjection> metrics = postAnalyticsRepository
                    .findPlatformMetricsForUser(userId, range.from().atStartOfDay(),
                            range.to().plusDays(1).atStartOfDay(), filters.typeCsv())
                    .stream()
                    .collect(Collectors.toMap(row -> Platform.valueOf(row.getPlatform()), row -> row,
                            (first, second) -> first, () -> new EnumMap<>(Platform.class)));
            long totalEngagement = metrics.values().stream().mapToLong(PlatformMetricProjection::getEngagement).sum();
            List<PlatformAccount> accounts =
                    platformAccountRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(userId);

            return Arrays.stream(Platform.values())
                    .map(platform -> buildPlatform(platform, metrics.get(platform),
                            representativeAccount(accounts, platform), totalEngagement))
                    .toList();
        });
        return ApiResponse.success("Lấy hiệu suất theo nền tảng thành công", result);
    }

    // ===== Khối F — hiệu suất theo loại nội dung =====

    @Override
    public ApiResponse<List<AnalyticsContentTypeResponse>> byContentType(String email, AnalyticsQuery query) {
        UUID userId = currentUser(email).getId();
        ResolvedRange range = resolveRange(query);
        // NGOẠI LỆ 2/2: bỏ qua bộ lọc LOẠI NỘI DUNG (chiều của chính donut này), vẫn áp lọc nền tảng.
        Filters filters = filters(query);

        List<AnalyticsContentTypeResponse> result = cached(key("by-content-type", userId, range, filters), () -> {
            List<ContentTypeMetricProjection> rows = postAnalyticsRepository.findContentTypeMetricsForUser(
                    userId, range.from().atStartOfDay(), range.to().plusDays(1).atStartOfDay(),
                    filters.platformCsv());
            long totalEngagement = rows.stream().mapToLong(ContentTypeMetricProjection::getEngagement).sum();

            List<AnalyticsContentTypeResponse> mapped = analyticsMapper.toContentTypeResponseList(rows);
            mapped.forEach(row -> row.setSharePct(sharePct(row.getEngagement(), totalEngagement)));
            return mapped;
        });
        return ApiResponse.success("Lấy hiệu suất theo loại nội dung thành công", result);
    }

    // ===== Khối G — heatmap thời điểm hoạt động =====

    @Override
    public ApiResponse<AnalyticsHeatmapResponse> activityHeatmap(String email, AnalyticsQuery query) {
        UUID userId = currentUser(email).getId();
        ResolvedRange range = resolveRange(query);
        Filters filters = filters(query);

        AnalyticsHeatmapResponse response = cached(key("heatmap", userId, range, filters),
                () -> buildHeatmap(userId, range, filters));
        return ApiResponse.success("Lấy heatmap thời điểm hoạt động thành công", response);
    }

    /**
     * Gộp ô heatmap + tính thang màu. Chỉ ô có ít nhất {@link #MIN_HEATMAP_POSTS} bài mới được tính
     * vào max/min: một ô 1 bài tình cờ viral mà lọt vào thang màu sẽ đẩy mọi ô còn lại về gần 0 và
     * heatmap trở nên vô dụng. Dùng chung cho cả endpoint heatmap lẫn "khung giờ vàng" của insights
     * để hai khối không bao giờ nói khác nhau.
     */
    private AnalyticsHeatmapResponse buildHeatmap(UUID userId, ResolvedRange range, Filters filters) {
        List<HeatmapCellProjection> rows = postAnalyticsRepository.findHeatmapForUser(
                userId, range.from().atStartOfDay(), range.to().plusDays(1).atStartOfDay(),
                filters.platformCsv(), filters.typeCsv());

        List<AnalyticsHeatmapCellResponse> cells = analyticsMapper.toHeatmapCellList(rows);
        cells.forEach(cell -> {
            cell.setHourStart(cell.getSlot() * HEATMAP_SLOT_HOURS);
            cell.setAvgEngagement(round1(cell.getPosts() == 0 ? 0 : (double) cell.getEngagement() / cell.getPosts()));
            cell.setLowSample(cell.getPosts() < MIN_HEATMAP_POSTS);
        });
        cells = cells.stream()
                .sorted(Comparator.comparingInt(AnalyticsHeatmapCellResponse::getDow)
                        .thenComparingInt(AnalyticsHeatmapCellResponse::getSlot))
                .toList();

        List<AnalyticsHeatmapCellResponse> scaled = cells.stream().filter(c -> !c.isLowSample()).toList();
        Double max = scaled.stream().mapToDouble(AnalyticsHeatmapCellResponse::getAvgEngagement).max().orElse(-1);
        Double min = scaled.stream().mapToDouble(AnalyticsHeatmapCellResponse::getAvgEngagement).min().orElse(-1);

        return AnalyticsHeatmapResponse.builder()
                .from(range.from().toString())
                .to(range.to().toString())
                .cells(cells)
                // Chưa ô nào đủ mẫu → null (không phải 0): FE hiện "chưa đủ dữ liệu" thay vì vẽ thang màu giả.
                .max(scaled.isEmpty() ? null : max)
                .min(scaled.isEmpty() ? null : min)
                .minPostsForScale(MIN_HEATMAP_POSTS)
                .scaledCells(scaled.size())
                .build();
    }

    // ===== Khối H — dải "Thông tin chi tiết" =====

    @Override
    public ApiResponse<AnalyticsInsightsResponse> insights(String email, AnalyticsQuery query) {
        UUID userId = currentUser(email).getId();
        ResolvedRange range = resolveRange(query);
        Filters filters = filters(query);
        ComparePeriod previousPeriod = comparePeriod(range);

        AnalyticsInsightsResponse response = cached(key("insights", userId, range, filters), () -> {
            PeriodInsight current = periodInsight(userId, range.from(), range.to(), filters);
            PeriodInsight previous = periodInsight(userId, previousPeriod.from(), previousPeriod.to(), filters);

            return AnalyticsInsightsResponse.builder()
                    .from(range.from().toString())
                    .to(range.to().toString())
                    .compareFrom(previousPeriod.from().toString())
                    .compareTo(previousPeriod.to().toString())
                    .totalPosts(current.totalPosts())
                    .totalPostsDeltaPct(deltaPct(current.totalPosts(), previous.totalPosts()))
                    .goodPosts(current.goodPosts())
                    .goodPostsDeltaPct(deltaPct(current.goodPosts(), previous.goodPosts()))
                    .avgEngagementPerPost(current.avgEngagement())
                    .needsAttentionPosts(current.failedPosts())
                    .needsAttentionDeltaPct(deltaPct(current.failedPosts(), previous.failedPosts()))
                    .goldenHour(goldenHour(buildHeatmap(userId, range, filters)))
                    .engagementRatePct(current.engagementRatePct())
                    .engagementRateDeltaPct(rateDeltaPct(current.engagementRatePct(), previous.engagementRatePct()))
                    .ratedPosts(current.ratedPosts())
                    .excludedPosts(current.totalPosts() - current.ratedPosts())
                    .build();
        });
        return ApiResponse.success("Lấy thông tin chi tiết thành công", response);
    }

    /**
     * Số liệu tổng kết của MỘT kỳ (dùng cho cả kỳ hiện tại lẫn kỳ so sánh).
     *
     * <p>"Bài hoạt động tốt" = tương tác TRÊN mức trung bình của chính kỳ đó (ngưỡng động, không phải
     * ngưỡng cố định). "Bài lỗi & cần xử lý" đếm từ bảng bài THẤT BẠI theo thời điểm thất bại — hai
     * con số này thuộc hai tập khác nhau, không cộng lại thành tổng bài.
     */
    private PeriodInsight periodInsight(UUID userId, LocalDate from, LocalDate to, Filters filters) {
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay();
        List<PostEngagementProjection> posts = postAnalyticsRepository.findPostEngagementForUser(
                userId, start, end, filters.platformCsv(), filters.typeCsv());

        long totalPosts = posts.size();
        long totalEngagement = posts.stream().mapToLong(PostEngagementProjection::getEngagement).sum();
        double avgEngagement = totalPosts == 0 ? 0 : (double) totalEngagement / totalPosts;
        long goodPosts = posts.stream().filter(p -> p.getEngagement() > avgEngagement).count();

        // Tỷ lệ tương tác: CHỈ tính bài thực sự có lượt xem. Facebook thường trả views null (thiếu
        // quyền read_insights) — coi null là 0 sẽ thổi phồng tỷ lệ, còn cho vào mẫu số thì chia cho 0.
        List<PostEngagementProjection> rated = posts.stream()
                .filter(p -> p.getViews() != null && p.getViews() > 0)
                .toList();
        long ratedViews = rated.stream().mapToLong(PostEngagementProjection::getViews).sum();
        long ratedEngagement = rated.stream().mapToLong(PostEngagementProjection::getEngagement).sum();
        Double engagementRatePct = ratedViews == 0 ? null : round1(ratedEngagement * 100.0 / ratedViews);

        long failedPosts = postRepository.countFailedForUserInRange(
                userId, start, end, filters.platformCsv(), filters.typeCsv());

        return new PeriodInsight(totalPosts, goodPosts, round1(avgEngagement), failedPosts,
                rated.size(), engagementRatePct);
    }

    // Khung giờ vàng = ô có tương tác TB cao nhất trong các ô ĐỦ MẪU; hoà thì ưu tiên ô nhiều bài hơn.
    // Không ô nào đủ mẫu → null: thà nói "chưa đủ dữ liệu" còn hơn gợi ý một khung giờ dựng từ 1–2 bài.
    private AnalyticsGoldenHourResponse goldenHour(AnalyticsHeatmapResponse heatmap) {
        return heatmap.getCells().stream()
                .filter(cell -> !cell.isLowSample())
                .max(Comparator.comparingDouble(AnalyticsHeatmapCellResponse::getAvgEngagement)
                        .thenComparingLong(AnalyticsHeatmapCellResponse::getPosts))
                .map(cell -> AnalyticsGoldenHourResponse.builder()
                        .dow(cell.getDow())
                        .slot(cell.getSlot())
                        .hourStart(cell.getHourStart())
                        .hourEnd(cell.getHourStart() + HEATMAP_SLOT_HOURS)
                        .posts(cell.getPosts())
                        .avgEngagement(cell.getAvgEngagement())
                        .build())
                .orElse(null);
    }

    // ===== Export =====

    @Override
    public ApiResponse<String> export(String email, AnalyticsQuery query, String sort) {
        UUID userId = currentUser(email).getId();
        ResolvedRange range = resolveRange(query);
        Filters filters = filters(query);
        LocalDateTime start = range.from().atStartOfDay();
        LocalDateTime end = range.to().plusDays(1).atStartOfDay();

        long count = postAnalyticsRepository.countPostsForUser(userId, start, end,
                filters.platformCsv(), filters.typeCsv());
        if (count > MAX_EXPORT_ROWS) {
            // KHÔNG cắt cụt im lặng — người dùng thu hẹp khoảng ngày/bộ lọc rồi export lại.
            throw new AppException(ErrorCode.ANALYTICS_EXPORT_TOO_LARGE);
        }

        StringBuilder csv = new StringBuilder(EXPORT_HEADER);
        postAnalyticsRepository.findTopPostsForUser(userId, start, end, filters.platformCsv(), filters.typeCsv())
                .stream()
                .sorted(topComparator(sort))
                .forEach(row -> appendCsvRow(csv, row));
        return ApiResponse.success("Export số liệu phân tích thành công", csv.toString());
    }

    private void appendCsvRow(StringBuilder csv, TopPostProjection row) {
        csv.append(CsvUtil.nullToEmpty(row.getPublishedAt())).append(',')
                .append(CsvUtil.field(row.getPlatform())).append(',')
                .append(CsvUtil.field(row.getAccountName())).append(',')
                .append(CsvUtil.field(row.getCaption())).append(',')
                .append(row.getViews()).append(',')
                .append(row.getLikes()).append(',')
                .append(row.getComments()).append(',')
                .append(row.getShares()).append(',')
                .append(row.getEngagement()).append('\n');
    }

    private AnalyticsPlatformResponse buildPlatform(Platform platform, PlatformMetricProjection metric,
                                                    PlatformAccount account, long totalEngagement) {
        long engagement = metric == null ? 0 : metric.getEngagement();
        boolean connected = account != null && account.getConnectionStatus() == ConnectionStatus.ACTIVE;
        // 0 khi cả kỳ chưa có tương tác — tránh chia cho 0.
        double sharePct = totalEngagement == 0 ? 0 : Math.round(engagement * 1000.0 / totalEngagement) / 10.0;
        return AnalyticsPlatformResponse.builder()
                .platform(platform)
                .connected(connected)
                .accountName(account == null ? null : account.getAccountName())
                .avatarUrl(account == null ? null : account.getAvatarUrl())
                .status(account == null ? null : account.getConnectionStatus())
                .views(metric == null ? 0 : metric.getViews())
                .likes(metric == null ? 0 : metric.getLikes())
                .comments(metric == null ? 0 : metric.getComments())
                .shares(metric == null ? 0 : metric.getShares())
                .engagement(engagement)
                .sharePct(sharePct)
                .build();
    }

    // Một nền tảng có thể có nhiều bản ghi (Facebook: tài khoản gốc + từng Page). Ưu tiên bản ACTIVE,
    // trong đó ưu tiên kết nối gốc vì tên hiển thị dễ nhận ra hơn (cùng cách chọn với Bảng điều khiển).
    private Optional<PlatformAccount> pickAccount(List<PlatformAccount> accounts, Platform platform) {
        return accounts.stream()
                .filter(account -> account.getPlatformName() == platform)
                .min(Comparator
                        .comparing((PlatformAccount account) -> account.getConnectionStatus() != ConnectionStatus.ACTIVE)
                        .thenComparing(account -> account.getParentConnection() != null));
    }

    private PlatformAccount representativeAccount(List<PlatformAccount> accounts, Platform platform) {
        return pickAccount(accounts, platform).orElse(null);
    }

    // ===== Khối E — top bài viết =====

    @Override
    public ApiResponse<List<AnalyticsTopPostResponse>> topPosts(String email, AnalyticsQuery query,
                                                                String sort, int limit) {
        UUID userId = currentUser(email).getId();
        ResolvedRange range = resolveRange(query);
        Filters filters = filters(query);
        int cappedLimit = Math.min(Math.max(limit, 1), MAX_TOP_POSTS);

        List<TopPostProjection> top = postAnalyticsRepository
                .findTopPostsForUser(userId, range.from().atStartOfDay(), range.to().plusDays(1).atStartOfDay(),
                        filters.platformCsv(), filters.typeCsv())
                .stream()
                .sorted(topComparator(sort))
                .limit(cappedLimit)
                .toList();
        List<AnalyticsTopPostResponse> content = analyticsMapper.toTopPostResponseList(top);
        return ApiResponse.success("Lấy top bài viết thành công", content);
    }

    // Sắp xếp theo cột nằm trong whitelist; giá trị lạ rơi về mặc định views giảm dần (không ném lỗi).
    private Comparator<TopPostProjection> topComparator(String sort) {
        String field = "views";
        boolean descending = true;
        if (sort != null && !sort.isBlank()) {
            String[] parts = sort.split(",");
            String requested = parts[0].trim().toLowerCase();
            if (TOP_SORT_FIELDS.contains(requested)) {
                field = requested;
            }
            if (parts.length > 1) {
                descending = !parts[1].trim().equalsIgnoreCase("asc");
            }
        }
        Comparator<TopPostProjection> comparator = switch (field) {
            case "likes" -> Comparator.comparingLong(TopPostProjection::getLikes);
            case "comments" -> Comparator.comparingLong(TopPostProjection::getComments);
            case "shares" -> Comparator.comparingLong(TopPostProjection::getShares);
            case "engagement" -> Comparator.comparingLong(TopPostProjection::getEngagement);
            case "date" -> Comparator.comparing(TopPostProjection::getPublishedAt);
            default -> Comparator.comparingLong(TopPostProjection::getViews);
        };
        return descending ? comparator.reversed() : comparator;
    }

    // ===== Dev seeder (dev-only, gỡ/tắt khi có dữ liệu thật) =====

    @Override
    @Transactional
    public ApiResponse<Integer> devSeed(String email) {
        guardDevTool();
        User user = currentUser(email);
        clearDevData(user);

        // 3 kết nối MẪU ACTIVE (FB/IG/Threads) để trang hiện "đã kết nối" + làm đích cho lịch đăng.
        Map<Platform, PlatformAccount> accounts = new EnumMap<>(Platform.class);
        for (Platform platform : Platform.values()) {
            accounts.put(platform, platformAccountRepository.save(devAccount(user, platform)));
        }

        // Hồ sơ MẪU + toàn bộ bài/version/lịch/analytics gắn vào rồi lưu MỘT lần (cascade toàn subtree).
        BrandProfile brand = devBrand(user);
        Random random = new Random(20260721L);
        LocalDateTime now = LocalDateTime.now();
        int snapshots = 0;
        for (int i = 0; i < DEV_SEED_POSTS; i++) {
            Platform platform = Platform.values()[i % Platform.values().length];
            LocalDateTime publishedAt = now.minusDays(1L + random.nextInt(DEV_SEED_SPREAD_DAYS))
                    .minusHours(random.nextInt(24));
            ContentItem item = devContentItem(brand, platform, i, publishedAt, accounts.get(platform), random, now);
            brand.getContentItems().add(item);
            snapshots += item.getContentVersions().get(0).getPostSchedule().getPost().getPostAnalytics().size();
        }
        brandProfileRepository.save(brand);
        // Không dọn cache thì trang Phân tích còn hiện số cũ tới 45 giây sau khi seed — dev tưởng seeder hỏng.
        resultCache.clear();

        log.warn("[AnalyticsSeed] Đã tạo {} bài MẪU + {} snapshot cho {} — KHÔNG phải dữ liệu thật",
                DEV_SEED_POSTS, snapshots, email);
        return ApiResponse.success("Đã tạo dữ liệu phân tích mẫu", DEV_SEED_POSTS);
    }

    @Override
    @Transactional
    public ApiResponse<Integer> devSeedClear(String email) {
        guardDevTool();
        int removed = clearDevData(currentUser(email));
        resultCache.clear();
        log.warn("[AnalyticsSeed] Đã xoá {} bài MẪU của {}", removed, email);
        return ApiResponse.success("Đã xoá dữ liệu phân tích mẫu", removed);
    }

    // Xoá hồ sơ MẪU (cascade content item → version → lịch → post → analytics) rồi mới xoá kết nối
    // MẪU — flush giữa hai bước để lịch (FK tới platform_account) biến mất trước. Trả số bài đã xoá.
    private int clearDevData(User user) {
        List<BrandProfile> devBrands = brandProfileRepository.findByUser_IdAndBrandName(user.getId(), DEV_BRAND_NAME);
        int removed = devBrands.stream().mapToInt(brand -> brand.getContentItems().size()).sum();
        if (!devBrands.isEmpty()) {
            brandProfileRepository.deleteAll(devBrands);
            brandProfileRepository.flush();
        }
        List<PlatformAccount> devAccounts = platformAccountRepository
                .findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(user.getId()).stream()
                .filter(account -> account.getPlatformAccountId() != null
                        && account.getPlatformAccountId().startsWith(DEV_MARKER_PREFIX))
                .toList();
        if (!devAccounts.isEmpty()) {
            platformAccountRepository.deleteAll(devAccounts);
            platformAccountRepository.flush();
        }
        return removed;
    }

    private BrandProfile devBrand(User user) {
        BrandProfile brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName(DEV_BRAND_NAME);
        brand.setIndustry("Demo");
        brand.setTargetAudience("Khách hàng demo");
        // KHÔNG đặt active để không ảnh hưởng hồ sơ đang dùng thật (tối đa 1 active/user).
        brand.setIsActive(false);
        return brand;
    }

    private PlatformAccount devAccount(User user, Platform platform) {
        PlatformAccount account = new PlatformAccount();
        account.setUser(user);
        account.setPlatformName(platform);
        account.setAccountName("[DEV-SEED] " + platform.name());
        account.setPlatformAccountId(DEV_MARKER_PREFIX + platform.name().toLowerCase());
        account.setAccountType(devAccountType(platform));
        account.setTokenType(platform == Platform.FACEBOOK ? TokenType.PAGE_TOKEN : TokenType.LONG_LIVED_USER_TOKEN);
        // Token giả — vẫn được mã hoá AES-256-GCM khi ghi (SEC-03); không dùng để gọi Meta.
        account.setAccessToken(DEV_MARKER_PREFIX + "token-" + platform.name().toLowerCase());
        account.setConnectionStatus(ConnectionStatus.ACTIVE);
        account.setApiVersionUsed("v25.0");
        return account;
    }

    private PlatformAccountType devAccountType(Platform platform) {
        return switch (platform) {
            case FACEBOOK -> PlatformAccountType.PAGE;
            case INSTAGRAM -> PlatformAccountType.BUSINESS_ACCOUNT;
            case THREADS -> PlatformAccountType.PERSONAL;
        };
    }

    // Dựng trọn nhánh của MỘT bài: content item → version (FORMATTED) → lịch (POSTED) → post (POSTED)
    // → snapshot cho các mốc đã qua. Số liệu tăng dần theo mốc (24h < 48h < 7d) như thu thật.
    private ContentItem devContentItem(BrandProfile brand, Platform platform, int index,
                                       LocalDateTime publishedAt, PlatformAccount account,
                                       Random random, LocalDateTime now) {
        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.setCaption("Bài phân tích mẫu #" + (index + 1));
        item.setStatus(ContentLifecycle.POSTED);

        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(platform);
        version.setFormattedCaption("Bài mẫu #" + (index + 1) + " trên " + platform.name());
        version.setMediaFormat(index % 2 == 0 ? "image" : "video");
        version.setStatus(ContentLifecycle.POSTED);
        item.getContentVersions().add(version);

        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setPlatformAccount(account);
        schedule.setScheduledTime(publishedAt.minusMinutes(5));
        schedule.setStatus(ScheduleStatus.POSTED);
        version.setPostSchedule(schedule);

        Post post = new Post();
        post.setSchedule(schedule);
        post.setPlatformName(platform);
        post.setPlatformPostId(DEV_MARKER_PREFIX + "post-" + index);
        post.setPublishedAt(publishedAt);
        post.setStatus(PostStatus.POSTED);
        schedule.setPost(post);

        long views = 200 + random.nextInt(4800);
        long likes = Math.round(views * (0.03 + random.nextDouble() * 0.05));
        long comments = Math.round(likes * (0.05 + random.nextDouble() * 0.15));
        long shares = Math.round(likes * (0.02 + random.nextDouble() * 0.08));
        long hoursSince = ChronoUnit.HOURS.between(publishedAt, now);
        for (int milestone : DEV_MILESTONES) {
            if (hoursSince < milestone) {
                break;
            }
            double growth = milestone == 24 ? 0.5 : (milestone == 48 ? 0.75 : 1.0);
            PostAnalytics snapshot = new PostAnalytics();
            snapshot.setPost(post);
            snapshot.setViews(Math.round(views * growth));
            snapshot.setLikes(Math.round(likes * growth));
            snapshot.setComments(Math.round(comments * growth));
            snapshot.setShares(Math.round(shares * growth));
            snapshot.setMilestoneHours(milestone);
            snapshot.setCollectedAt(publishedAt.plusHours(milestone));
            post.getPostAnalytics().add(snapshot);
        }
        return item;
    }

    // Ba lớp khoá giống dev-seed doanh thu: cờ .env + AIMA_PRODUCTION_MODE + profile prod (belt).
    private void guardDevTool() {
        if (!analyticsSeedEnabled || productionMode || isProductionProfile()) {
            throw new AppException(ErrorCode.ANALYTICS_SEED_DISABLED);
        }
    }

    private boolean isProductionProfile() {
        for (String profile : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                return true;
            }
        }
        return false;
    }

    // ===== Phân giải & validate bộ lọc =====

    private ResolvedRange resolveRange(AnalyticsQuery query) {
        LocalDate to = query.to() == null ? LocalDate.now() : query.to();
        LocalDate from = query.from() == null ? to.minusDays(DEFAULT_RANGE_DAYS - 1L) : query.from();
        if (from.isAfter(to)) {
            throw new AppException(ErrorCode.ANALYTICS_RANGE_INVALID);
        }
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new AppException(ErrorCode.ANALYTICS_RANGE_TOO_LARGE);
        }
        return new ResolvedRange(from, to, (int) days);
    }

    // null/rỗng = mọi nền tảng (truy vấn bỏ điều kiện lọc); ngược lại nối tên enum bằng dấu phẩy.
    private String platformCsv(List<Platform> platforms) {
        if (platforms == null || platforms.isEmpty()) {
            return null;
        }
        return platforms.stream().distinct().map(Platform::name).collect(Collectors.joining(","));
    }

    // Loại nội dung là nhãn media_format tự do do AI ghi ("image"/"video"), KHÔNG phải enum — chuẩn
    // hoá IN HOA + bỏ khoảng trắng để khớp với biểu thức chuẩn hoá trong SQL. Nhãn lạ vẫn lọc được
    // (không loại bỏ), đúng tinh thần donut "Loại nội dung" của Bảng điều khiển.
    private String contentTypeCsv(List<String> contentTypes) {
        if (contentTypes == null || contentTypes.isEmpty()) {
            return null;
        }
        String csv = contentTypes.stream()
                .filter(type -> type != null && !type.isBlank())
                .map(type -> type.trim().toUpperCase())
                .distinct()
                .collect(Collectors.joining(","));
        return csv.isEmpty() ? null : csv;
    }

    private Filters filters(AnalyticsQuery query) {
        return new Filters(platformCsv(query.platforms()), contentTypeCsv(query.contentTypes()));
    }

    // Kỳ so sánh: cùng độ dài, nằm ngay trước kỳ hiện tại (compare=previous_period — chế độ duy nhất).
    private ComparePeriod comparePeriod(ResolvedRange range) {
        LocalDate previousTo = range.from().minusDays(1);
        return new ComparePeriod(previousTo.minusDays(range.rangeDays() - 1L), previousTo);
    }

    private double sharePct(long part, long total) {
        return total == 0 ? 0 : round1(part * 100.0 / total);
    }

    private double round1(double value) {
        return Math.round(value * 10) / 10.0;
    }

    // % thay đổi của một tỷ lệ (đã là %) — tách khỏi deltaPct(long, long) cho khỏi nhầm kiểu.
    private Double rateDeltaPct(Double current, Double previous) {
        if (current == null || previous == null || previous == 0) {
            return null;
        }
        return round1((current - previous) / previous * 100);
    }

    // ===== Cache ngắn cho số liệu gộp =====

    @SuppressWarnings("unchecked")
    private <T> T cached(String key, Supplier<T> loader) {
        CachedResult hit = resultCache.get(key);
        if (hit != null && hit.isFresh()) {
            return (T) hit.value();
        }
        T value = loader.get();
        if (resultCache.size() >= CACHE_MAX_ENTRIES) {
            resultCache.clear();
        }
        resultCache.put(key, new CachedResult(value, LocalDateTime.now()));
        return value;
    }

    // Khoá gồm ĐỦ mọi thứ đổi kết quả: user + khối + kỳ + bộ lọc — thiếu một mảnh là trả nhầm số
    // liệu của bộ lọc khác.
    private String key(String block, UUID userId, ResolvedRange range, Filters filters) {
        return String.join("|", block, userId.toString(), range.from().toString(), range.to().toString(),
                String.valueOf(filters.platformCsv()), String.valueOf(filters.typeCsv()));
    }

    private record CachedResult(Object value, LocalDateTime cachedAt) {
        boolean isFresh() {
            return Duration.between(cachedAt, LocalDateTime.now()).compareTo(CACHE_TTL) < 0;
        }
    }

    /** Bộ lọc đã chuẩn hoá thành CSV cho truy vấn native; null = không lọc chiều đó. */
    private record Filters(String platformCsv, String typeCsv) {
    }

    /** Kỳ so sánh (cùng độ dài, liền trước kỳ hiện tại). */
    private record ComparePeriod(LocalDate from, LocalDate to) {
    }

    /** Số liệu tổng kết của một kỳ dùng cho dải "Thông tin chi tiết". */
    private record PeriodInsight(long totalPosts, long goodPosts, double avgEngagement, long failedPosts,
                                 long ratedPosts, Double engagementRatePct) {
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }

    /** Khoảng đã phân giải: from/to là ngày (đã bao gồm cả hai đầu), rangeDays = số ngày. */
    private record ResolvedRange(LocalDate from, LocalDate to, int rangeDays) {
    }
}
