package com.aima.service.Impl;

import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PlatformMedia;
import com.aima.entity.Post;
import com.aima.entity.PostAnalytics;
import com.aima.entity.PostMetricSnapshot;
import com.aima.entity.PostMetricsDaily;
import com.aima.entity.PostSchedule;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.MediaOrigin;
import com.aima.enums.MetricSource;
import com.aima.enums.MetricsErrorType;
import com.aima.enums.MetricsSyncStatus;
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
import com.aima.repository.PlatformMediaRepository;
import com.aima.repository.PostAnalyticsRepository;
import com.aima.repository.PostMetricSnapshotRepository;
import com.aima.repository.PostMetricsDailyRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AnalyticsSyncService;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
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
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Analytics giai đoạn 1: chuẩn bị (bài mới + chép mốc cũ) → đồng bộ qua adapter Facebook → snapshot + số theo
 * ngày + mốc 24/48/168h → lịch đồng bộ kế tiếp; cùng các nhánh lỗi (ngừng gọi lại vô hạn). Repository thật trên
 * H2, Meta giả bằng MockWebServer. Gọi thẳng {@code syncAccount} với bài của chính test vì H2 dùng chung giữa
 * các test class. SQL native của trang Phân tích (PostgreSQL) được kiểm ở {@code AnalyticsRealDataPgTest}.
 */
@SpringBootTest(properties = {
        "meta.app-secret-proof-enabled=false",
        "meta.response-timeout-seconds=5",
})
class AnalyticsSyncServiceIntegrationTest {

    static final MockWebServer META = new MockWebServer();

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

    @Autowired private AnalyticsSyncService syncService;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private BrandProfileRepository brandProfileRepository;
    @Autowired private ContentItemRepository contentItemRepository;
    @Autowired private ContentVersionRepository contentVersionRepository;
    @Autowired private PlatformAccountRepository accountRepository;
    @Autowired private PostScheduleRepository scheduleRepository;
    @Autowired private PostRepository postRepository;
    @Autowired private PostAnalyticsRepository postAnalyticsRepository;
    @Autowired private PlatformMediaRepository platformMediaRepository;
    @Autowired private PostMetricSnapshotRepository snapshotRepository;
    @Autowired private PostMetricsDailyRepository dailyRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private com.aima.mapper.PostAnalyticsMapper postAnalyticsMapper;

    record Fixture(UUID userId, UUID accountId, UUID postId) {
    }

    // ================================================================== chuẩn bị + thành công

    @Test
    void prepare_createsTrackingRowAndBackfillsLegacyMilestonesIntoSnapshotsAndDaily() {
        Fixture f = newPostedPost(Duration.ofDays(10));
        legacyMilestone(f.postId(), 24, null, 4L);   // views null như dữ liệu FB cũ
        legacyMilestone(f.postId(), 168, null, 9L);

        syncService.prepare(1000);

        PlatformMedia media = media(f.postId());
        assertEquals(MediaOrigin.AIMA, media.getOrigin());
        List<PostMetricSnapshot> snapshots = snapshots(media.getId());
        assertEquals(2, snapshots.size());
        assertTrue(snapshots.stream().allMatch(s -> s.getSource() == MetricSource.BACKFILL));
        assertEquals(9L, daily(media.getId()).stream().mapToLong(PostMetricsDaily::getReactionsDelta).sum(),
                "số theo ngày tính ngay từ snapshot chép sang — tổng = số tích luỹ cuối");
        assertEquals(2, postAnalyticsRepository.findByPost_IdAndDeletedAtIsNull(f.postId()).size(), "không đụng mốc cũ");
    }

