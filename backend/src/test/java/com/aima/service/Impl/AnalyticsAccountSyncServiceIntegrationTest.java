package com.aima.service.Impl;

import com.aima.entity.AccountInsightsDaily;
import com.aima.entity.AccountSyncState;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PlatformMedia;
import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.InstagramLinkStatus;
import com.aima.enums.MediaOrigin;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PostStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.mapper.PostAnalyticsMapper;
import com.aima.repository.AccountInsightsDailyRepository;
import com.aima.repository.AccountSyncStateRepository;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PlatformMediaRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AnalyticsAccountSyncService;
import com.aima.service.AnalyticsSyncService;
import com.aima.service.PlatformMetricsProvider;
import com.aima.util.PublishingTime;
import okhttp3.mockwebserver.Dispatcher;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Analytics giai đoạn 2 — đồng bộ CẤP TÀI KHOẢN: import bài đăng ngoài AIMA (EXTERNAL), bổ sung permalink cho bài
 * AIMA, insights theo ngày của Trang (upsert, giữ số cũ khi metric vắng), tổng người theo dõi, liên kết Instagram,
 * lịch / backoff / rate limit; và {@code prepare} nhận lại dòng EXTERNAL khi đó thực ra là bài AIMA. Repository thật
 * trên H2, Meta giả bằng MockWebServer (dispatcher theo đường dẫn).
 */
@SpringBootTest(properties = {
        "meta.app-secret-proof-enabled=false",
        "meta.response-timeout-seconds=5",
})
class AnalyticsAccountSyncServiceIntegrationTest {

    static final MockWebServer META = new MockWebServer();
    static final ZoneId META_ZONE = ZoneId.of("America/Los_Angeles");
    static final DateTimeFormatter GRAPH_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssZ");

    @BeforeAll
    static void startMeta() throws IOException {
        META.start();
    }

    @AfterAll
    static void stopMeta() throws IOException {
        META.shutdown();
    }

    @DynamicPropertySource
    static void metaBaseUrl(DynamicPropertyRegistry registry) {
        registry.add("meta.graph-base-url", () -> "http://localhost:" + META.getPort());
        registry.add("meta.threads-base-url", () -> "http://localhost:" + META.getPort());
    }

    @Autowired private AnalyticsAccountSyncService accountSyncService;
    @Autowired private AnalyticsSyncService syncService;
    @Autowired private AccountSyncStateRepository stateRepository;
    @Autowired private AccountInsightsDailyRepository insightsRepository;
    @Autowired private PlatformMediaRepository platformMediaRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private BrandProfileRepository brandProfileRepository;
    @Autowired private ContentItemRepository contentItemRepository;
    @Autowired private ContentVersionRepository contentVersionRepository;
    @Autowired private PlatformAccountRepository accountRepository;
    @Autowired private PostScheduleRepository scheduleRepository;
    @Autowired private PostRepository postRepository;
    @Autowired private PostAnalyticsMapper postAnalyticsMapper;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private com.aima.repository.PostMetricSnapshotRepository snapshotRepository;

    record Fixture(UUID userId, UUID accountId, String pageId, UUID postId, String platformPostId) {
    }

    // ================================================================== thành công

