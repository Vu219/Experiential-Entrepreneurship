package com.aima.service.Impl;

import com.aima.dto.response.AdminOverviewSummaryResponse;
import com.aima.dto.response.AdminOverviewSummaryResponse.AdminOverviewStatResponse;
import com.aima.dto.response.AdminOverviewSummaryResponse.AdminOverviewStatsResponse;
import com.aima.dto.response.AdminOverviewSummaryResponse.PlanDistributionResponse;
import com.aima.dto.response.AdminOverviewSummaryResponse.RecentUserResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.entity.User;
import com.aima.enums.SubscriptionStatus;
import com.aima.mapper.AdminOverviewMapper;
import com.aima.repository.ActivityLogRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.repository.projection.DailyCountProjection;
import com.aima.repository.projection.PlanSubscriptionProjection;
import com.aima.repository.projection.UserCountProjection;
import com.aima.service.AdminOverviewService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminOverviewServiceImpl implements AdminOverviewService {

    UserRepository userRepository;
    ContentItemRepository contentItemRepository;
    ActivityLogRepository activityLogRepository;
    SubscriptionRepository subscriptionRepository;
    AdminOverviewMapper adminOverviewMapper;

    /**
     * Múi giờ neo MỌI phép tính theo ngày (hôm nay, GROUP BY ngày, zero-fill). Đọc từ chính
     * biến ghi dữ liệu — cột timestamp lưu giờ địa phương theo {@code APP_TIMEZONE} nên dùng
     * cùng nguồn thì ranh giới ngày luôn khớp dữ liệu. Mặc định Asia/Ho_Chi_Minh (KHÔNG phải
     * UTC): sản phẩm chạy cho thị trường VN, lấy UTC làm mặc định sẽ cắt ngày sai 7 tiếng.
     */
    @NonFinal
    @Value("${APP_TIMEZONE:Asia/Ho_Chi_Minh}")
    String appTimezone;

    /** Số điểm sparkline của mỗi thẻ KPI. */
    static final int SERIES_DAYS = 7;

    static final String COMPARISON_PREV_WEEK = "PREV_WEEK";
    static final String COMPARISON_PREV_DAY = "PREV_DAY";
    /** Không dựng lại được lịch sử để so — FE hiển thị "—" và ẩn sparkline. */
    static final String COMPARISON_NONE = "NONE";

    /**
     * Cache thủ công 30s (dự án chưa có cache manager — cùng mẫu {@code PlatformVersionServiceImpl}).
     * Trang tự làm mới định kỳ và nhiều admin có thể mở cùng lúc, nên chặn việc lặp lại nguyên bộ
     * truy vấn gộp mỗi vài giây.
     *
     * <p>⚠️ Cache nằm TRONG tiến trình: chạy nhiều instance thì mỗi instance giữ bản sao riêng và
     * hết hạn lệch nhau, nên hai lần tải trang liên tiếp có thể lệch tối đa 30 giây. Chấp nhận
     * được với số liệu tổng quan; chỉ số cần chính xác tuyệt đối thì đừng đọc qua đây.
     */
    static final Duration CACHE_TTL = Duration.ofSeconds(30);

    @NonFinal
    volatile CachedSummary cache;

    private record CachedSummary(int recentUsersLimit, AdminOverviewSummaryResponse value, LocalDateTime cachedAt) {
        boolean isFresh(int limit) {
            return recentUsersLimit == limit
                    && Duration.between(cachedAt, LocalDateTime.now()).compareTo(CACHE_TTL) < 0;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<AdminOverviewSummaryResponse> getSummary(int recentUsersLimit) {
        int limit = Math.min(Math.max(recentUsersLimit, 1), MAX_RECENT_USERS);

        CachedSummary cached = cache;
        if (cached != null && cached.isFresh(limit)) {
            return ApiResponse.success("Lấy dữ liệu tổng quan thành công", cached.value());
        }

        LocalDate today = LocalDate.now(zone());
        // Đầu chuỗi 7 ngày: today là điểm cuối, nên lùi 6 ngày. Cũng chính là mốc "tuần trước"
        // dùng làm kỳ so sánh của các thẻ tích lũy.
        LocalDateTime seriesStart = today.minusDays(SERIES_DAYS - 1L).atStartOfDay();

        List<PlanSubscriptionProjection> planRows = subscriptionRepository.aggregateByPlan(SubscriptionStatus.ACTIVE);

        AdminOverviewSummaryResponse summary = AdminOverviewSummaryResponse.builder()
                .stats(AdminOverviewStatsResponse.builder()
                        .totalUsers(buildTotalUsers(seriesStart, today))
                        .activeToday(buildActiveToday(seriesStart, today))
                        .contentCreated(buildContentCreated(seriesStart, today))
                        .monthlyRecurringRevenue(buildMonthlyRecurringRevenue(planRows))
                        .build())
                .planDistribution(buildPlanDistribution(planRows))
                .totalSubscribedUsers(planRows.stream().mapToLong(PlanSubscriptionProjection::getUserCount).sum())
                .recentUsers(buildRecentUsers(limit))
                .build();

        cache = new CachedSummary(limit, summary, LocalDateTime.now());
        return ApiResponse.success("Lấy dữ liệu tổng quan thành công", summary);
    }

    private ZoneId zone() {
        try {
            return ZoneId.of(appTimezone);
        } catch (Exception e) {
            log.error("[AdminOverview] APP_TIMEZONE không hợp lệ ({}) — tạm dùng Asia/Ho_Chi_Minh", appTimezone);
            return ZoneId.of("Asia/Ho_Chi_Minh");
        }
    }

    // ===== Thẻ KPI =====

    /**
     * Tổng người dùng — chỉ số TÍCH LŨY: sparkline là tổng tại cuối mỗi ngày (không phải số user
     * mới trong ngày), để đường biểu đồ nói cùng một thứ với con số lớn trên thẻ.
     */
    private AdminOverviewStatResponse buildTotalUsers(LocalDateTime seriesStart, LocalDate today) {
        long total = userRepository.countByDeletedAtIsNull();
        // Kỳ trước = tổng tích lũy tại đầu cửa sổ, truy vấn RIÊNG chứ không lấy từ hai đầu chuỗi.
        long previous = userRepository.countByCreatedAtLessThanAndDeletedAtIsNull(seriesStart);
        Map<LocalDate, Long> daily = toDailyMap(userRepository.countDailyNewUsers(seriesStart));

        return AdminOverviewStatResponse.builder()
                .total(total)
                .deltaPct(deltaPct(total, previous))
                .series(cumulativeSeries(previous, daily, today))
                .comparison(COMPARISON_PREV_WEEK)
                .build();
    }

    /**
     * Tổng nội dung đã tạo toàn hệ thống — cùng dạng tích lũy với thẻ người dùng.
     */
    private AdminOverviewStatResponse buildContentCreated(LocalDateTime seriesStart, LocalDate today) {
        long previous = contentItemRepository.countAllCreatedBefore(seriesStart);
        Map<LocalDate, Long> daily = toDailyMap(contentItemRepository.countDailyCreated(seriesStart));
        List<Long> series = cumulativeSeries(previous, daily, today);

        return AdminOverviewStatResponse.builder()
                // Tổng = tích lũy tại cuối ngày hôm nay, chính là điểm cuối chuỗi.
                .total(series.get(series.size() - 1))
                .deltaPct(deltaPct(series.get(series.size() - 1), previous))
                .series(series)
                .comparison(COMPARISON_PREV_WEEK)
                .build();
    }

    /**
     * Hoạt động hôm nay — số user KHÁC NHAU có bản ghi trong {@code activity_logs} theo NGÀY, nên
     * mỗi điểm của chuỗi là giá trị độc lập của đúng ngày đó (không tích lũy). Kỳ so sánh là
     * HÔM QUA: cả hai đều là số đếm distinct do DB tính riêng cho từng ngày.
     */
    private AdminOverviewStatResponse buildActiveToday(LocalDateTime seriesStart, LocalDate today) {
        Map<LocalDate, Long> daily = toDailyMap(activityLogRepository.countDailyActiveUsers(seriesStart));

        List<Long> series = new ArrayList<>(SERIES_DAYS);
        LocalDate start = today.minusDays(SERIES_DAYS - 1L);
        for (int i = 0; i < SERIES_DAYS; i++) {
            // Zero-fill: ngày không ai hoạt động vẫn phải có điểm, nếu không đường sẽ đứt quãng.
            series.add(daily.getOrDefault(start.plusDays(i), 0L));
        }

        long total = daily.getOrDefault(today, 0L);
        long previous = daily.getOrDefault(today.minusDays(1), 0L);

        return AdminOverviewStatResponse.builder()
                .total(total)
                .deltaPct(deltaPct(total, previous))
                .series(series)
                .comparison(COMPARISON_PREV_DAY)
                .build();
    }

    /**
     * Doanh thu định kỳ tháng (MRR).
     *
     * <pre>
     *   monthlyRecurringRevenue = Σ (plan.price / plan.billingIntervalMonths) × số user gói đó
     * </pre>
     * trên các subscription ACTIVE. Chia cho {@code billingIntervalMonths} để gói năm (12) và gói
     * quý (3) không bị cộng nguyên cục vào một tháng. Cộng dồn ở kiểu {@code double} và CHỈ làm
     * tròn ở bước cuối — làm tròn từng dòng sẽ tích lũy sai số theo số gói.
     *
     * <p>deltaPct/sparkline = null: MRR quá khứ KHÔNG dựng lại được. Bảng {@code subscriptions}
     * cập nhật tại chỗ khi user đổi gói (không có bảng lịch sử), nên không có cách nào biết MRR
     * của 7 ngày trước mà không bịa số. Cần biểu đồ MRR theo thời gian thì phải chốt snapshot
     * hằng ngày — việc riêng, xem docs/PLAN.md.
     */
    private AdminOverviewStatResponse buildMonthlyRecurringRevenue(List<PlanSubscriptionProjection> planRows) {
        double monthly = 0d;
        for (PlanSubscriptionProjection row : planRows) {
            short interval = row.getBillingIntervalMonths();
            if (interval <= 0) {
                // CHECK ở DB đã chặn, nhưng chia cho 0 thì hỏng cả trang — bỏ qua và báo để sửa dữ liệu.
                log.error("[AdminOverview] Gói {} có billing_interval_months = {} (phải ≥ 1) — bỏ qua khi tính MRR",
                        row.getCode(), interval);
                continue;
            }
            monthly += (double) row.getPrice() / interval * row.getUserCount();
        }

        return AdminOverviewStatResponse.builder()
                .total(Math.round(monthly))
                .deltaPct(null)
                .series(Collections.emptyList())
                .comparison(COMPARISON_NONE)
                .build();
    }

    // ===== Phân bổ gói =====

    private List<PlanDistributionResponse> buildPlanDistribution(List<PlanSubscriptionProjection> planRows) {
        long totalUsers = planRows.stream().mapToLong(PlanSubscriptionProjection::getUserCount).sum();
        return planRows.stream()
                .map(row -> adminOverviewMapper.toPlanDistribution(row, sharePct(row.getUserCount(), totalUsers)))
                .toList();
    }

    private double sharePct(long count, long total) {
        if (total == 0) {
            return 0d;
        }
        return Math.round((double) count / total * 1000) / 10.0;
    }

    // ===== Người dùng gần đây =====

    private List<RecentUserResponse> buildRecentUsers(int limit) {
        List<User> users = userRepository.findByDeletedAtIsNullOrderByCreatedAtDesc(PageRequest.of(0, limit));
        if (users.isEmpty()) {
            return List.of();
        }

        // Một GROUP BY cho đúng những user đang hiển thị — không đếm từng dòng (N+1).
        List<UUID> ids = users.stream().map(User::getId).toList();
        Map<UUID, Long> postCounts = contentItemRepository.countByUserIds(ids).stream()
                .collect(Collectors.toMap(UserCountProjection::getUserId, UserCountProjection::getTotal));

        return users.stream()
                .map(user -> adminOverviewMapper.toRecentUser(user, postCounts.getOrDefault(user.getId(), 0L)))
                .toList();
    }

    // ===== Helper dùng chung =====

    private Map<LocalDate, Long> toDailyMap(List<DailyCountProjection> rows) {
        return rows.stream().collect(Collectors.toMap(
                row -> LocalDate.parse(row.getDay()),
                DailyCountProjection::getTotal,
                Long::sum,
                HashMap::new));
    }

    /** Chuỗi TÍCH LŨY: bắt đầu từ tổng tại đầu cửa sổ rồi cộng dần số phát sinh mỗi ngày. */
    private List<Long> cumulativeSeries(long baseline, Map<LocalDate, Long> daily, LocalDate today) {
        List<Long> series = new ArrayList<>(SERIES_DAYS);
        LocalDate start = today.minusDays(SERIES_DAYS - 1L);
        long running = baseline;
        for (int i = 0; i < SERIES_DAYS; i++) {
            running += daily.getOrDefault(start.plusDays(i), 0L);
            series.add(running);
        }
        return series;
    }

    /**
     * null khi kỳ trước bằng 0 (không có mẫu số để so) — FE hiển thị "—" thay vì vô cực, cùng
     * quy ước với thẻ số liệu của Bảng điều khiển và trang Doanh thu.
     */
    private Double deltaPct(long current, long previous) {
        if (previous == 0) {
            return null;
        }
        double pct = ((double) (current - previous) / previous) * 100;
        return Math.round(pct * 10) / 10.0;
    }
}