    @Test
    void sync_success_savesSnapshotDailyMilestoneAndSchedulesNext() {
        Fixture f = newPostedPost(Duration.ofHours(25));
        UUID mediaId = trackedMedia(f.postId());
        assertTrue(isDue(mediaId, Instant.now()), "bài chưa đồng bộ lần nào luôn đến hạn");
        enqueueFacebook(12, 4, 2, 300);

        assertTrue(syncService.syncAccount(f.accountId(), List.of(mediaId)));

        List<PostMetricSnapshot> snapshots = snapshots(mediaId);
        assertEquals(1, snapshots.size());
        PostMetricSnapshot s = snapshots.getFirst();
        assertEquals(MetricSource.POLL, s.getSource());
        assertEquals(300L, s.getViews());
        assertEquals(12L, s.getReactions());
        assertEquals(4L, s.getComments());
        assertEquals(2L, s.getShares());
        assertNull(s.getReach());
        assertNotNull(s.getRaw());
        assertEquals(300L, daily(mediaId).stream().mapToLong(PostMetricsDaily::getViewsDelta).sum());

        List<PostAnalytics> milestones = postAnalyticsRepository.findByPost_IdAndDeletedAtIsNull(f.postId());
        assertEquals(List.of(24), milestones.stream().map(PostAnalytics::getMilestoneHours).toList(),
                "mốc 24h tính từ snapshot (đăng 25h trước) — chưa tới 48h");
        assertEquals(300L, milestones.getFirst().getViews());
        assertEquals(12L, milestones.getFirst().getLikes(), "likes của mốc = reactions");

        PlatformMedia media = media(f.postId());
        assertNotNull(media.getLastSyncedAt());
        assertEquals(0, media.getConsecutiveFailures());
        // Tuổi 25h → chu kỳ 6h (mốc 48h còn 23h nữa).
        Duration untilNext = Duration.between(Instant.now(), media.getNextSyncAt());
        assertTrue(untilNext.compareTo(Duration.ofHours(5)) > 0 && untilNext.compareTo(Duration.ofHours(7)) < 0, untilNext.toString());
        assertFalse(isDue(mediaId, Instant.now()));
    }

    @Test
    void sync_milestoneAlreadyInLegacyData_notDuplicated() {
        Fixture f = newPostedPost(Duration.ofHours(25));
        legacyMilestone(f.postId(), 24, null, 3L);
        syncService.prepare(1000); // chép mốc cũ sang snapshot
        UUID mediaId = media(f.postId()).getId();
        enqueueFacebook(5, 0, 0, 80);

        assertTrue(syncService.syncAccount(f.accountId(), List.of(mediaId)));

        assertEquals(1, postAnalyticsRepository.findByPost_IdAndDeletedAtIsNull(f.postId()).size());
        assertEquals(2, snapshots(mediaId).size(), "BACKFILL + POLL");
        assertEquals(5L, daily(mediaId).stream().mapToLong(PostMetricsDaily::getReactionsDelta).sum());
        assertEquals(80L, daily(mediaId).stream().mapToLong(PostMetricsDaily::getViewsDelta).sum(),
                "views cũ null → toàn bộ lượt xem rải từ giờ đăng");
    }

    @Test
    void oldPost_syncedOnceThenOutsideWindow() {
        Fixture f = newPostedPost(Duration.ofDays(100));
        UUID mediaId = trackedMedia(f.postId());
        assertTrue(isDue(mediaId, Instant.now()), "bài cũ chưa đồng bộ lần nào vẫn được đồng bộ lại một lần");
        enqueueFacebook(1, 1, 1, 10);

        assertTrue(syncService.syncAccount(f.accountId(), List.of(mediaId)));

        assertFalse(isDue(mediaId, Instant.now().plus(Duration.ofDays(30))), "quá 90 ngày thì thôi quét định kỳ");
    }

    @Test
    void requestSync_marksRecentlySyncedPostDueOnlyAfterMinimumGap() {
        Fixture f = newPostedPost(Duration.ofDays(2));
        UUID mediaId = trackedMedia(f.postId());
        transactionTemplate.executeWithoutResult(tx -> {
            PlatformMedia m = platformMediaRepository.findById(mediaId).orElseThrow();
            m.setLastSyncedAt(Instant.now().minus(Duration.ofMinutes(5)));
            m.setNextSyncAt(Instant.now().plus(Duration.ofHours(6)));
        });
        assertEquals(0, syncService.requestSync(f.userId()), "vừa đồng bộ 5 phút trước → bỏ qua");

        transactionTemplate.executeWithoutResult(tx ->
                platformMediaRepository.findById(mediaId).orElseThrow().setLastSyncedAt(Instant.now().minus(Duration.ofMinutes(20))));
        assertEquals(1, syncService.requestSync(f.userId()));
        assertTrue(isDue(mediaId, Instant.now().plusSeconds(1)));
    }

    // ================================================================== lỗi (giai đoạn 0, nay qua adapter)