    @Test
    void sync_importsExternalPosts_fillsAimaPermalink_upsertsInsights_recordsInstagramLink() {
        Fixture f = newPostedPost();
        syncService.prepare(1000); // bài AIMA có dòng theo dõi trước
        LocalDate today = LocalDate.now(PublishingTime.LEGACY_ZONE);
        META.setDispatcher(page(f, Map.of(
                "/published_posts", ok(publishedPosts(f)),
                "/insights", ok(insights(Map.of(
                        "page_daily_follows_unique", Map.of(today.minusDays(2), 3L, today.minusDays(1), 5L, today.plusDays(1), 0L),
                        "page_follows", Map.of(today.minusDays(1), 300L)))),
                "followers_count", ok("{\"followers_count\":321,\"id\":\"" + f.pageId() + "\"}"),
                "instagram_business_account", ok("{\"id\":\"" + f.pageId() + "\"}"),
                "/subscribed_apps", ok("{\"success\":true}"))));

        assertTrue(accountSyncService.sync(f.accountId()));

        Map<String, PlatformMedia> media = media(f.accountId());
        assertEquals(3, media.size(), "1 bài AIMA + 2 bài ngoài AIMA, không tạo trùng bài AIMA");
        PlatformMedia aima = media.get(f.platformPostId());
        assertEquals(MediaOrigin.AIMA, aima.getOrigin());
        assertEquals("https://fb.test/aima", aima.getPermalink(), "bài AIMA được bổ sung đường dẫn");
        PlatformMedia photo = media.get(f.pageId() + "_ext1");
        assertEquals(MediaOrigin.EXTERNAL, photo.getOrigin());
        assertNull(photo.getPost());
        assertEquals("IMAGE", photo.getMediaType());
        assertEquals("Bài tự đăng", photo.getCaptionExcerpt());
        assertEquals("https://fb.test/ext1", photo.getPermalink());
        assertNotNull(photo.getPublishedAt());
        assertEquals("TEXT", media.get(f.pageId() + "_ext2").getMediaType(), "không đính kèm = bài chữ");

        AccountSyncState state = state(f.accountId());
        assertEquals(0, state.getConsecutiveFailures());
        assertNull(state.getPostsErrorCode());
        assertNull(state.getInsightsErrorCode());
        assertNotNull(state.getLastSyncedAt());
        assertNear(Instant.now().plus(Duration.ofHours(1)), state.getNextSyncAt());
        assertEquals(InstagramLinkStatus.NOT_LINKED, state.getInstagramLinkStatus(), "Trang không có IG Business");
        assertNotNull(state.getWebhookSubscribedAt(), "Trang chưa đăng ký webhook → đăng ký trong lượt quét");
        assertNull(state.getWebhookErrorCode());

        Map<LocalDate, AccountInsightsDaily> days = insights(f.accountId());
        assertEquals(3L, days.get(today.minusDays(2)).getFollows());
        assertEquals(5L, days.get(today.minusDays(1)).getFollows());
        assertEquals(300L, days.get(today.minusDays(1)).getFollowersCount());
        assertEquals(321L, days.get(today).getFollowersCount(), "tổng người theo dõi hiện tại gắn vào hôm nay");
        assertNull(days.get(today).getFollows(), "không có số theo ngày ≠ 0");
        assertFalse(days.containsKey(today.plusDays(1)), "Meta trả thừa ngày sau khoảng hỏi → bỏ");

        // Lượt sau: Meta không trả follows của ngày đã có → GIỮ số cũ; danh sách bài trùng → không tạo thêm.
        META.setDispatcher(page(f, Map.of(
                "/published_posts", ok(publishedPosts(f)),
                "/insights", ok(insights(Map.of("page_follows", Map.of(today.minusDays(1), 302L)))),
                "followers_count", ok("{\"followers_count\":322}"),
                "instagram_business_account", ok("{\"instagram_business_account\":{\"id\":\"ig1\"},\"id\":\"x\"}"))));
        markDue(f.accountId());

        assertTrue(accountSyncService.sync(f.accountId()));

        assertEquals(3, media(f.accountId()).size());
        days = insights(f.accountId());
        assertEquals(5L, days.get(today.minusDays(1)).getFollows(), "metric vắng mặt không xoá số cũ");
        assertEquals(302L, days.get(today.minusDays(1)).getFollowersCount());
        assertEquals(322L, days.get(today).getFollowersCount());
        assertEquals(InstagramLinkStatus.LINKED, state(f.accountId()).getInstagramLinkStatus());
    }

    // ================================================================== lỗi

