package com.aima.analytics;

import com.aima.dto.response.AnalyticsContentTypeResponse;
import com.aima.dto.response.AnalyticsHeatmapResponse;
import com.aima.dto.response.AnalyticsInsightsResponse;
import com.aima.dto.response.AnalyticsPlatformResponse;
import com.aima.dto.response.AnalyticsSummaryResponse;
import com.aima.dto.response.AnalyticsSyncAccountResponse;
import com.aima.dto.response.AnalyticsSyncStatusResponse;
import com.aima.dto.response.AnalyticsTimeseriesResponse;
import com.aima.dto.response.AnalyticsTopPostResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.Post;
import com.aima.entity.PostAnalytics;
import com.aima.entity.PostSchedule;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.MediaOrigin;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PlatformMediaStatus;
import com.aima.enums.PostStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostAnalyticsRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.scheduler.AnalyticsCollectionJob;
import com.aima.service.AnalyticsService;
import com.aima.service.AnalyticsService.AnalyticsQuery;
import com.aima.util.PublishingTime;
import okhttp3.mockwebserver.Dispatcher;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.util.AopTestUtils;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.sql.DriverManager;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Analytics giai đoạn 1–2 trên PostgreSQL THẬT (stack cô lập :55432): Flyway V1→V8 + Hibernate validate, job đồng
 * bộ (Meta giả) chép mốc cũ + đồng bộ cấp Trang (import bài ngoài AIMA, insights, liên kết IG) + gọi adapter Facebook,
 * rồi MỌI truy vấn native của /analytics/* chạy trên dữ liệu đó (kể cả bộ lọc "Chỉ bài AIMA").
 * H2 không chạy được các truy vấn này (DISTINCT ON / LATERAL / AT TIME ZONE / string_to_array).
 * Chạy: {@code -Disolated.postgres=true} (docker compose -f isolated/compose.yml up -d postgres).
 */
@EnabledIfSystemProperty(named = "isolated.postgres", matches = "true")
@SpringBootTest(properties = {
        "meta.app-secret-proof-enabled=false",
        "meta.response-timeout-seconds=5",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
})
class AnalyticsRealDataPgTest {

    static final String URL = "jdbc:postgresql://127.0.0.1:55432/aima_isolated";
    static final String SCHEMA = "analytics_" + UUID.randomUUID().toString().replace("-", "");
    static final MockWebServer META = new MockWebServer();
    /** platformPostId → {reactions, comments, shares, views}. */
    static final Map<String, long[]> METRICS = new ConcurrentHashMap<>();
    /** pageId → phần tử "data" của /published_posts. */
    static final Map<String, List<String>> PUBLISHED = new ConcurrentHashMap<>();
    /** pageId → JSON /insights của Trang. */
    static final Map<String, String> PAGE_INSIGHTS = new ConcurrentHashMap<>();
    static final DateTimeFormatter GRAPH_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssZ");

    @BeforeAll
    static void startMeta() throws IOException {
        META.setDispatcher(new Dispatcher() {
            @Override
            public MockResponse dispatch(RecordedRequest request) {
                String path = String.valueOf(request.getPath());
                // Cấp Trang (giai đoạn 2): danh sách bài, insights Trang, số người theo dõi, liên kết Instagram.
                for (String pageId : PUBLISHED.keySet()) {
                    if (path.contains("/" + pageId + "/published_posts")) {
                        return json("{\"data\":[" + String.join(",", PUBLISHED.get(pageId)) + "]}");
                    }
                    if (path.contains("/" + pageId + "/insights")) {
                        return json(PAGE_INSIGHTS.getOrDefault(pageId, "{\"data\":[]}"));
                    }
                    if (path.contains("/" + pageId + "?") && path.contains("followers_count")) {
                        return json("{\"followers_count\":321,\"id\":\"" + pageId + "\"}");
                    }
                    if (path.contains("/" + pageId + "?") && path.contains("instagram_business_account")) {
                        return json("{\"id\":\"" + pageId + "\"}"); // Trang chưa liên kết IG Business
                    }
                }
                for (Map.Entry<String, long[]> e : METRICS.entrySet()) {
                    if (!path.contains("/" + e.getKey())) {
                        continue;
                    }
                    long[] m = e.getValue();
                    return path.contains("/insights")
                            ? json("{\"data\":[{\"name\":\"post_media_view\",\"values\":[{\"value\":" + m[3] + "}]}]}")
                            : json("{\"reactions\":{\"summary\":{\"total_count\":" + m[0] + "}},\"comments\":{\"summary\":"
                            + "{\"total_count\":" + m[1] + "}},\"shares\":{\"count\":" + m[2] + "}}");
                }
                return new MockResponse().setResponseCode(400).setHeader("Content-Type", "application/json")
                        .setBody("{\"error\":{\"message\":\"unknown\",\"code\":100,\"error_subcode\":33}}");
            }
        });
        META.start();
    }