    @Test
    void deletedPost_unavailableThenDeletedAndStopped() {
        Fixture f = newPostedPost(Duration.ofHours(25));
        UUID mediaId = trackedMedia(f.postId());
        META.enqueue(graphError(100, 33));
        assertTrue(syncService.syncAccount(f.accountId(), List.of(mediaId)));

        PlatformMedia first = media(f.postId());
        assertEquals(PlatformMediaStatus.UNAVAILABLE, first.getPlatformStatus());
        assertEquals("NOT_FOUND:100/33", first.getLastErrorCode());
        assertFalse(isDue(mediaId, Instant.now()));
        assertTrue(isDue(mediaId, Instant.now().plus(Duration.ofHours(25))));

        META.enqueue(graphError(100, 33));
        assertTrue(syncService.syncAccount(f.accountId(), List.of(mediaId)));

        PlatformMedia second = media(f.postId());
        assertEquals(PlatformMediaStatus.DELETED, second.getPlatformStatus());
        assertEquals(MetricsSyncStatus.STOPPED, second.getSyncStatus());
        assertFalse(isDue(mediaId, Instant.now().plus(Duration.ofDays(30))));
        transactionTemplate.executeWithoutResult(tx ->
                assertEquals(PostStatus.POSTED, postRepository.findById(f.postId()).orElseThrow().getStatus(),
                        "analytics không đổi trạng thái bài (D2)"));
    }

    @Test
    void missingPermission_retriesDaily() {
        Fixture f = newPostedPost(Duration.ofHours(25));
        UUID mediaId = trackedMedia(f.postId());
        META.enqueue(graphError(200, null));

        assertTrue(syncService.syncAccount(f.accountId(), List.of(mediaId)));

        PlatformMedia media = media(f.postId());
        assertEquals(1, media.getConsecutiveFailures());
        assertEquals("PERMISSION:200", media.getLastErrorCode());
        assertFalse(isDue(mediaId, Instant.now().plus(Duration.ofHours(23))));
        assertTrue(isDue(mediaId, Instant.now().plus(Duration.ofHours(25))));
    }

    @Test
    void rateLimited_returnsFalseAndPausesOneHourWithoutCountingFailure() {
        Fixture f = newPostedPost(Duration.ofHours(25));
        UUID mediaId = trackedMedia(f.postId());
        META.enqueue(graphError(80001, null));

        assertFalse(syncService.syncAccount(f.accountId(), List.of(mediaId)), "rate limit → job dừng cả lượt quét");

        PlatformMedia media = media(f.postId());
        assertEquals(0, media.getConsecutiveFailures());
        assertFalse(isDue(mediaId, Instant.now().plus(Duration.ofMinutes(50))));
        assertTrue(isDue(mediaId, Instant.now().plus(Duration.ofMinutes(70))));
    }

    @Test
    void temporaryErrors_stopAfterMaxConsecutiveFailures_successResets() {
        Fixture f = newPostedPost(Duration.ofHours(25));
        UUID mediaId = trackedMedia(f.postId());
        META.enqueue(new MockResponse().setResponseCode(503).setBody("down"));
        syncService.syncAccount(f.accountId(), List.of(mediaId));
        assertEquals(1, media(f.postId()).getConsecutiveFailures());

        enqueueFacebook(1, 0, 0, 5);
        syncService.syncAccount(f.accountId(), List.of(mediaId));
        assertEquals(0, media(f.postId()).getConsecutiveFailures(), "thành công thì reset đếm lỗi");

        for (int i = 1; i <= AnalyticsSyncServiceImpl.MAX_CONSECUTIVE_FAILURES; i++) {
            META.enqueue(new MockResponse().setResponseCode(503).setBody("down"));
            syncService.syncAccount(f.accountId(), List.of(mediaId));
        }
        PlatformMedia media = media(f.postId());
        assertEquals(MetricsSyncStatus.STOPPED, media.getSyncStatus());
        assertEquals("TEMPORARY:HTTP_503", media.getLastErrorCode());
    }

    // ================================================================== hàm thuần

    @Test
    void backoff_doublesHourlyUpToOneDay_permissionAndTokenWaitOneDay() {
        assertEquals(Duration.ofHours(1), AnalyticsSyncServiceImpl.backoff(MetricsErrorType.TEMPORARY, 1));
        assertEquals(Duration.ofHours(16), AnalyticsSyncServiceImpl.backoff(MetricsErrorType.TEMPORARY, 5));
        assertEquals(Duration.ofHours(24), AnalyticsSyncServiceImpl.backoff(MetricsErrorType.TEMPORARY, 40));
        assertEquals(Duration.ofHours(24), AnalyticsSyncServiceImpl.backoff(MetricsErrorType.PERMISSION, 1));
        assertEquals(Duration.ofHours(24), AnalyticsSyncServiceImpl.backoff(MetricsErrorType.TOKEN_INVALID, 1));
    }

