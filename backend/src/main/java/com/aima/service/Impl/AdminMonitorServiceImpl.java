package com.aima.service.Impl;

import com.aima.dto.response.AdminFailedPostResponse;
import com.aima.dto.response.AdminFailedPostSummaryResponse;
import com.aima.dto.response.AdminSystemStatusResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.SystemLogResponse;
import com.aima.entity.Post;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishResult;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.FailedPostFilter;
import com.aima.enums.LogLevel;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.AdminMonitorMapper;
import com.aima.mapper.SystemLogMapper;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.SystemLogRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AdminMonitorService;
import com.aima.util.CsvUtil;
import com.aima.util.SqlTemporalUtil;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import com.aima.dto.response.SystemActivityResponse;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

/**
 * FR-81..FR-83: tổng quan hệ thống + danh sách bài thất bại cho admin. Health check các
 * dependency là best-effort — một dependency chết không làm hỏng cả response.
 */
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AdminMonitorServiceImpl implements AdminMonitorService {

    static final String STATUS_UP = "UP";
    static final String STATUS_DOWN = "DOWN";

    // Trần export + kích thước lô: giống export log hoạt động / doanh thu để hành vi nhất quán.
    static final int EXPORT_MAX_ROWS = 50_000;
    static final int EXPORT_CHUNK = 1_000;
    static final int MAX_PAGE_SIZE = 50;
    static final int MAX_RANGE_DAYS = 366;
    /** Ngày không có bài lỗi nào — 6 cột đếm của countFailedForAdminByDay đều 0. */
    static final long[] EMPTY_DAY = {0L, 0L, 0L, 0L, 0L, 0L};

    UserRepository userRepository;
    PlatformAccountRepository platformAccountRepository;
    PostRepository postRepository;
    PostScheduleRepository postScheduleRepository;
    SystemLogRepository systemLogRepository;
    AdminMonitorMapper adminMonitorMapper;
    SystemLogMapper systemLogMapper;
    StringRedisTemplate stringRedisTemplate;
    WebClient aiServiceWebClient;
    JdbcTemplate jdbcTemplate;
    DataSource dataSource;

    public AdminMonitorServiceImpl(UserRepository userRepository,
                                   PlatformAccountRepository platformAccountRepository,
                                   PostRepository postRepository,
                                   PostScheduleRepository postScheduleRepository,
                                   SystemLogRepository systemLogRepository,
                                   AdminMonitorMapper adminMonitorMapper,
                                   SystemLogMapper systemLogMapper,
                                   StringRedisTemplate stringRedisTemplate,
                                   @Qualifier("aiServiceWebClient") WebClient aiServiceWebClient,
                                   JdbcTemplate jdbcTemplate,
                                   DataSource dataSource) {
        this.userRepository = userRepository;
        this.platformAccountRepository = platformAccountRepository;
        this.postRepository = postRepository;
        this.postScheduleRepository = postScheduleRepository;
        this.systemLogRepository = systemLogRepository;
        this.adminMonitorMapper = adminMonitorMapper;
        this.systemLogMapper = systemLogMapper;
        this.stringRedisTemplate = stringRedisTemplate;
        this.aiServiceWebClient = aiServiceWebClient;
        this.jdbcTemplate = jdbcTemplate;
        this.dataSource = dataSource;
    }

    // Không @Transactional bao ngoài: health check AI service là HTTP (rule #24);
    // từng count là query đơn tự commit.
    @Override
    public ApiResponse<AdminSystemStatusResponse> systemStatus() {
        List<AdminSystemStatusResponse.ServiceHealthResponse> services = new ArrayList<>();
        services.add(checkDatabase());
        services.add(checkRedis());
        services.add(checkAiService());

        LocalDateTime last24h = LocalDateTime.now().minusHours(24);
        long totalUsers = safeCount(() -> userRepository.count());
        long activeConnections = safeCount(() ->
                platformAccountRepository.countByConnectionStatusAndDeletedAtIsNull(ConnectionStatus.ACTIVE));
        long postedLast24h = safeCount(() ->
                postRepository.countByStatusAndPublishedAtAfterAndDeletedAtIsNull(PostStatus.POSTED, last24h));
        long failedLast24h = safeCount(() ->
                postRepository.countByStatusAndUpdatedAtAfterAndDeletedAtIsNull(PostStatus.FAILED, last24h));
        long pendingSchedules = safeCount(() ->
                postScheduleRepository.countByStatusAndDeletedAtIsNull(ScheduleStatus.SCHEDULED));

        List<SystemLogResponse> alerts = systemLogMapper.toResponseList(
                systemLogRepository.findTop5ByLevelAndDeletedAtIsNullOrderByCreatedAtDesc(LogLevel.ERROR));

        AdminSystemStatusResponse response = adminMonitorMapper.toStatusResponse(
                services, totalUsers, activeConnections, postedLast24h, failedLast24h, pendingSchedules,
                alerts, hostMetrics());
        return ApiResponse.success("Lấy trạng thái hệ thống thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<AdminFailedPostResponse>> listFailedPosts(FailedPostFilterQuery query,
                                                                              boolean ascending, int page, int size) {
        validateRange(query.from(), query.to());
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        Page<Post> posts = postRepository.searchFailedForAdmin(mode(query), name(query.platform()),
                name(query.errorType()), blankToNull(query.q()), startOf(query.from()), endOf(query.to()),
                ascending, pageable);

        List<AdminFailedPostResponse> content = posts.getContent().stream()
                .map(this::toFailedPost)
                .toList();
        PageResponse<AdminFailedPostResponse> response = PageResponse.from(posts, content);
        return ApiResponse.success("Lấy danh sách bài thất bại thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<AdminFailedPostSummaryResponse> failedPostSummary(FailedPostFilter kind,
                                                                         LocalDate from, LocalDate to) {
        validateRange(from, to);
        if (from == null || to == null) {
            throw new AppException(ErrorCode.FAILED_POST_RANGE_INVALID);
        }
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        LocalDate prevTo = from.minusDays(1);
        LocalDate prevFrom = prevTo.minusDays(days - 1);

        DailyTotals current = dailyTotals(from, to);
        DailyTotals previous = dailyTotals(prevFrom, prevTo);

        // Tab "Lỗi hệ thống" nhìn một tập con: tổng và số người bị ảnh hưởng đều phải thu hẹp
        // theo tập đó, nếu không thẻ "Tổng" sẽ to hơn tổng các thẻ con ngay bên cạnh.
        boolean technicalOnly = kind == FailedPostFilter.TECHNICAL;
        MetricSeries totalNow = technicalOnly ? current.technical() : current.total();
        MetricSeries totalPrev = technicalOnly ? previous.technical() : previous.total();
        long affectedNow = postRepository.countAffectedUsersForAdmin(startOf(from), endOf(to), technicalOnly);
        long affectedPrev = postRepository.countAffectedUsersForAdmin(startOf(prevFrom), endOf(prevTo), technicalOnly);
        List<Long> affectedSeries = technicalOnly ? current.affectedTechnical().series() : current.affectedAll().series();

        AdminFailedPostSummaryResponse response = adminMonitorMapper.toFailedPostSummary(
                kind,
                kpi(totalNow, totalPrev),
                kpi(current.policy(), previous.policy()),
                kpi(current.technical(), previous.technical()),
                kpi(current.temporary(), previous.temporary()),
                kpi(current.permanent(), previous.permanent()),
                kpi(new MetricSeries(affectedNow, affectedSeries),
                        new MetricSeries(affectedPrev, List.of())),
                prevFrom, prevTo);
        return ApiResponse.success("Lấy tổng quan bài lỗi thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<String> exportFailedPosts(FailedPostFilterQuery query) {
        validateRange(query.from(), query.to());
        String mode = mode(query);
        String platform = name(query.platform());
        String errorType = name(query.errorType());
        String q = blankToNull(query.q());
        LocalDateTime from = startOf(query.from());
        LocalDateTime to = endOf(query.to());

        long count = postRepository.countFailedForAdmin(mode, platform, errorType, q, from, to);
        if (count > EXPORT_MAX_ROWS) {
            // KHÔNG cắt cụt im lặng — admin thu hẹp filter rồi export lại (như export log/doanh thu).
            throw new AppException(ErrorCode.FAILED_POST_EXPORT_TOO_LARGE);
        }

        StringBuilder csv = new StringBuilder(
                "failed_at,platform,owner_email,account_name,error_type,error_code,error_message,"
                        + "retry_count,next_retry_at,caption\n");
        for (int chunk = 0; chunk * EXPORT_CHUNK < count; chunk++) {
            postRepository.searchFailedForAdmin(mode, platform, errorType, q, from, to, false,
                            PageRequest.of(chunk, EXPORT_CHUNK))
                    .getContent().stream()
                    .map(this::toFailedPost)
                    .forEach(row -> appendCsvRow(csv, row));
        }
        return ApiResponse.success("Export bài lỗi thành công", csv.toString());
    }

    /** Một chỉ số: tổng cả kỳ + chuỗi đếm theo ngày (đã zero-fill) để vẽ sparkline. */
    private record MetricSeries(long total, List<Long> series) {
    }

    /** Sáu chỉ số của một kỳ, đủ cho cả hai bộ thẻ KPI (tab Bị từ chối và tab Lỗi hệ thống). */
    private record DailyTotals(MetricSeries total, MetricSeries policy, MetricSeries technical,
                               MetricSeries temporary, MetricSeries permanent,
                               MetricSeries affectedAll, MetricSeries affectedTechnical) {
    }

    /** Vị trí các cột đếm trong một dòng của countFailedForAdminByDay (sau cột `day`). */
    private static final int COL_TOTAL = 0;
    private static final int COL_POLICY = 1;
    private static final int COL_TEMPORARY = 2;
    private static final int COL_PERMANENT = 3;
    private static final int COL_AFFECTED = 4;
    private static final int COL_AFFECTED_TECH = 5;

    /**
     * Gom kết quả GROUP BY theo ngày về chuỗi liên tục [from..to]: ngày không có bài lỗi vẫn phải
     * có điểm 0, nếu không sparkline sẽ bóp méo khoảng cách giữa các ngày.
     */
    private DailyTotals dailyTotals(LocalDate from, LocalDate to) {
        Map<LocalDate, long[]> byDay = new HashMap<>();
        for (Object[] row : postRepository.countFailedForAdminByDay(startOf(from), endOf(to))) {
            LocalDate day = SqlTemporalUtil.toLocalDate(row[0]);
            long[] counts = new long[EMPTY_DAY.length];
            for (int i = 0; i < counts.length; i++) {
                counts[i] = ((Number) row[i + 1]).longValue();
            }
            byDay.put(day, counts);
        }

        List<Long> totals = new ArrayList<>();
        List<Long> policies = new ArrayList<>();
        List<Long> technicals = new ArrayList<>();
        List<Long> temporaries = new ArrayList<>();
        List<Long> permanents = new ArrayList<>();
        List<Long> affectedAll = new ArrayList<>();
        List<Long> affectedTech = new ArrayList<>();
        long sumTotal = 0;
        long sumPolicy = 0;
        long sumTemporary = 0;
        long sumPermanent = 0;
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            long[] v = byDay.getOrDefault(day, EMPTY_DAY);
            totals.add(v[COL_TOTAL]);
            policies.add(v[COL_POLICY]);
            technicals.add(v[COL_TOTAL] - v[COL_POLICY]);
            temporaries.add(v[COL_TEMPORARY]);
            permanents.add(v[COL_PERMANENT]);
            affectedAll.add(v[COL_AFFECTED]);
            affectedTech.add(v[COL_AFFECTED_TECH]);
            sumTotal += v[COL_TOTAL];
            sumPolicy += v[COL_POLICY];
            sumTemporary += v[COL_TEMPORARY];
            sumPermanent += v[COL_PERMANENT];
        }
        return new DailyTotals(
                new MetricSeries(sumTotal, totals),
                new MetricSeries(sumPolicy, policies),
                new MetricSeries(sumTotal - sumPolicy, technicals),
                new MetricSeries(sumTemporary, temporaries),
                new MetricSeries(sumPermanent, permanents),
                new MetricSeries(0, affectedAll),
                new MetricSeries(0, affectedTech));
    }

    /**
     * Ô "% thay đổi" có BA trạng thái khác nhau vì kỳ trước bằng 0 không có nghĩa duy nhất:
     * cả hai kỳ đều 0 ⇒ NONE ("—", không có gì để so); kỳ này mới phát sinh ⇒ NEW ("Mới", không
     * phải +∞%); còn lại mới tính phần trăm. Nhờ vậy ô 0 bài KHÔNG bao giờ hiện -100%.
     */
    private AdminFailedPostSummaryResponse.Kpi kpi(MetricSeries current, MetricSeries previous) {
        long value = current.total();
        long prev = previous.total();
        if (prev == 0) {
            AdminFailedPostSummaryResponse.DeltaState state = value == 0
                    ? AdminFailedPostSummaryResponse.DeltaState.NONE
                    : AdminFailedPostSummaryResponse.DeltaState.NEW;
            return adminMonitorMapper.toKpi(value, null, state, current.series());
        }
        int deltaPct = (int) Math.round((value - prev) * 100.0 / prev);
        return adminMonitorMapper.toKpi(value, deltaPct,
                AdminFailedPostSummaryResponse.DeltaState.PERCENT, current.series());
    }

    /** violationOnly (cờ cũ) thắng filter — caller cũ chỉ biết cờ này. */
    private static String mode(FailedPostFilterQuery query) {
        if (query.violationOnly()) {
            return FailedPostFilter.POLICY.name();
        }
        return (query.filter() == null ? FailedPostFilter.ALL : query.filter()).name();
    }

    private static String name(Enum<?> value) {
        return value == null ? null : value.name();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static LocalDateTime startOf(LocalDate date) {
        return date == null ? null : date.atStartOfDay();
    }

    /** `to` BAO GỒM cả ngày đó → mốc trên là 00:00 ngày kế tiếp (so sánh nửa mở, cùng quy ước log). */
    private static LocalDateTime endOf(LocalDate date) {
        return date == null ? null : date.plusDays(1).atStartOfDay();
    }

    private static void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            return;
        }
        if (from.isAfter(to)) {
            throw new AppException(ErrorCode.FAILED_POST_RANGE_INVALID);
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_RANGE_DAYS) {
            throw new AppException(ErrorCode.FAILED_POST_RANGE_TOO_LARGE);
        }
    }

    private static void appendCsvRow(StringBuilder csv, AdminFailedPostResponse row) {
        csv.append(CsvUtil.nullToEmpty(row.getFailedAt())).append(',')
                .append(CsvUtil.nullToEmpty(row.getPlatformName())).append(',')
                .append(CsvUtil.field(row.getOwnerEmail())).append(',')
                .append(CsvUtil.field(row.getAccountName())).append(',')
                .append(CsvUtil.nullToEmpty(row.getErrorType())).append(',')
                .append(CsvUtil.field(row.getErrorCode())).append(',')
                .append(CsvUtil.field(row.getErrorMessage())).append(',')
                .append(CsvUtil.nullToEmpty(row.getRetryCount())).append(',')
                .append(CsvUtil.nullToEmpty(row.getNextRetryAt())).append(',')
                .append(CsvUtil.field(row.getCaption())).append('\n');
    }

    // Job FAILED cuối = nguồn errorType/thời điểm; PublishResult lỗi cuối = mã + message gốc (FR-35).
    private AdminFailedPostResponse toFailedPost(Post post) {
        PostingJob lastFailedJob = post.getPostingJobs().stream()
                .filter(j -> j.getStatus() == PostingJobStatus.FAILED)
                .max(Comparator.comparing(PostingJob::getEndTime,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElse(null);
        PublishResult lastError = post.getPublishResults().stream()
                .filter(r -> Boolean.FALSE.equals(r.getIsSuccess()))
                .max(Comparator.comparing(PublishResult::getCreatedAt,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElse(null);
        return adminMonitorMapper.toFailedPost(post, lastFailedJob, lastError);
    }

    // Latency = thời gian 'SELECT 1'; activeConnections = pool HikariCP đang dùng.
    private AdminSystemStatusResponse.ServiceHealthResponse checkDatabase() {
        try {
            long start = System.nanoTime();
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            long latencyMs = (System.nanoTime() - start) / 1_000_000;
            return adminMonitorMapper.toServiceHealth("database", STATUS_UP, null,
                    latencyMs, hikariActiveConnections(), null, null);
        } catch (Exception e) {
            return adminMonitorMapper.toServiceHealth("database", STATUS_DOWN, e.getMessage(), null, null, null, null);
        }
    }

    private Integer hikariActiveConnections() {
        if (dataSource instanceof HikariDataSource hikari && hikari.getHikariPoolMXBean() != null) {
            return hikari.getHikariPoolMXBean().getActiveConnections();
        }
        return null;
    }

    // Latency = thời gian PING; memory/hit-rate từ INFO (một số managed Redis hạn chế INFO → ẩn, vẫn UP).
    private AdminSystemStatusResponse.ServiceHealthResponse checkRedis() {
        try (var connection = stringRedisTemplate.getConnectionFactory().getConnection()) {
            long start = System.nanoTime();
            String pong = connection.ping();
            long latencyMs = (System.nanoTime() - start) / 1_000_000;
            boolean up = "PONG".equalsIgnoreCase(pong);

            String memoryUsed = null;
            Double hitRate = null;
            try {
                Properties info = connection.serverCommands().info();
                if (info != null) {
                    memoryUsed = info.getProperty("used_memory_human");
                    hitRate = hitRate(info.getProperty("keyspace_hits"), info.getProperty("keyspace_misses"));
                }
            } catch (Exception ignored) {
                // INFO không khả dụng (vd Upstash giới hạn) → giữ null, không hạ trạng thái.
            }
            return adminMonitorMapper.toServiceHealth("redis", up ? STATUS_UP : STATUS_DOWN, null,
                    latencyMs, null, memoryUsed, hitRate);
        } catch (Exception e) {
            return adminMonitorMapper.toServiceHealth("redis", STATUS_DOWN, e.getMessage(), null, null, null, null);
        }
    }

    private Double hitRate(String hitsStr, String missesStr) {
        try {
            long hits = Long.parseLong(hitsStr.trim());
            long misses = Long.parseLong(missesStr.trim());
            long total = hits + misses;
            return total == 0 ? null : Math.round(hits * 10000.0 / total) / 100.0; // % 2 chữ số
        } catch (Exception e) {
            return null;
        }
    }

    // FastAPI luôn phục vụ /openapi.json — đủ làm health probe; latency = thời gian probe.
    private AdminSystemStatusResponse.ServiceHealthResponse checkAiService() {
        try {
            long start = System.nanoTime();
            aiServiceWebClient.get()
                    .uri("/openapi.json")
                    .retrieve()
                    .toBodilessEntity()
                    .block(Duration.ofSeconds(5));
            long latencyMs = (System.nanoTime() - start) / 1_000_000;
            return adminMonitorMapper.toServiceHealth("aiService", STATUS_UP, null, latencyMs, null, null, null);
        } catch (Exception e) {
            return adminMonitorMapper.toServiceHealth("aiService", STATUS_DOWN, e.getMessage(), null, null, null, null);
        }
    }

    // JMX/Runtime: chỉ số ở mức tiến trình JVM/container (KHÔNG phải máy chủ vật lý). Lỗi → null (FE ẩn).
    private AdminSystemStatusResponse.HostMetricsResponse hostMetrics() {
        try {
            Double cpuLoad = null;
            if (ManagementFactory.getOperatingSystemMXBean()
                    instanceof com.sun.management.OperatingSystemMXBean sun) {
                double load = sun.getProcessCpuLoad(); // 0..1; <0 khi chưa có số liệu
                if (load >= 0) {
                    cpuLoad = Math.round(load * 10000.0) / 100.0;
                }
            }
            Runtime rt = Runtime.getRuntime();
            long memUsedMb = (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
            long memMaxMb = rt.maxMemory() / (1024 * 1024);
            File work = new File(".");
            long diskFreeGb = work.getUsableSpace() / (1024L * 1024 * 1024);
            long diskTotalGb = work.getTotalSpace() / (1024L * 1024 * 1024);
            return adminMonitorMapper.toHostMetrics(cpuLoad, memUsedMb, memMaxMb, diskFreeGb, diskTotalGb);
        } catch (Exception e) {
            log.warn("[AdminMonitor] Không lấy được host metrics: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public ApiResponse<SystemActivityResponse> systemActivity(String range) {
        Granularity g = Granularity.of(range);
        LocalDateTime to = LocalDateTime.now();
        LocalDateTime origin = alignDown(to.minus(g.window), g.bucket);

        Map<LocalDateTime, long[]> counts = queryActivity(g.interval, origin, to);

        List<SystemActivityResponse.ActivityBucket> buckets = new ArrayList<>();
        for (LocalDateTime t = origin; t.isBefore(to); t = t.plus(g.bucket)) {
            long[] c = counts.getOrDefault(t, EMPTY);
            long total = c[0] + c[1] + c[2];
            buckets.add(adminMonitorMapper.toActivityBucket(t, c[0], c[1], c[2], total));
        }
        SystemActivityResponse response = adminMonitorMapper.toActivityResponse(g.range, g.label, buckets);
        return ApiResponse.success("Lấy hoạt động hệ thống thành công", response);
    }

    // Một native query gộp 3 nguồn qua date_bin (PG 14+); trả (bucket, kind, count). Không bảng metrics riêng.
    private Map<LocalDateTime, long[]> queryActivity(String interval, LocalDateTime origin, LocalDateTime to) {
        String sql = """
                SELECT bucket, kind, cnt FROM (
                  SELECT date_bin(CAST(? AS interval), published_at, CAST(? AS timestamp)) AS bucket,
                         'posts' AS kind, count(*) AS cnt
                  FROM posts WHERE status = 'POSTED' AND deleted_at IS NULL
                    AND published_at >= ? AND published_at < ? GROUP BY 1
                  UNION ALL
                  SELECT date_bin(CAST(? AS interval), start_time, CAST(? AS timestamp)), 'jobs', count(*)
                  FROM posting_jobs WHERE deleted_at IS NULL
                    AND start_time >= ? AND start_time < ? GROUP BY 1
                  UNION ALL
                  SELECT date_bin(CAST(? AS interval), created_at, CAST(? AS timestamp)), 'errors', count(*)
                  FROM system_logs WHERE level = 'ERROR' AND deleted_at IS NULL
                    AND created_at >= ? AND created_at < ? GROUP BY 1
                ) t
                """;
        Timestamp originTs = Timestamp.valueOf(origin);
        Timestamp fromTs = originTs;
        Timestamp toTs = Timestamp.valueOf(to);
        Map<LocalDateTime, long[]> result = new LinkedHashMap<>();
        jdbcTemplate.query(sql, rs -> {
            LocalDateTime bucket = rs.getTimestamp("bucket").toLocalDateTime();
            String kind = rs.getString("kind");
            long cnt = rs.getLong("cnt");
            long[] arr = result.computeIfAbsent(bucket, k -> new long[3]);
            switch (kind) {
                case "posts" -> arr[0] = cnt;
                case "jobs" -> arr[1] = cnt;
                case "errors" -> arr[2] = cnt;
                default -> { }
            }
        }, interval, originTs, fromTs, toTs, interval, originTs, fromTs, toTs, interval, originTs, fromTs, toTs);
        return result;
    }

    // Căn mốc xuống bội của bucket (theo epoch) để date_bin và vòng lặp Java trùng mốc.
    private static LocalDateTime alignDown(LocalDateTime time, Duration bucket) {
        long bucketSec = bucket.getSeconds();
        long epoch = time.toEpochSecond(java.time.ZoneOffset.UTC);
        long aligned = Math.floorDiv(epoch, bucketSec) * bucketSec;
        return LocalDateTime.ofEpochSecond(aligned, 0, java.time.ZoneOffset.UTC);
    }

    private static final long[] EMPTY = new long[3];

    /** Khoảng thời gian + độ mịn bucket tương ứng (yêu cầu: 1h→phút, 24h→30′, 7d→giờ, 30d→6h, 1y→ngày). */
    private enum Granularity {
        H1("1h", Duration.ofHours(1), Duration.ofMinutes(1), "1 minute", "1m"),
        H24("24h", Duration.ofHours(24), Duration.ofMinutes(30), "30 minutes", "30m"),
        D7("7d", Duration.ofDays(7), Duration.ofHours(1), "1 hour", "1h"),
        D30("30d", Duration.ofDays(30), Duration.ofHours(6), "6 hours", "6h"),
        Y1("1y", Duration.ofDays(365), Duration.ofDays(1), "1 day", "1d");

        final String range;
        final Duration window;
        final Duration bucket;
        final String interval;
        final String label;

        Granularity(String range, Duration window, Duration bucket, String interval, String label) {
            this.range = range;
            this.window = window;
            this.bucket = bucket;
            this.interval = interval;
            this.label = label;
        }

        static Granularity of(String range) {
            for (Granularity g : values()) {
                if (g.range.equalsIgnoreCase(range)) {
                    return g;
                }
            }
            return H24; // mặc định
        }
    }

    private long safeCount(java.util.function.LongSupplier supplier) {
        try {
            return supplier.getAsLong();
        } catch (Exception e) {
            log.warn("[AdminMonitor] Không đếm được số liệu: {}", e.getMessage());
            return -1;
        }
    }
}