    @Test
    void sync_postsPermissionError_backsOff24h_butStillSavesInsights() {
        Fixture f = newPostedPost();
        LocalDate today = LocalDate.now(PublishingTime.LEGACY_ZONE);
        META.setDispatcher(page(f, Map.of(
                "/published_posts", graphError(200, null),
                "/insights", ok(insights(Map.of("page_daily_follows_unique", Map.of(today.minusDays(1), 2L)))),
                "followers_count", ok("{\"followers_count\":10}"),
                "instagram_business_account", ok("{\"id\":\"x\"}"))));

        assertTrue(accountSyncService.sync(f.accountId()));

        AccountSyncState state = state(f.accountId());
        assertEquals(1, state.getConsecutiveFailures());
        assertEquals("PERMISSION:200", state.getPostsErrorCode());
        assertNull(state.getLastSyncedAt());
        assertNear(Instant.now().plus(Duration.ofHours(24)), state.getNextSyncAt());
        assertEquals(2L, insights(f.accountId()).get(today.minusDays(1)).getFollows(), "insights vẫn được lưu");
    }

    @Test
    void sync_insightsMissingPermission_recordsInsightsErrorOnly() {
        Fixture f = newPostedPost();
        META.setDispatcher(page(f, Map.of(
                "/published_posts", ok("{\"data\":[]}"),
                "/insights", graphError(10, null),
                "followers_count", ok("{\"followers_count\":10}"),
                "instagram_business_account", ok("{\"id\":\"x\"}"))));

        assertTrue(accountSyncService.sync(f.accountId()));

        AccountSyncState state = state(f.accountId());
        assertEquals(0, state.getConsecutiveFailures());
        assertEquals("PERMISSION:10", state.getInsightsErrorCode());
        assertNotNull(state.getLastSyncedAt());
        assertNear(Instant.now().plus(Duration.ofHours(1)), state.getNextSyncAt());
    }

    @Test
    void sync_rateLimited_returnsFalseAndPausesOneHour() {
        Fixture f = newPostedPost();
        META.setDispatcher(page(f, Map.of("/published_posts", graphError(4, null))));

        assertFalse(accountSyncService.sync(f.accountId()), "rate limit → dừng cả lượt quét");

        AccountSyncState state = state(f.accountId());
        assertEquals(0, state.getConsecutiveFailures(), "rate limit không tính là lỗi");
        assertNear(Instant.now().plus(Duration.ofHours(1)), state.getNextSyncAt());
        assertTrue(insights(f.accountId()).isEmpty(), "không gọi tiếp insights");
    }

    @Test
    void findDue_onlyActivePagesWithoutFutureSchedule() {
        Fixture f = newPostedPost();
        assertTrue(accountSyncService.findDue(Instant.now(), 10_000).contains(f.accountId()), "chưa có trạng thái = đến hạn");

        transactionTemplate.executeWithoutResult(tx -> accountSyncService.disableForAccounts(
                List.of(accountRepository.findById(f.accountId()).orElseThrow())));
        assertFalse(accountSyncService.findDue(Instant.now(), 10_000).contains(f.accountId()), "kết nối mẫu không tự đồng bộ");
    }

    @Test
    void ensureWebhookSubscribed_missingPermission_recordsErrorAndRetriesLater() {
        Fixture f = newPostedPost();
        META.setDispatcher(page(f, Map.of("/subscribed_apps", graphError(200, null))));

        accountSyncService.ensureWebhookSubscribed(f.accountId());

        AccountSyncState state = state(f.accountId());
        assertNull(state.getWebhookSubscribedAt());
        assertEquals("PERMISSION:200", state.getWebhookErrorCode(), "thường là thiếu pages_manage_metadata");
        assertNotNull(state.getNextSyncAt(), "lượt quét kênh sau sẽ thử lại");

        META.setDispatcher(page(f, Map.of("/subscribed_apps", ok("{\"success\":true}"))));
        accountSyncService.ensureWebhookSubscribed(f.accountId());
        assertNotNull(state(f.accountId()).getWebhookSubscribedAt());
        assertNull(state(f.accountId()).getWebhookErrorCode());
    }

    // ================================================================== làm mới + nhận lại bài AIMA