    @Test
    void nextSyncAt_slowsDownWithAgeButHitsMilestones() {
        Instant published = Instant.parse("2026-10-01T00:00:00Z");
        // 1h tuổi: chu kỳ 2h.
        assertEquals(published.plus(Duration.ofHours(3)),
                AnalyticsSyncServiceImpl.nextSyncAt(published, published.plus(Duration.ofHours(1))));
        // 23h tuổi: chu kỳ 2h nhưng mốc 24h tới trước → ngay sau mốc.
        assertEquals(published.plus(Duration.ofHours(24)).plus(Duration.ofMinutes(1)),
                AnalyticsSyncServiceImpl.nextSyncAt(published, published.plus(Duration.ofHours(23))));
        // 10 ngày: mỗi ngày; 40 ngày: mỗi tuần.
        assertEquals(Duration.ofDays(1), Duration.between(published.plus(Duration.ofDays(10)),
                AnalyticsSyncServiceImpl.nextSyncAt(published, published.plus(Duration.ofDays(10)))));
        assertEquals(Duration.ofDays(7), Duration.between(published.plus(Duration.ofDays(40)),
                AnalyticsSyncServiceImpl.nextSyncAt(published, published.plus(Duration.ofDays(40)))));
    }

    @Test
    void nextSyncAt_adaptsToEngagementVelocity() {
        Instant published = Instant.parse("2026-10-01T00:00:00Z");
        Instant fiveDays = published.plus(Duration.ofDays(5)); // chu kỳ cơ bản 12h
        assertEquals(Duration.ofHours(6), Duration.between(fiveDays,
                AnalyticsSyncServiceImpl.nextSyncAt(published, fiveDays, 8.0)), "bài nóng → dày gấp đôi");
        assertEquals(Duration.ofHours(24), Duration.between(fiveDays,
                AnalyticsSyncServiceImpl.nextSyncAt(published, fiveDays, 0.0)), "bài nguội → giãn gấp đôi");
        assertEquals(Duration.ofHours(12), Duration.between(fiveDays,
                AnalyticsSyncServiceImpl.nextSyncAt(published, fiveDays, 1.0)), "bình thường → giữ lịch theo tuổi");
        assertEquals(Duration.ofHours(12), Duration.between(fiveDays,
                AnalyticsSyncServiceImpl.nextSyncAt(published, fiveDays, null)), "không biết tốc độ → lịch theo tuổi");

        Instant twoHours = published.plus(Duration.ofHours(2)); // chu kỳ cơ bản 2h
        assertEquals(Duration.ofHours(1), Duration.between(twoHours,
                AnalyticsSyncServiceImpl.nextSyncAt(published, twoHours, 50.0)), "không dày hơn 1 giờ");
        assertEquals(Duration.ofHours(2), Duration.between(twoHours,
                AnalyticsSyncServiceImpl.nextSyncAt(published, twoHours, 0.0)), "bài < 24h không giãn dù chưa có tương tác");

        Instant fortyDays = published.plus(Duration.ofDays(40)); // chu kỳ cơ bản 7 ngày
        assertEquals(Duration.ofDays(7), Duration.between(fortyDays,
                AnalyticsSyncServiceImpl.nextSyncAt(published, fortyDays, 0.0)), "giãn tối đa 7 ngày");

        // Vẫn ép mốc: bài nóng 22h tuổi (chu kỳ 1h → 23h) không bỏ lỡ; ở 23h30 lịch 1h vượt mốc → ép ngay sau mốc 24h.
        assertEquals(published.plus(Duration.ofHours(23)),
                AnalyticsSyncServiceImpl.nextSyncAt(published, published.plus(Duration.ofHours(22)), 9.0));
        assertEquals(published.plus(Duration.ofHours(24)).plus(Duration.ofMinutes(1)),
                AnalyticsSyncServiceImpl.nextSyncAt(published, published.plus(Duration.ofMinutes(23 * 60 + 30)), 9.0));
    }