    @AfterAll
    static void cleanup() throws Exception {
        META.shutdown();
        try (var db = DriverManager.getConnection(URL, "aima_isolated", "isolated-only")) {
            db.createStatement().execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
        registry.add("spring.datasource.username", () -> "aima_isolated");
        registry.add("spring.datasource.password", () -> "isolated-only");
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
        registry.add("meta.graph-base-url", () -> "http://localhost:" + META.getPort());
        registry.add("meta.threads-base-url", () -> "http://localhost:" + META.getPort());
    }

    @Autowired private AnalyticsCollectionJob jobBean;
    @Autowired private AnalyticsService analyticsService;
    @Autowired private com.aima.service.DashboardService dashboardService;
    @Autowired private com.aima.service.UserService userService;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private BrandProfileRepository brandProfileRepository;
    @Autowired private ContentItemRepository contentItemRepository;
    @Autowired private ContentVersionRepository contentVersionRepository;
    @Autowired private PlatformAccountRepository accountRepository;
    @Autowired private PostScheduleRepository scheduleRepository;
    @Autowired private PostRepository postRepository;
    @Autowired private PostAnalyticsRepository postAnalyticsRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private com.aima.service.PlatformConnectionService platformConnectionService;
    @Autowired private com.aima.service.AnalyticsSyncService syncService;
    @Autowired private com.aima.repository.PlatformMediaRepository platformMediaRepository;
    @Autowired private com.aima.scheduler.LogRetentionJob logRetentionJob;
    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Test
    void syncThenEveryAnalyticsEndpointReadsRealData() {
        String email = "pg-" + UUID.randomUUID() + "@it.local";
        PlatformAccount page = newPage(email);
        // Bài cũ 3 ngày: có mốc 24h/48h cũ (views null như FB trước đây) — job chép sang snapshot rồi đồng bộ lại.
        UUID old = newPost(page, "old", Duration.ofDays(3), 40, 5, 2, 900);
        legacyMilestone(old, 24, 4L);
        legacyMilestone(old, 48, 6L);
        // Bài mới 25h.
        UUID fresh = newPost(page, "fresh", Duration.ofHours(25), 10, 1, 0, 300);
        // Giai đoạn 2: bài người dùng TỰ ĐĂNG trên Trang (không qua AIMA) — job import rồi đồng bộ cùng lượt.
        LocalDate today = LocalDate.now(PublishingTime.LEGACY_ZONE);
        publishedOnPage(page, "old", null, Duration.ofDays(3));
        publishedOnPage(page, "fresh", null, Duration.ofHours(25));
        publishedOnPage(page, "ext", "photo", Duration.ofDays(2));
        METRICS.put(page.getPlatformAccountId() + "_ext", new long[]{7, 1, 1, 100});
        PAGE_INSIGHTS.put(page.getPlatformAccountId(), pageInsights(Map.of(today.minusDays(1), 4L, today.minusDays(2), 6L)));

        AopTestUtils.<AnalyticsCollectionJob>getTargetObject(jobBean).run();

        AnalyticsQuery week = new AnalyticsQuery(today.minusDays(6), today, null, null);
        AnalyticsQuery weekAima = new AnalyticsQuery(today.minusDays(6), today, null, null, "aima");

        // KPI = số PHÁT SINH trong kỳ: cả ba bài đăng trong kỳ nên = số tích luỹ hiện tại (mặc định: toàn Trang).
        AnalyticsSummaryResponse summary = analyticsService.summary(email, week).getResult();
        assertEquals(1300, summary.getViews().getTotal());
        assertEquals(57, summary.getLikes().getTotal());
        assertEquals(7, summary.getComments().getTotal());
        assertEquals(3, summary.getShares().getTotal());
        AnalyticsSummaryResponse aimaOnly = analyticsService.summary(email, weekAima).getResult();
        assertEquals(1200, aimaOnly.getViews().getTotal(), "Chỉ bài AIMA bỏ bài tự đăng");
        assertEquals(50, aimaOnly.getLikes().getTotal());

        AnalyticsTimeseriesResponse series = analyticsService.timeseries(email, week).getResult();
        assertEquals(7, series.getPoints().size());
        assertEquals(1300, series.getPoints().stream().mapToLong(p -> p.getViews()).sum());
        // Bài theo dõi muộn (đồng bộ lần đầu sau nhiều ngày) → số chia đều từ ngày đăng = ƯỚC TÍNH, ngày đó được đánh dấu.
        assertTrue(series.getPoints().stream().anyMatch(p -> p.isEstimated()), "có ngày mang số ước tính");
        assertFalse(series.getPoints().getLast().isEstimated() && series.getPoints().getLast().getViews() == 0,
                "ngày không có số thì không bị đánh dấu ước tính");

        // Lọc nền tảng / loại nội dung đi qua SQL thật (bài ngoài AIMA lấy loại nội dung do nền tảng báo).
        assertEquals(0, analyticsService.summary(email, new AnalyticsQuery(today.minusDays(6), today,
                List.of(Platform.THREADS), null)).getResult().getViews().getTotal());
        assertEquals(1200, analyticsService.summary(email, new AnalyticsQuery(today.minusDays(6), today,
                null, List.of("TEXT"))).getResult().getViews().getTotal());
        assertEquals(100, analyticsService.summary(email, new AnalyticsQuery(today.minusDays(6), today,
                null, List.of("IMAGE"))).getResult().getViews().getTotal());

        AnalyticsPlatformResponse facebook = analyticsService.byPlatform(email, week).getResult().stream()
                .filter(p -> p.getPlatform() == Platform.FACEBOOK).findFirst().orElseThrow();
        assertEquals(1300, facebook.getViews());
        assertEquals(67, facebook.getEngagement());
        assertEquals(58, analyticsService.byPlatform(email, weekAima).getResult().stream()
                .filter(p -> p.getPlatform() == Platform.FACEBOOK).findFirst().orElseThrow().getEngagement());

        List<AnalyticsTopPostResponse> top = analyticsService.topPosts(email, week, "views,desc", 10).getResult();
        assertEquals(List.of(900L, 300L, 100L), top.stream().map(AnalyticsTopPostResponse::getViews).toList());
        assertEquals(40, top.getFirst().getLikes(), "Top bài viết = snapshot MỚI NHẤT, likes = reactions");
        assertTrue(top.stream().noneMatch(AnalyticsTopPostResponse::isLegacyOnly), "đã đồng bộ lại → không còn chỉ có mốc cũ");
        assertEquals("https://fb.test/old", top.getFirst().getPermalink(), "bài AIMA được bổ sung đường dẫn");
        assertEquals(MediaOrigin.AIMA, top.getFirst().getOrigin());
        AnalyticsTopPostResponse external = top.getLast();
        assertEquals(MediaOrigin.EXTERNAL, external.getOrigin());
        assertNull(external.getPostId());
        assertNotNull(external.getMediaId());
        assertEquals("Bai tu dang ext", external.getCaption());
        assertEquals(PlatformMediaStatus.ACTIVE, external.getPlatformStatus());
        assertEquals(2, analyticsService.topPosts(email, weekAima, "views,desc", 10).getResult().size());

        List<AnalyticsContentTypeResponse> types = analyticsService.byContentType(email, week).getResult();
        assertEquals("TEXT", types.getFirst().getLabel());
        assertEquals(2, types.getFirst().getPosts());
        assertEquals("IMAGE", types.getLast().getLabel());

        AnalyticsHeatmapResponse heatmap = analyticsService.activityHeatmap(email, week).getResult();
        assertEquals(3, heatmap.getCells().stream().mapToLong(c -> c.getPosts()).sum());

        AnalyticsInsightsResponse insights = analyticsService.insights(email, week).getResult();
        assertEquals(3, insights.getTotalPosts());
        assertEquals(5.2, insights.getEngagementRatePct(), "(reactions+comments+shares)/views = 67/1300");
        assertEquals(10L, insights.getNewFollowers(), "người theo dõi mới = cộng follows theo ngày của Trang");
        assertEquals(321L, insights.getFollowersTotal());
        AnalyticsInsightsResponse aimaInsights = analyticsService.insights(email, weekAima).getResult();
        assertEquals(2, aimaInsights.getTotalPosts());
        assertEquals(4.8, aimaInsights.getEngagementRatePct(), "58/1200");
        assertEquals(10L, aimaInsights.getNewFollowers(), "số cấp Trang không đổi theo nguồn bài");

        assertEquals("published_at,platform,account_name,caption,views,likes,comments,shares,engagement,origin,permalink",
                analyticsService.export(email, week, null).getResult().lines().findFirst().orElseThrow());
        assertEquals(4, analyticsService.export(email, week, null).getResult().lines().count(), "header + 3 bài");

        AnalyticsSyncStatusResponse status = analyticsService.syncStatus(email).getResult();
        assertTrue(status.isConnected());
        AnalyticsSyncAccountResponse account = status.getAccounts().getFirst();
        assertEquals(3, account.getTrackedPosts());
        assertEquals(0, account.getPendingPosts());
        assertEquals(Boolean.FALSE, account.getInsightsPermission(), "scopes không có read_insights");
        assertNotNull(account.getLastSyncedAt());
        assertEquals(0, analyticsService.requestSync(email).getResult(), "vừa đồng bộ → nút Làm mới chưa xếp lại");

        // Q10 — Bảng điều khiển + Hồ sơ dùng CÙNG nguồn/cách tính → cùng con số với trang Phân tích.
        var dashboard = dashboardService.getSummary(email, 7).getResult();
        assertEquals(series.getPoints().stream().map(p -> p.getViews()).toList(),
                dashboard.getPerformance().stream().map(p -> p.getReach()).toList(), "lượt xem từng ngày khớp trang Phân tích");
        assertEquals(series.getPoints().stream().map(p -> p.getLikes() + p.getComments() + p.getShares()).toList(),
                dashboard.getPerformance().stream().map(p -> p.getEngagement()).toList(), "tương tác từng ngày khớp");
        assertNotNull(dashboard.getTopTopics(), "truy vấn Top chủ đề chạy được trên PG");
        var profile = userService.getMyStats(email).getResult();
        assertEquals(2, profile.getPostsPublished());
        assertEquals(1200, profile.getTotalReach(), "Hồ sơ: tổng lượt xem = snapshot mới nhất mỗi bài AIMA");

        // (d) Trang không có Instagram Business liên kết → Cài đặt hướng dẫn ở thẻ Instagram.
        assertEquals(com.aima.enums.InstagramLinkStatus.NOT_LINKED, platformConnectionService.listConnections(email)
                .getResult().stream().filter(c -> c.getId().equals(page.getId())).findFirst().orElseThrow()
                .getInstagramLinkStatus());

        // Mốc: bài mới có mốc 24h tính từ snapshot; bài cũ giữ nguyên 2 mốc cũ (không sửa dữ liệu cũ).
        assertEquals(1, postAnalyticsRepository.findByPost_IdAndDeletedAtIsNull(fresh).size());
        assertEquals(2, postAnalyticsRepository.findByPost_IdAndDeletedAtIsNull(old).size());
        assertNull(postAnalyticsRepository.findByPost_IdAndDeletedAtIsNull(old).getFirst().getViews());
    }

    @Test
    void retention_purgesOldSnapshotsButKeepsLatestOfEachPost() {
        PlatformAccount page = newPage("ret-" + UUID.randomUUID() + "@it.local");
        UUID a = newPost(page, "reta", Duration.ofDays(400), 1, 0, 0, 1);
        UUID b = newPost(page, "retb", Duration.ofDays(400), 1, 0, 0, 1);
        syncService.prepare(1000);
        UUID mediaA = platformMediaRepository.findByPost_Id(a).orElseThrow().getId();
        UUID mediaB = platformMediaRepository.findByPost_Id(b).orElseThrow().getId();
        for (int daysAgo : new int[]{300, 200, 1}) {
            snapshot(mediaA, daysAgo);
        }
        snapshot(mediaB, 300); // snapshot DUY NHẤT của bài — Top bài viết / Hồ sơ còn đọc nó

        logRetentionJob.purge();

        assertEquals(List.of(1), snapshotAges(mediaA), "bỏ bản > 180 ngày, giữ bản mới nhất");
        assertEquals(List.of(300), snapshotAges(mediaB), "bản mới nhất của bài không bao giờ bị xoá");
    }

    @Test
    void contentType_followsPlatformNotAiMediaFormat() {
        String email = "type-" + UUID.randomUUID() + "@it.local";
        PlatformAccount page = newPage(email);
        // Bài AIMA chưa được quét danh sách bài của Trang (chưa có nhãn nền tảng) → TEXT, KHÔNG phải "video" AI gợi ý.
        newPost(page, "solo", Duration.ofDays(2), 1, 0, 0, 10);
        syncService.prepare(1000);
        LocalDate today = LocalDate.now(PublishingTime.LEGACY_ZONE);
        AnalyticsQuery week = new AnalyticsQuery(today.minusDays(6), today, null, null);

        List<AnalyticsContentTypeResponse> types = analyticsService.byContentType(email, week).getResult();
        assertEquals(List.of("TEXT"), types.stream().map(AnalyticsContentTypeResponse::getLabel).toList());
        assertEquals(1, analyticsService.topPosts(email, new AnalyticsQuery(today.minusDays(6), today, null,
                List.of("TEXT")), "views,desc", 10).getResult().size());
        assertEquals(0, analyticsService.topPosts(email, new AnalyticsQuery(today.minusDays(6), today, null,
                List.of("VIDEO")), "views,desc", 10).getResult().size());
    }

    private void snapshot(UUID mediaId, int daysAgo) {
        jdbcTemplate.update("insert into post_metric_snapshots(id,created_at,platform_media_id,collected_at,reactions,source) "
                + "values (gen_random_uuid(), now(), ?, now() - make_interval(days => ?), 1, 'POLL')", mediaId, daysAgo);
    }

    private List<Integer> snapshotAges(UUID mediaId) {
        return jdbcTemplate.queryForList("select cast(round(extract(epoch from now() - collected_at) / 86400) as int) "
                + "from post_metric_snapshots where platform_media_id = ? order by collected_at", Integer.class, mediaId);
    }

    // ================================================================== fixture

    private PlatformAccount newPage(String email) {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("PG IT").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        PlatformAccount page = new PlatformAccount();
        page.setUser(user);
        page.setPlatformName(Platform.FACEBOOK);
        page.setPlatformAccountId("pgpage" + Math.abs(UUID.randomUUID().getMostSignificantBits()));
        page.setAccountName("PG PAGE");
        page.setAccountType(PlatformAccountType.PAGE);
        page.setTokenType(TokenType.PAGE_TOKEN);
        page.setAccessToken("page-token");
        page.setConnectionStatus(ConnectionStatus.ACTIVE);
        page.setScopes("[\"pages_show_list\",\"pages_manage_posts\"]");
        return accountRepository.save(page);
    }

    private UUID newPost(PlatformAccount page, String tag, Duration age, long reactions, long comments, long shares, long views) {
        BrandProfile brand = new BrandProfile();
        brand.setUser(page.getUser());
        brand.setBrandName("Brand PG " + tag);
        brand.setIndustry("Beauty");
        brand.setTargetAudience("Everyone");
        brand = brandProfileRepository.save(brand);

        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.applyResolvedStatus(ContentItemStatus.POSTED);
        item = contentItemRepository.save(item);

        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(Platform.FACEBOOK);
        version.setFormattedCaption("Bai " + tag);
        // AI gợi ý media "video" nhưng AIMA chỉ đăng bài chữ → loại nội dung phải theo nền tảng báo (TEXT), không theo đây.
        version.setMediaFormat("video");
        version.setStatus(ContentVersionStatus.FORMATTED);
        version = contentVersionRepository.save(version);

        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setPlatformAccount(page);
        schedule.setScheduledTime(Instant.now().minus(age));
        schedule.setStatus(ScheduleStatus.POSTED);
        schedule = scheduleRepository.save(schedule);

        String platformPostId = page.getPlatformAccountId() + "_" + tag;
        Post post = new Post();
        post.setSchedule(schedule);
        post.setPlatformName(Platform.FACEBOOK);
        post.setStatus(PostStatus.POSTED);
        post.setPlatformPostId(platformPostId);
        post.setPublishedAt(Instant.now().minus(age));
        METRICS.put(platformPostId, new long[]{reactions, comments, shares, views});
        return postRepository.save(post).getId();
    }

    /** Bài có trên Trang (Meta trả trong /published_posts). attachment null = bài chữ. */
    private void publishedOnPage(PlatformAccount page, String tag, String attachment, Duration age) {
        String created = GRAPH_TIME.format(Instant.now().minus(age).atZone(ZoneOffset.UTC));
        PUBLISHED.computeIfAbsent(page.getPlatformAccountId(), k -> new java.util.concurrent.CopyOnWriteArrayList<>())
                .add("{\"id\":\"" + page.getPlatformAccountId() + "_" + tag + "\",\"created_time\":\"" + created
                        + "\",\"permalink_url\":\"https://fb.test/" + tag + "\",\"message\":\"Bai tu dang " + tag + "\""
                        + (attachment == null ? "" : ",\"attachments\":{\"data\":[{\"media_type\":\"" + attachment + "\"}]}")
                        + "}");
    }

    /** Insights Trang: page_daily_follows_unique theo ngày (end_time = nửa đêm giờ Thái Bình Dương kết thúc ngày đó). */
    private static String pageInsights(Map<LocalDate, Long> follows) {
        return "{\"data\":[{\"name\":\"page_daily_follows_unique\",\"period\":\"day\",\"values\":["
                + follows.entrySet().stream().map(e -> "{\"value\":" + e.getValue() + ",\"end_time\":\""
                        + GRAPH_TIME.format(e.getKey().plusDays(1).atStartOfDay(ZoneId.of("America/Los_Angeles"))
                        .withZoneSameInstant(ZoneOffset.UTC)) + "\"}").collect(java.util.stream.Collectors.joining(","))
                + "]}]}";
    }

    private void legacyMilestone(UUID postId, int hours, Long likes) {
        transactionTemplate.executeWithoutResult(tx -> {
            Post post = postRepository.findById(postId).orElseThrow();
            PostAnalytics a = new PostAnalytics();
            a.setPost(post);
            a.setMilestoneHours(hours);
            a.setLikes(likes);
            a.setComments(0L);
            a.setShares(0L);
            a.setCollectedAt(post.getPublishedAt().plus(Duration.ofHours(hours)));
            postAnalyticsRepository.save(a);
        });
    }

    private static MockResponse json(String body) {
        return new MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody(body);
    }
}
