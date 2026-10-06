package com.aima.scheduler;

import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PlatformMedia;
import com.aima.entity.Post;
import com.aima.entity.PostAnalytics;
import com.aima.entity.PostSchedule;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.MediaOrigin;
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
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.util.AopTestUtils;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Giai đoạn 0 analytics dữ liệu thật: job thu số liệu ghi trạng thái lỗi vào {@code platform_media} và NGỪNG
 * gọi lại vô hạn bài đã xoá / thiếu quyền / bị rate limit. Repository thật trên H2, Meta giả bằng MockWebServer.
 * Gọi thẳng {@code collect} (không qua {@code run}) vì H2 dùng chung giữa các test class — {@code run} sẽ quét cả
 * bài của test khác.
 */
@SpringBootTest(properties = {
        "meta.app-secret-proof-enabled=false",
        "meta.response-timeout-seconds=5",
})
class AnalyticsCollectionJobIntegrationTest {

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

    @Autowired private AnalyticsCollectionJob jobBean;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private BrandProfileRepository brandProfileRepository;
    @Autowired private ContentItemRepository contentItemRepository;
    @Autowired private ContentVersionRepository contentVersionRepository;
    @Autowired private PlatformAccountRepository accountRepository;
    @Autowired private PostScheduleRepository scheduleRepository;
    @Autowired private PostRepository postRepository;
    @Autowired private PlatformMediaRepository platformMediaRepository;
    @Autowired private TransactionTemplate transactionTemplate;

    private AnalyticsCollectionJob job;

    @BeforeEach
    void unwrapProxy() {
        job = AopTestUtils.getTargetObject(jobBean); // bỏ proxy ShedLock để gọi method package-private
    }

    // ================================================================== các case

    @Test
    void success_savesReactionsAndViews_createsActiveMediaRow() {
        UUID postId = newPostedPost();
        META.enqueue(json(200, "{\"reactions\":{\"summary\":{\"total_count\":12}},"
                + "\"comments\":{\"summary\":{\"total_count\":4}},\"shares\":{\"count\":2}}"));
        META.enqueue(json(200, "{\"data\":[{\"name\":\"post_media_view\",\"values\":[{\"value\":300}]}]}"));

        assertTrue(job.collect(postId, 24));

        transactionTemplate.executeWithoutResult(tx -> {
            List<PostAnalytics> snapshots = postRepository.findById(postId).orElseThrow().getPostAnalytics();
            assertEquals(1, snapshots.size());
            PostAnalytics a = snapshots.getFirst();
            assertEquals(24, a.getMilestoneHours());
            assertEquals(300L, a.getViews());
            assertEquals(12L, a.getLikes());
            assertEquals(4L, a.getComments());
            assertEquals(2L, a.getShares());
        });
        PlatformMedia media = media(postId);
        assertEquals(MediaOrigin.AIMA, media.getOrigin());
        assertEquals(PlatformMediaStatus.ACTIVE, media.getPlatformStatus());
        assertEquals(MetricsSyncStatus.ACTIVE, media.getSyncStatus());
        assertEquals(0, media.getConsecutiveFailures());
        assertNotNull(media.getLastSyncedAt());
        assertNull(media.getNextSyncAt());
    }

    @Test
    void deletedPost_unavailableThenDeletedAndStopped_neverDueAgain() {
        UUID postId = newPostedPost();
        META.enqueue(graphError(100, 33));
        assertTrue(job.collect(postId, 24));

        PlatformMedia first = media(postId);
        assertEquals(PlatformMediaStatus.UNAVAILABLE, first.getPlatformStatus());
        assertEquals(MetricsSyncStatus.ACTIVE, first.getSyncStatus());
        assertEquals("NOT_FOUND:100/33", first.getLastErrorCode());
        assertFalse(isDue(postId, Instant.now()), "chờ 24h mới xác nhận lại");
        assertTrue(isDue(postId, Instant.now().plus(Duration.ofHours(25))));

        META.enqueue(graphError(100, 33));
        assertTrue(job.collect(postId, 24));

        PlatformMedia second = media(postId);
        assertEquals(PlatformMediaStatus.DELETED, second.getPlatformStatus());
        assertEquals(MetricsSyncStatus.STOPPED, second.getSyncStatus());
        assertFalse(isDue(postId, Instant.now().plus(Duration.ofDays(30))), "bài đã xoá không bao giờ quét lại");
        transactionTemplate.executeWithoutResult(tx ->
                assertEquals(PostStatus.POSTED, postRepository.findById(postId).orElseThrow().getStatus(),
                        "analytics không đổi trạng thái bài (D2)"));
    }

    @Test
    void missingPermission_retriesDailyInsteadOfHourly() {
        UUID postId = newPostedPost();
        META.enqueue(graphError(200, null));

        assertTrue(job.collect(postId, 24));

        PlatformMedia media = media(postId);
        assertEquals(1, media.getConsecutiveFailures());
        assertEquals("PERMISSION:200", media.getLastErrorCode());
        assertFalse(isDue(postId, Instant.now().plus(Duration.ofHours(23))));
        assertTrue(isDue(postId, Instant.now().plus(Duration.ofHours(25))));
    }