    @Test
    void engagementPerHour_comparesWithPreviousSnapshot() {
        PostMetricSnapshot previous = new PostMetricSnapshot();
        previous.setCollectedAt(Instant.parse("2026-10-01T00:00:00Z"));
        previous.setReactions(10L);
        previous.setComments(2L);
        Instant now = Instant.parse("2026-10-01T02:00:00Z");

        assertEquals(5.0, AnalyticsSyncServiceImpl.engagementPerHour(previous,
                new com.aima.service.PlatformMetricsProvider.PostMetrics(null, null, 18L, 4L, 0L, null, null), now));
        assertNull(AnalyticsSyncServiceImpl.engagementPerHour(previous,
                new com.aima.service.PlatformMetricsProvider.PostMetrics(null, null, 18L, 4L, 0L, null, null),
                Instant.parse("2026-10-01T00:05:00Z")), "hai lần quá sát nhau → không đo");
        assertEquals(0.0, AnalyticsSyncServiceImpl.engagementPerHour(previous,
                new com.aima.service.PlatformMetricsProvider.PostMetrics(null, null, 9L, 2L, 0L, null, null), now),
                "bỏ thích làm số giảm → coi như 0, không âm");
    }

    // ================================================================== hỗ trợ

    private boolean isDue(UUID mediaId, Instant now) {
        return syncService.findDue(now, 100_000).values().stream().anyMatch(ids -> ids.contains(mediaId));
    }

    private PlatformMedia media(UUID postId) {
        return platformMediaRepository.findByPost_Id(postId).orElseThrow();
    }

    private UUID trackedMedia(UUID postId) {
        return transactionTemplate.execute(tx -> platformMediaRepository.findByPost_Id(postId).orElseGet(() ->
                platformMediaRepository.save(postAnalyticsMapper
                        .toPlatformMedia(postRepository.findForAnalytics(postId).orElseThrow())))).getId();
    }

    private List<PostMetricSnapshot> snapshots(UUID mediaId) {
        return snapshotRepository.findByPlatformMedia_IdAndDeletedAtIsNullOrderByCollectedAtAsc(mediaId);
    }

    private List<PostMetricsDaily> daily(UUID mediaId) {
        return dailyRepository.findByPlatformMedia_Id(mediaId);
    }

    private void legacyMilestone(UUID postId, int hours, Long views, Long likes) {
        transactionTemplate.executeWithoutResult(tx -> {
            Post post = postRepository.findById(postId).orElseThrow();
            PostAnalytics a = new PostAnalytics();
            a.setPost(post);
            a.setMilestoneHours(hours);
            a.setViews(views);
            a.setLikes(likes);
            a.setComments(0L);
            a.setShares(0L);
            a.setCollectedAt(post.getPublishedAt().plus(Duration.ofHours(hours)));
            postAnalyticsRepository.save(a);
        });
    }

    private static void enqueueFacebook(long reactions, long comments, long shares, long views) {
        META.enqueue(json(200, "{\"reactions\":{\"summary\":{\"total_count\":" + reactions + "}},"
                + "\"comments\":{\"summary\":{\"total_count\":" + comments + "}},\"shares\":{\"count\":" + shares + "}}"));
        META.enqueue(json(200, "{\"data\":[{\"name\":\"post_media_view\",\"values\":[{\"value\":" + views + "}]}]}"));
    }

    /** Bài FB Page đã POSTED cách đây {@code age}. */
    private Fixture newPostedPost(Duration age) {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "sync-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Sync IT").password("{noop}x")
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

        String pageId = "page" + Math.abs(UUID.randomUUID().getMostSignificantBits());
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
        schedule.setScheduledTime(Instant.now().minus(age));
        schedule.setStatus(ScheduleStatus.POSTED);
        schedule = scheduleRepository.save(schedule);

        Post post = new Post();
        post.setSchedule(schedule);
        post.setPlatformName(Platform.FACEBOOK);
        post.setStatus(PostStatus.POSTED);
        post.setPlatformPostId(pageId + "_" + Math.abs(UUID.randomUUID().getLeastSignificantBits()));
        post.setPublishedAt(Instant.now().minus(age));
        return new Fixture(user.getId(), page.getId(), postRepository.save(post).getId());
    }

    private static MockResponse json(int status, String body) {
        return new MockResponse().setResponseCode(status).setHeader("Content-Type", "application/json").setBody(body);
    }

    private static MockResponse graphError(int code, Integer subcode) {
        String sub = subcode == null ? "" : ",\"error_subcode\":" + subcode;
        return json(400, "{\"error\":{\"message\":\"boom\",\"type\":\"OAuthException\",\"code\":" + code + sub + "}}");
    }
}
