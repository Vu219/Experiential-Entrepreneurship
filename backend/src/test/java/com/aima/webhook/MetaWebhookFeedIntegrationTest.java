package com.aima.webhook;

import com.aima.entity.AccountSyncState;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.MetaWebhookEvent;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PlatformMedia;
import com.aima.entity.Post;
import com.aima.entity.PostMetricSnapshot;
import com.aima.entity.PostSchedule;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.MetricsSyncStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PlatformMediaStatus;
import com.aima.enums.PostStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.enums.WebhookEventStatus;
import com.aima.repository.AccountSyncStateRepository;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.MetaWebhookEventRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PlatformMediaRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AnalyticsSyncService;
import com.aima.service.MetaWebhookService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Analytics giai đoạn 3 — webhook Page "feed": chữ ký X-Hub-Signature-256, lưu + chống trùng, xử lý BẤT ĐỒNG BỘ (chờ
 * worker), và tác động: tương tác → đồng bộ bài sau ~5 phút; bài mới → quét Trang ngay; bài xoá → DELETED + dừng (bài
 * AIMA vẫn FAILED như SEC-06). Repository thật trên H2.
 */
@SpringBootTest(properties = {
        "meta.facebook.app-secret=" + MetaWebhookFeedIntegrationTest.APP_SECRET,
        "meta.app-secret-proof-enabled=false",
})
class MetaWebhookFeedIntegrationTest {

    static final String APP_SECRET = "webhook-test-secret";

    @Autowired private MetaWebhookService webhookService;
    @Autowired private MetaWebhookEventRepository eventRepository;
    @Autowired private AnalyticsSyncService syncService;
    @Autowired private PlatformMediaRepository platformMediaRepository;
    @Autowired private AccountSyncStateRepository stateRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private BrandProfileRepository brandProfileRepository;
    @Autowired private ContentItemRepository contentItemRepository;
    @Autowired private ContentVersionRepository contentVersionRepository;
    @Autowired private PlatformAccountRepository accountRepository;
    @Autowired private PostScheduleRepository scheduleRepository;
    @Autowired private PostRepository postRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private com.aima.repository.PostMetricSnapshotRepository snapshotRepository;
    @Autowired private com.aima.repository.NotificationRepository notificationRepository;
    @Autowired private com.aima.repository.SystemLogRepository systemLogRepository;

    record Fixture(UUID accountId, String pageId, UUID postId, String platformPostId) {
    }

    @Test
    void invalidSignature_storesNothing() {
        Fixture f = newTrackedPost();
        String body = feed(f.pageId(), "reaction", "add", f.platformPostId(), 1);
        long before = eventRepository.count();

        webhookService.handleEvent(body, "sha256=" + "0".repeat(64));
        webhookService.handleEvent(body, null);

        assertEquals(before, eventRepository.count(), "chữ ký sai / thiếu → không lưu, không xử lý");
    }

    @Test
    void reaction_schedulesSyncSoon_andDuplicateDeliveryIsIgnored() throws Exception {
        Fixture f = newTrackedPost();
        setNextSync(f.postId(), Instant.now().plus(Duration.ofDays(1)));
        String body = feed(f.pageId(), "reaction", "add", f.platformPostId(), 2);

        webhookService.handleEvent(body, sign(body));
        MetaWebhookEvent event = awaitProcessed(f.platformPostId(), "reaction");

        assertEquals(WebhookEventStatus.PROCESSED, event.getStatus());
        assertNear(Instant.now().plus(Duration.ofMinutes(5)), media(f.postId()).getNextSyncAt());

        long count = eventRepository.count();
        webhookService.handleEvent(body, sign(body)); // Meta gửi lại đúng payload
        assertEquals(count, eventRepository.count(), "chống trùng theo nội dung");
    }

    @Test
    void reaction_doesNotPostponeAnEarlierSchedule() throws Exception {
        Fixture f = newTrackedPost();
        Instant soon = Instant.now().plus(Duration.ofMinutes(1));
        setNextSync(f.postId(), soon);
        String body = feed(f.pageId(), "comment", "add", f.platformPostId(), 3);

        webhookService.handleEvent(body, sign(body));
        awaitProcessed(f.platformPostId(), "comment");

        assertNear(soon, media(f.postId()).getNextSyncAt());
    }