    @Test
    void requestSync_marksSyncedAccountDueAgain() {
        Fixture f = newPostedPost();
        transactionTemplate.executeWithoutResult(tx -> {
            AccountSyncState state = postAnalyticsMapper.toSyncState(accountRepository.findById(f.accountId()).orElseThrow());
            state.setLastSyncedAt(Instant.now().minus(Duration.ofHours(1)));
            state.setNextSyncAt(Instant.now().plus(Duration.ofHours(5)));
            stateRepository.save(state);
        });

        assertEquals(1, accountSyncService.requestSync(f.userId()));
        assertTrue(accountSyncService.findDue(Instant.now().plusSeconds(1), 10_000).contains(f.accountId()));
    }

    @Test
    void prepare_adoptsExternalRowOfAimaPost_insteadOfCreatingDuplicate() {
        Fixture f = newPostedPost();
        // Lượt quét danh sách bài chạy trước khi bài AIMA kịp có dòng theo dõi → bị ghi nhận là "ngoài AIMA".
        transactionTemplate.executeWithoutResult(tx -> platformMediaRepository.save(postAnalyticsMapper.toExternalMedia(
                accountRepository.findById(f.accountId()).orElseThrow(),
                new PlatformMetricsProvider.PublishedPost(f.platformPostId(), Instant.now(), "https://fb.test/p", "TEXT", "x"))));

        syncService.prepare(1000);

        Map<String, PlatformMedia> media = media(f.accountId());
        assertEquals(1, media.size());
        PlatformMedia adopted = media.get(f.platformPostId());
        assertEquals(MediaOrigin.AIMA, adopted.getOrigin());
        assertEquals(f.postId(), transactionTemplate.execute(tx ->
                platformMediaRepository.findById(adopted.getId()).orElseThrow().getPost().getId()));
        assertEquals("https://fb.test/p", adopted.getPermalink(), "giữ thông tin đã quét");
    }

    // ================================================================== kết nối lại (ngắt rồi kết nối lại Facebook)

    @Test
    void adoptPreviousConnections_movesAimaHistoryToNewConnection_andMergesExternalDuplicate() {
        Fixture f = newPostedPost();
        syncService.prepare(1000);
        UUID aimaMediaId = transactionTemplate.execute(tx -> platformMediaRepository.findByPost_Id(f.postId()).orElseThrow().getId());
        snapshot(aimaMediaId, Instant.now().minus(Duration.ofHours(10)), 3L);
        snapshot(aimaMediaId, Instant.now().minus(Duration.ofHours(5)), 4L);

        // Ngắt kết nối (xoá mềm) rồi kết nối lại → dòng kết nối MỚI; lượt quét Trang đã kịp tạo bản "Ngoài AIMA" trùng ID.
        UUID newAccountId = transactionTemplate.execute(tx -> {
            PlatformAccount old = accountRepository.findById(f.accountId()).orElseThrow();
            old.setDeletedAt(java.time.LocalDateTime.now());
            PlatformAccount fresh = new PlatformAccount();
            fresh.setUser(old.getUser());
            fresh.setPlatformName(Platform.FACEBOOK);
            fresh.setPlatformAccountId(old.getPlatformAccountId());
            fresh.setAccountName(old.getAccountName());
            fresh.setAccountType(PlatformAccountType.PAGE);
            fresh.setTokenType(TokenType.PAGE_TOKEN);
            fresh.setAccessToken("new-token");
            fresh.setConnectionStatus(ConnectionStatus.ACTIVE);
            return accountRepository.save(fresh).getId();
        });
        UUID duplicateId = transactionTemplate.execute(tx -> platformMediaRepository.save(postAnalyticsMapper.toExternalMedia(
                accountRepository.findById(newAccountId).orElseThrow(),
                new PlatformMetricsProvider.PublishedPost(f.platformPostId(), Instant.now(), "https://fb.test/p", "TEXT", "x"))).getId());
        snapshot(duplicateId, Instant.now().minus(Duration.ofHours(1)), 6L);

        int adopted = transactionTemplate.execute(tx ->
                accountSyncService.adoptPreviousConnections(accountRepository.findById(newAccountId).orElseThrow()));

        assertEquals(1, adopted);
        transactionTemplate.executeWithoutResult(tx -> {
            PlatformMedia kept = platformMediaRepository.findById(aimaMediaId).orElseThrow();
            assertEquals(newAccountId, kept.getPlatformAccount().getId(), "lịch sử bài AIMA chuyển sang kết nối mới");
            assertEquals(MediaOrigin.AIMA, kept.getOrigin());
            assertNotNull(kept.getNextSyncAt());
            assertTrue(kept.getNextSyncAt().isBefore(Instant.now().plusSeconds(5)), "đồng bộ lại ngay để tính lại số theo ngày");
            assertNotNull(platformMediaRepository.findById(duplicateId).orElseThrow().getDeletedAt(), "bản Ngoài AIMA trùng bị gộp");
        });
        assertEquals(3, snapshotRepository.findByPlatformMedia_IdAndDeletedAtIsNullOrderByCollectedAtAsc(aimaMediaId).size(),
                "snapshot của bản trùng chuyển sang bản giữ lại");
        assertEquals(List.of(platformMediaRepository.findById(aimaMediaId).orElseThrow().getPlatformMediaId()),
                platformMediaRepository.findByPlatformAccount_IdAndDeletedAtIsNull(newAccountId).stream()
                        .map(PlatformMedia::getPlatformMediaId).toList(), "kết nối mới chỉ còn MỘT bản ghi của bài");

        Integer again = transactionTemplate.execute(tx ->
                accountSyncService.adoptPreviousConnections(accountRepository.findById(newAccountId).orElseThrow()));
        assertEquals(0, again, "chạy lại không làm gì");
    }

