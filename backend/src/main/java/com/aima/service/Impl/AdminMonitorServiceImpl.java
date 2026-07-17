package com.aima.service.Impl;

import com.aima.dto.response.AdminFailedPostResponse;
import com.aima.dto.response.AdminSystemStatusResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.SystemLogResponse;
import com.aima.entity.Post;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishResult;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.LogLevel;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.mapper.AdminMonitorMapper;
import com.aima.mapper.SystemLogMapper;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.SystemLogRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AdminMonitorService;
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
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
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
    public ApiResponse<PageResponse<AdminFailedPostResponse>> listFailedPosts(boolean violationOnly,
                                                                              int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50));
        Page<Post> posts = postRepository.findFailedForAdmin(violationOnly, pageable);

        List<AdminFailedPostResponse> content = posts.getContent().stream()
                .map(this::toFailedPost)
                .toList();
        PageResponse<AdminFailedPostResponse> response = PageResponse.from(posts, content);
        return ApiResponse.success("Lấy danh sách bài thất bại thành công", response);
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