    @Test
    void postRemoved_marksDeletedOnPlatform_keepsPostStatusAndLastMetrics_noNotification() throws Exception {
        Fixture f = newTrackedPost();
        transactionTemplate.executeWithoutResult(tx -> {
            PostMetricSnapshot last = new PostMetricSnapshot();
            last.setPlatformMedia(platformMediaRepository.findByPost_Id(f.postId()).orElseThrow());
            last.setCollectedAt(Instant.now());
            last.setReactions(7L);
            last.setSource(com.aima.enums.MetricSource.POLL);
            snapshotRepository.save(last);
        });
        long notificationsBefore = notificationRepository.count();
        String body = feed(f.pageId(), "status", "remove", f.platformPostId(), 4);

        webhookService.handleEvent(body, sign(body));
        awaitProcessed(f.platformPostId(), "status");

        PlatformMedia media = media(f.postId());
        assertEquals(PlatformMediaStatus.DELETED, media.getPlatformStatus());
        assertEquals(MetricsSyncStatus.STOPPED, media.getSyncStatus());
        assertNull(media.getNextSyncAt());
        assertEquals(PostStatus.POSTED, postRepository.findById(f.postId()).orElseThrow().getStatus(),
                "không đánh FAILED — Meta không cho biết bị gỡ hay tự xoá");
        assertEquals(notificationsBefore, notificationRepository.count(), "không gửi thông báo \"bị nền tảng gỡ\"");
        assertEquals(1, snapshotRepository.findByPlatformMedia_IdAndDeletedAtIsNullOrderByCollectedAtAsc(media.getId()).size(),
                "giữ số liệu cuối cùng đã thu");
    }

    @Test
    void dashboardTestEvent_pageIdZero_isStoredIgnored_withoutTouchingAnything() throws Exception {
        long logsBefore = systemLogRepository.count();
        long notificationsBefore = notificationRepository.count();
        // Payload mẫu nút "Test" của App Dashboard: entry.id = "0", post_id giả.
        String body = "{\"object\":\"page\",\"entry\":[{\"id\":\"0\",\"time\":" + (Instant.now().getEpochSecond() + 7)
                + ",\"changes\":[{\"field\":\"feed\",\"value\":{\"item\":\"status\",\"post_id\":\"44444444_444444444\","
                + "\"verb\":\"remove\",\"published\":1,\"message\":\"Example post content.\"}}]}]}";

        webhookService.handleEvent(body, sign(body));

        MetaWebhookEvent event = eventRepository.findAll().stream()
                .filter(e -> "44444444_444444444".equals(e.getPlatformPostId())).findFirst().orElseThrow();
        assertEquals(WebhookEventStatus.IGNORED, event.getStatus(), "lưu lại để biết webhook đã thông, nhưng không xử lý");
        assertEquals(0, event.getAttempts());
        assertNull(event.getLastError());
        assertEquals(logsBefore, systemLogRepository.count(), "không ghi log hệ thống gây nhiễu");
        assertEquals(notificationsBefore, notificationRepository.count());
    }

    @Test
    void newPostOnPage_marksPageAccountDueNow() throws Exception {
        Fixture f = newTrackedPost();
        String body = feed(f.pageId(), "status", "add", f.pageId() + "_new", 5);

        webhookService.handleEvent(body, sign(body));
        awaitProcessed(f.pageId() + "_new", "status");

        AccountSyncState state = stateRepository.findByPlatformAccount_IdAndDeletedAtIsNull(f.accountId()).orElseThrow();
        assertNear(Instant.now(), state.getNextSyncAt());
    }

    @Test
    void unknownPost_isIgnored() throws Exception {
        String body = feed("nopage", "reaction", "add", "nopage_1", 6);

        webhookService.handleEvent(body, sign(body));

        assertEquals(WebhookEventStatus.IGNORED, awaitProcessed("nopage_1", "reaction").getStatus());
    }