    private void snapshot(UUID mediaId, Instant at, Long reactions) {
        transactionTemplate.executeWithoutResult(tx -> {
            com.aima.entity.PostMetricSnapshot s = new com.aima.entity.PostMetricSnapshot();
            s.setPlatformMedia(platformMediaRepository.findById(mediaId).orElseThrow());
            s.setCollectedAt(at);
            s.setReactions(reactions);
            s.setSource(com.aima.enums.MetricSource.POLL);
            snapshotRepository.save(s);
        });
    }

    // ================================================================== fixture

    private Dispatcher page(Fixture f, Map<String, MockResponse> byPathPart) {
        return new Dispatcher() {
            @Override
            public MockResponse dispatch(RecordedRequest request) {
                String path = String.valueOf(request.getPath());
                return byPathPart.entrySet().stream().filter(e -> path.contains(e.getKey()))
                        .map(Map.Entry::getValue).findFirst()
                        .orElse(json(404, "{\"error\":{\"message\":\"unexpected " + path + "\",\"code\":1}}"));
            }
        };
    }

    private static String publishedPosts(Fixture f) {
        String created = GRAPH_TIME.format(Instant.now().minus(Duration.ofDays(2)).atZone(ZoneOffset.UTC));
        return "{\"data\":["
                + "{\"id\":\"" + f.platformPostId() + "\",\"created_time\":\"" + created + "\",\"permalink_url\":\"https://fb.test/aima\",\"message\":\"Xin chao\"},"
                + "{\"id\":\"" + f.pageId() + "_ext1\",\"created_time\":\"" + created + "\",\"permalink_url\":\"https://fb.test/ext1\","
                + "\"message\":\"Bài tự đăng\",\"attachments\":{\"data\":[{\"media_type\":\"photo\"}]}},"
                + "{\"id\":\"" + f.pageId() + "_ext2\",\"created_time\":\"" + created + "\",\"message\":\"Chỉ chữ\"}"
                + "],\"paging\":{\"cursors\":{\"before\":\"a\",\"after\":\"b\"}}}";
    }

    /** metric → (ngày Meta → giá trị); end_time = nửa đêm giờ Thái Bình Dương KẾT THÚC ngày đó. */
    private static String insights(Map<String, Map<LocalDate, Long>> metrics) {
        return metrics.entrySet().stream().map(m -> "{\"name\":\"" + m.getKey() + "\",\"period\":\"day\",\"values\":["
                        + m.getValue().entrySet().stream().map(v -> "{\"value\":" + v.getValue() + ",\"end_time\":\""
                                + GRAPH_TIME.format(v.getKey().plusDays(1).atStartOfDay(META_ZONE).withZoneSameInstant(ZoneOffset.UTC))
                                + "\"}").collect(Collectors.joining(","))
                        + "]}")
                .collect(Collectors.joining(",", "{\"data\":[", "]}"));
    }