    @Test
    void rateLimited_stopsRunAndPausesOneHourWithoutCountingFailure() {
        UUID postId = newPostedPost();
        META.enqueue(graphError(80001, null));

        assertFalse(job.collect(postId, 24), "rate limit → run() phải dừng cả lượt quét");

        PlatformMedia media = media(postId);
        assertEquals(0, media.getConsecutiveFailures());
        assertEquals(MetricsSyncStatus.ACTIVE, media.getSyncStatus());
        assertFalse(isDue(postId, Instant.now().plus(Duration.ofMinutes(50))));
        assertTrue(isDue(postId, Instant.now().plus(Duration.ofMinutes(70))));
    }

    @Test
    void temporaryErrors_backOffThenStopAfterMaxConsecutiveFailures() {
        UUID postId = newPostedPost();
        for (int i = 1; i <= AnalyticsCollectionJob.MAX_CONSECUTIVE_FAILURES; i++) {
            META.enqueue(new MockResponse().setResponseCode(503).setBody("down"));
            assertTrue(job.collect(postId, 24));
            assertEquals(i, media(postId).getConsecutiveFailures());
        }
        PlatformMedia media = media(postId);
        assertEquals(MetricsSyncStatus.STOPPED, media.getSyncStatus());
        assertEquals("TEMPORARY:HTTP_503", media.getLastErrorCode());
        assertFalse(isDue(postId, Instant.now().plus(Duration.ofDays(30))));
    }

    @Test
    void successAfterFailure_resetsFailureCountAndUnavailableFlag() {
        UUID postId = newPostedPost();
        META.enqueue(graphError(100, 33));
        job.collect(postId, 24);
        META.enqueue(json(200, "{\"reactions\":{\"summary\":{\"total_count\":1}}}"));
        META.enqueue(json(200, "{\"data\":[{\"name\":\"post_media_view\",\"values\":[{\"value\":9}]}]}"));

        assertTrue(job.collect(postId, 24));

        PlatformMedia media = media(postId);
        assertEquals(PlatformMediaStatus.ACTIVE, media.getPlatformStatus());
        assertEquals(0, media.getConsecutiveFailures());
        assertNull(media.getNextSyncAt());
    }

    @Test
    void backoff_doublesHourlyUpToOneDay_permissionAndTokenWaitOneDay() {
        assertEquals(Duration.ofHours(1), AnalyticsCollectionJob.backoff(MetricsErrorType.TEMPORARY, 1));
        assertEquals(Duration.ofHours(2), AnalyticsCollectionJob.backoff(MetricsErrorType.TEMPORARY, 2));
        assertEquals(Duration.ofHours(16), AnalyticsCollectionJob.backoff(MetricsErrorType.TEMPORARY, 5));
        assertEquals(Duration.ofHours(24), AnalyticsCollectionJob.backoff(MetricsErrorType.TEMPORARY, 6));
        assertEquals(Duration.ofHours(24), AnalyticsCollectionJob.backoff(MetricsErrorType.TEMPORARY, 40));
        assertEquals(Duration.ofHours(24), AnalyticsCollectionJob.backoff(MetricsErrorType.PERMISSION, 1));
        assertEquals(Duration.ofHours(24), AnalyticsCollectionJob.backoff(MetricsErrorType.TOKEN_INVALID, 1));
    }

    // ================================================================== hỗ trợ

    private boolean isDue(UUID postId, Instant now) {
        return postRepository.findDueForAnalytics(24, now.minus(Duration.ofHours(24)), now).contains(postId);
    }

    private PlatformMedia media(UUID postId) {
        return platformMediaRepository.findByPost_Id(postId).orElseThrow();
    }

    /** Bài FB Page đã POSTED 25 giờ trước — đến hạn mốc 24h. */
    private UUID newPostedPost() {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "analytics-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Analytics IT").password("{noop}x")
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
        schedule.setScheduledTime(Instant.now().minus(Duration.ofHours(25)));
        schedule.setStatus(ScheduleStatus.POSTED);
        schedule = scheduleRepository.save(schedule);

        Post post = new Post();
        post.setSchedule(schedule);
        post.setPlatformName(Platform.FACEBOOK);
        post.setStatus(PostStatus.POSTED);
        post.setPlatformPostId(pageId + "_" + Math.abs(UUID.randomUUID().getLeastSignificantBits()));
        post.setPublishedAt(Instant.now().minus(Duration.ofHours(25)));
        return postRepository.save(post).getId();
    }

    private static MockResponse json(int status, String body) {
        return new MockResponse().setResponseCode(status).setHeader("Content-Type", "application/json").setBody(body);
    }

    private static MockResponse graphError(int code, Integer subcode) {
        String sub = subcode == null ? "" : ",\"error_subcode\":" + subcode;
        return json(400, "{\"error\":{\"message\":\"boom\",\"type\":\"OAuthException\",\"code\":" + code + sub + "}}");
    }
}