    // ================================================================== helpers

    /** Payload feed của Meta; {@code salt} làm entry.time khác nhau giữa các test (khoá chống trùng). */
    private static String feed(String pageId, String item, String verb, String postId, int salt) {
        long time = Instant.now().getEpochSecond() + salt;
        return "{\"object\":\"page\",\"entry\":[{\"id\":\"" + pageId + "\",\"time\":" + time + ",\"changes\":[{\"field\":\"feed\","
                + "\"value\":{\"item\":\"" + item + "\",\"verb\":\"" + verb + "\",\"post_id\":\"" + postId + "\","
                + "\"from\":{\"id\":\"1\",\"name\":\"Viewer\"},\"created_time\":" + time + "}}]}]}";
    }

    private static String sign(String body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(APP_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
    }

    /** Worker chạy trên executor riêng → chờ sự kiện rời PENDING (tối đa 10 giây). */
    private MetaWebhookEvent awaitProcessed(String platformPostId, String item) throws InterruptedException {
        for (int i = 0; i < 100; i++) {
            List<MetaWebhookEvent> events = eventRepository.findAll().stream()
                    .filter(e -> platformPostId.equals(e.getPlatformPostId()) && item.equals(e.getItem())).toList();
            if (!events.isEmpty() && events.stream().allMatch(e -> e.getStatus() != WebhookEventStatus.PENDING)) {
                return events.getFirst();
            }
            Thread.sleep(100);
        }
        fail("sự kiện " + item + " của " + platformPostId + " chưa được xử lý");
        return null;
    }

    private PlatformMedia media(UUID postId) {
        return platformMediaRepository.findByPost_Id(postId).orElseThrow();
    }

    private void setNextSync(UUID postId, Instant at) {
        transactionTemplate.executeWithoutResult(tx -> platformMediaRepository.findByPost_Id(postId).orElseThrow().setNextSyncAt(at));
    }

    private static void assertNear(Instant expected, Instant actual) {
        assertNotNull(actual);
        assertTrue(Duration.between(expected, actual).abs().compareTo(Duration.ofMinutes(1)) < 0,
                "mong đợi ≈ " + expected + " nhưng là " + actual);
    }

    /** Trang FB + bài AIMA đã POSTED, đã có dòng theo dõi số liệu. */
    private Fixture newTrackedPost() {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "webhook-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Webhook IT").password("{noop}x")
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
        version.setFormattedCaption("Xin chao");
        version.setMediaFormat("TEXT");
        version.setStatus(ContentVersionStatus.FORMATTED);
        version = contentVersionRepository.save(version);

        String pageId = "whpage" + Math.abs(UUID.randomUUID().getMostSignificantBits());
        PlatformAccount page = new PlatformAccount();
        page.setUser(user);
        page.setPlatformName(Platform.FACEBOOK);
        page.setPlatformAccountId(pageId);
        page.setAccountName("WH PAGE");
        page.setAccountType(PlatformAccountType.PAGE);
        page.setTokenType(TokenType.PAGE_TOKEN);
        page.setAccessToken("page-token-" + pageId);
        page.setConnectionStatus(ConnectionStatus.ACTIVE);
        page = accountRepository.save(page);

        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setPlatformAccount(page);
        schedule.setScheduledTime(Instant.now().minus(Duration.ofHours(3)));
        schedule.setStatus(ScheduleStatus.POSTED);
        schedule = scheduleRepository.save(schedule);

        String platformPostId = pageId + "_1";
        Post post = new Post();
        post.setSchedule(schedule);
        post.setPlatformName(Platform.FACEBOOK);
        post.setStatus(PostStatus.POSTED);
        post.setPlatformPostId(platformPostId);
        post.setPublishedAt(Instant.now().minus(Duration.ofHours(3)));
        UUID postId = postRepository.save(post).getId();
        syncService.prepare(1000);
        return new Fixture(page.getId(), pageId, postId, platformPostId);
    }
}