    private Map<String, PlatformMedia> media(UUID accountId) {
        return platformMediaRepository.findAll().stream()
                .filter(m -> transactionTemplate.execute(tx ->
                        platformMediaRepository.findById(m.getId()).orElseThrow().getPlatformAccount().getId()).equals(accountId))
                .collect(Collectors.toMap(PlatformMedia::getPlatformMediaId, Function.identity()));
    }

    private AccountSyncState state(UUID accountId) {
        return stateRepository.findByPlatformAccount_IdAndDeletedAtIsNull(accountId).orElseThrow();
    }

    private Map<LocalDate, AccountInsightsDaily> insights(UUID accountId) {
        return insightsRepository.findAll().stream()
                .filter(i -> transactionTemplate.execute(tx ->
                        insightsRepository.findById(i.getId()).orElseThrow().getPlatformAccount().getId()).equals(accountId))
                .collect(Collectors.toMap(AccountInsightsDaily::getMetricDate, Function.identity()));
    }

    private void markDue(UUID accountId) {
        transactionTemplate.executeWithoutResult(tx -> {
            AccountSyncState state = stateRepository.findByPlatformAccount_IdAndDeletedAtIsNull(accountId).orElseThrow();
            state.setNextSyncAt(Instant.now());
        });
    }

    private static void assertNear(Instant expected, Instant actual) {
        assertNotNull(actual);
        assertTrue(Duration.between(expected, actual).abs().compareTo(Duration.ofMinutes(2)) < 0,
                "mong đợi ≈ " + expected + " nhưng là " + actual);
    }

    /** Trang FB + một bài AIMA đã POSTED 2 ngày trước. */
    private Fixture newPostedPost() {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "acc-sync-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Account Sync IT").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());

        BrandProfile brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Brand IT");
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
        version.setFormattedCaption("Xin chao AIMA");
        version.setMediaFormat("TEXT");
        version.setStatus(ContentVersionStatus.FORMATTED);
        version = contentVersionRepository.save(version);

        String pageId = "accpage" + Math.abs(UUID.randomUUID().getMostSignificantBits());
        PlatformAccount page = new PlatformAccount();
        page.setUser(user);
        page.setPlatformName(Platform.FACEBOOK);
        page.setPlatformAccountId(pageId);
        page.setAccountName("IT PAGE");
        page.setAccountType(PlatformAccountType.PAGE);
        page.setTokenType(TokenType.PAGE_TOKEN);
        page.setAccessToken("page-token-" + pageId);
        page.setConnectionStatus(ConnectionStatus.ACTIVE);
        page = accountRepository.save(page);

        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setPlatformAccount(page);
        schedule.setScheduledTime(Instant.now().minus(Duration.ofDays(2)));
        schedule.setStatus(ScheduleStatus.POSTED);
        schedule = scheduleRepository.save(schedule);

        String platformPostId = pageId + "_aima";
        Post post = new Post();
        post.setSchedule(schedule);
        post.setPlatformName(Platform.FACEBOOK);
        post.setStatus(PostStatus.POSTED);
        post.setPlatformPostId(platformPostId);
        post.setPublishedAt(Instant.now().minus(Duration.ofDays(2)));
        UUID postId = postRepository.save(post).getId();
        return new Fixture(user.getId(), page.getId(), pageId, postId, platformPostId);
    }

    private static MockResponse ok(String body) {
        return json(200, body);
    }

    private static MockResponse json(int status, String body) {
        return new MockResponse().setResponseCode(status).setHeader("Content-Type", "application/json").setBody(body);
    }

    private static MockResponse graphError(int code, Integer subcode) {
        String sub = subcode == null ? "" : ",\"error_subcode\":" + subcode;
        return json(400, "{\"error\":{\"message\":\"boom\",\"type\":\"OAuthException\",\"code\":" + code + sub + "}}");
    }
}
