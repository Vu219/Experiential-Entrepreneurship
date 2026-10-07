package com.aima.connection;

import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostingJob;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.PostingJobRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.PlatformConnectionService;
import com.aima.service.PostPublishWorkerService;
import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.core.SimpleLock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tích hợp (H2 + security thật) cho phần Meta: 2 callback public, webhook ký chữ ký, claim lịch
 * chống đăng trùng, vớt job kẹt RUNNING và ShedLock. Dựng đủ chuỗi entity thật
 * (User → Brand → Item → Version → PlatformAccount → Schedule).
 */
@SpringBootTest(properties = {
        "meta.facebook.app-secret=" + MetaIntegrationTest.APP_SECRET,
        "app.frontend.base-url=https://aima-marketing.id.vn",
})
class MetaIntegrationTest {

    static final String APP_SECRET = "it-app-secret";

    @Autowired private WebApplicationContext webApplicationContext;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private BrandProfileRepository brandProfileRepository;
    @Autowired private ContentItemRepository contentItemRepository;
    @Autowired private ContentVersionRepository contentVersionRepository;
    @Autowired private PlatformAccountRepository accountRepository;
    @Autowired private PostScheduleRepository scheduleRepository;
    @Autowired private PostRepository postRepository;
    @Autowired private PostingJobRepository jobRepository;
    @Autowired private PostPublishWorkerService postPublishWorkerService;
    @Autowired private PlatformConnectionService connectionService;
    @Autowired private LockProvider lockProvider;
    @Autowired private TransactionTemplate transactionTemplate;

    private MockMvc mockMvc;

    @BeforeEach
    void setUpMockMvc() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
    }

    // ================================================================== dựng dữ liệu

    private record Graph(User user, PlatformAccount root, PlatformAccount page, PostSchedule schedule) {
    }

    /** Kết nối FB gốc + 1 Page con có 1 lịch SCHEDULED (giờ đăng ở tương lai — dispatcher thật không đụng tới). */
    private Graph newGraph(String fbUserId) {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "meta-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Meta IT").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());

        BrandProfile brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Brand IT");
        brand.setIndustry("Beauty");
        brand.setTargetAudience("Everyone");
        brand = brandProfileRepository.save(brand);

        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.applyResolvedStatus(ContentItemStatus.SCHEDULED);
        item = contentItemRepository.save(item);

        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(Platform.FACEBOOK);
        version.setStatus(ContentVersionStatus.FORMATTED);
        version = contentVersionRepository.save(version);

        PlatformAccount root = accountRepository.save(account(user, fbUserId, PlatformAccountType.USER, null));
        PlatformAccount page = accountRepository.save(account(user, "page-" + UUID.randomUUID(), PlatformAccountType.PAGE, root));

        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setPlatformAccount(page);
        schedule.setScheduledTime(java.time.Instant.now().plus(java.time.Duration.ofDays(3)));
        schedule.setStatus(ScheduleStatus.SCHEDULED);
        schedule = scheduleRepository.save(schedule);
        return new Graph(user, root, page, schedule);
    }

    private static PlatformAccount account(User user, String platformId, PlatformAccountType type, PlatformAccount parent) {
        PlatformAccount a = new PlatformAccount();
        a.setUser(user);
        a.setPlatformName(Platform.FACEBOOK);
        a.setPlatformAccountId(platformId);
        a.setAccountName("IT " + type);
        a.setAccountType(type);
        a.setTokenType(type == PlatformAccountType.PAGE ? TokenType.PAGE_TOKEN : TokenType.LONG_LIVED_USER_TOKEN);
        a.setAccessToken("real-token-" + platformId);
        a.setConnectionStatus(ConnectionStatus.ACTIVE);
        a.setParentConnection(parent);
        return a;
    }

    private Post newPost(PostSchedule schedule, String platformPostId, PostStatus status) {
        Post p = new Post();
        p.setSchedule(schedule);
        p.setPlatformName(Platform.FACEBOOK);
        p.setPlatformPostId(platformPostId);
        p.setStatus(status);
        return postRepository.save(p);
    }

    private static String hmacHex(String body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(APP_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
    }

    // ================================================================== disconnect

    // Gọi thẳng service NGOÀI mọi transaction/request (prod tắt open-in-view): trước đây
    // account.getUser().getEmail() trên entity detached ném LazyInitializationException.
    @Test
    void disconnect_expiredToken_succeedsWithoutLazyInitAndHoldsSchedules() {
        Graph g = newGraph("fb-" + UUID.randomUUID());
        PlatformAccount root = accountRepository.findById(g.root().getId()).orElseThrow();
        root.setTokenExpiredAt(LocalDateTime.now().minusDays(1));
        accountRepository.save(root);

        assertDoesNotThrow(() -> connectionService.disconnect(g.root().getId(), g.user().getEmail()));

        for (UUID id : List.of(g.root().getId(), g.page().getId())) {
            PlatformAccount a = accountRepository.findById(id).orElseThrow();
            assertNotNull(a.getDeletedAt());
            assertEquals(ConnectionStatus.DISCONNECTED, a.getConnectionStatus());
            assertEquals("", a.getAccessToken());
        }
        assertEquals(ScheduleStatus.ON_HOLD, scheduleRepository.findById(g.schedule().getId()).orElseThrow().getStatus());
    }

    // ================================================================== callbacks

    @Test
    void dataDeletionCallback_isPublic_deletesConnectionsAndReturnsMetaBody() throws Exception {
        String fbUserId = "fb-" + UUID.randomUUID();
        Graph g = newGraph(fbUserId);
        String signed = MetaSignedRequestTest.sign(
                "{\"algorithm\":\"HMAC-SHA256\",\"issued_at\":1727400000,\"user_id\":\"" + fbUserId + "\"}", APP_SECRET);

        MvcResult result = mockMvc.perform(post("/meta/data-deletion")
                        .contentType("application/x-www-form-urlencoded")
                        .param("signed_request", signed))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").exists())
                .andExpect(jsonPath("$.confirmation_code").exists())
                .andExpect(jsonPath("$.result").doesNotExist()) // KHÔNG bọc ApiResponse
                .andReturn();
        String body = result.getResponse().getContentAsString();
        String code = body.replaceAll(".*\"confirmation_code\"\\s*:\\s*\"([^\"]+)\".*", "$1");
        assertTrue(body.contains("https://aima-marketing.id.vn/data-deletion?code=" + code), body);

        PlatformAccount root = accountRepository.findById(g.root().getId()).orElseThrow();
        PlatformAccount page = accountRepository.findById(g.page().getId()).orElseThrow();
        assertNotNull(root.getDeletedAt());
        assertNotNull(page.getDeletedAt());
        assertEquals("", page.getAccessToken(), "token phải bị xoá khỏi DB");
        assertEquals(ScheduleStatus.ON_HOLD, scheduleRepository.findById(g.schedule().getId()).orElseThrow().getStatus());

        mockMvc.perform(get("/meta/data-deletion/" + code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.status").value("COMPLETED"))
                .andExpect(jsonPath("$.result.connectionsRemoved").value(2))
                .andExpect(jsonPath("$.result.schedulesHeld").value(1));
        mockMvc.perform(get("/meta/data-deletion/unknown-code")).andExpect(status().isNotFound());
    }

    @Test
    void dataDeletionCallback_forgedSignature_rejectedAndNothingDeleted() throws Exception {
        String fbUserId = "fb-" + UUID.randomUUID();
        Graph g = newGraph(fbUserId);
        String forged = MetaSignedRequestTest.sign(
                "{\"algorithm\":\"HMAC-SHA256\",\"user_id\":\"" + fbUserId + "\"}", "attacker-secret");

        mockMvc.perform(post("/meta/data-deletion")
                        .contentType("application/x-www-form-urlencoded")
                        .param("signed_request", forged))
                .andExpect(status().isBadRequest());

        assertNull(accountRepository.findById(g.root().getId()).orElseThrow().getDeletedAt());
        assertEquals(ScheduleStatus.SCHEDULED, scheduleRepository.findById(g.schedule().getId()).orElseThrow().getStatus());
    }

    @Test
    void deauthorizeCallback_isPublic_marksRevokedAndHoldsSchedules() throws Exception {
        String fbUserId = "fb-" + UUID.randomUUID();
        Graph g = newGraph(fbUserId);
        String signed = MetaSignedRequestTest.sign(
                "{\"algorithm\":\"HMAC-SHA256\",\"user_id\":\"" + fbUserId + "\"}", APP_SECRET);

        mockMvc.perform(post("/meta/deauthorize")
                        .contentType("application/x-www-form-urlencoded")
                        .param("signed_request", signed))
                .andExpect(status().isOk());

        PlatformAccount page = accountRepository.findById(g.page().getId()).orElseThrow();
        assertEquals(ConnectionStatus.REVOKED, page.getConnectionStatus());
        assertNull(page.getDeletedAt());
        assertEquals(ScheduleStatus.ON_HOLD, scheduleRepository.findById(g.schedule().getId()).orElseThrow().getStatus());
    }

    // ================================================================== webhook

    @Test
    void webhook_requiresValidSignature_andNeverFailsTheAimaPost() throws Exception {
        Graph g = newGraph("fb-" + UUID.randomUUID());
        String postId = "123_" + UUID.randomUUID();
        Post post = newPost(g.schedule(), postId, PostStatus.POSTED);
        String removeStatus = "{\"entry\":[{\"changes\":[{\"field\":\"feed\",\"value\":"
                + "{\"item\":\"status\",\"verb\":\"remove\",\"post_id\":\"" + postId + "\"}}]}]}";
        String removeComment = "{\"entry\":[{\"changes\":[{\"field\":\"feed\",\"value\":"
                + "{\"item\":\"comment\",\"verb\":\"remove\",\"post_id\":\"" + postId + "\"}}]}]}";

        // 1) Không có chữ ký → bỏ qua (trước đây được chấp nhận).
        mockMvc.perform(post("/webhooks/meta").contentType("application/json").content(removeStatus))
                .andExpect(status().isOk());
        assertEquals(PostStatus.POSTED, postRepository.findById(post.getId()).orElseThrow().getStatus());

        // 2) Chữ ký sai → bỏ qua.
        mockMvc.perform(post("/webhooks/meta").contentType("application/json").content(removeStatus)
                        .header("X-Hub-Signature-256", "sha256=" + "0".repeat(64)))
                .andExpect(status().isOk());
        assertEquals(PostStatus.POSTED, postRepository.findById(post.getId()).orElseThrow().getStatus());

        // 3) Chữ ký đúng nhưng chỉ là xoá COMMENT → bài vẫn còn.
        mockMvc.perform(post("/webhooks/meta").contentType("application/json").content(removeComment)
                        .header("X-Hub-Signature-256", "sha256=" + hmacHex(removeComment)))
                .andExpect(status().isOk());
        assertEquals(PostStatus.POSTED, postRepository.findById(post.getId()).orElseThrow().getStatus());

        // 4) Chữ ký đúng + bài bị xoá trên nền tảng → từ 07/10 KHÔNG đánh FAILED (webhook không phân biệt Meta gỡ hay người
        //    dùng tự xoá); chỉ dòng theo dõi số liệu thành "Đã xoá trên nền tảng" — kiểm ở MetaWebhookFeedIntegrationTest.
        mockMvc.perform(post("/webhooks/meta").contentType("application/json").content(removeStatus)
                        .header("X-Hub-Signature-256", "sha256=" + hmacHex(removeStatus)))
                .andExpect(status().isOk());
        Thread.sleep(1500); // worker chạy nền
        assertEquals(PostStatus.POSTED, postRepository.findById(post.getId()).orElseThrow().getStatus());
    }

    // ================================================================== chống đăng trùng / job kẹt

    @Test
    void claimForPosting_onlyFirstClaimWins() {
        Graph g = newGraph("fb-" + UUID.randomUUID());

        // Cùng ngữ cảnh như PostingDispatchJob.createPostAndJob: mỗi claim trong transaction riêng.
        int first = transactionTemplate.execute(tx -> scheduleRepository.claimForPosting(g.schedule().getId()));
        int second = transactionTemplate.execute(tx -> scheduleRepository.claimForPosting(g.schedule().getId()));

        assertEquals(1, first);
        assertEquals(0, second, "instance thứ hai không được claim lại cùng lịch");
        assertEquals(ScheduleStatus.POSTING, scheduleRepository.findById(g.schedule().getId()).orElseThrow().getStatus());
    }

    @Test
    void recoverStuck_runningJobOlderThanThreshold_failsTemporarilyAndSchedulesRetry() {
        Graph g = newGraph("fb-" + UUID.randomUUID());
        Post post = newPost(g.schedule(), null, PostStatus.POSTING);
        PostingJob job = new PostingJob();
        job.setPost(post);
        job.setRetryCount(0);
        job.setStatus(PostingJobStatus.RUNNING);
        job.setStartTime(java.time.Instant.now().minus(java.time.Duration.ofMinutes(20)));
        job = jobRepository.save(job);
        java.time.Instant threshold = java.time.Instant.now().minus(java.time.Duration.ofMinutes(10));

        postPublishWorkerService.recoverStuck(job.getId(), threshold);
        postPublishWorkerService.recoverStuck(job.getId(), threshold); // gọi lặp (2 instance) — không nhân đôi retry

        assertEquals(PostingJobStatus.FAILED, jobRepository.findById(job.getId()).orElseThrow().getStatus());
        List<PostingJob> retries = transactionTemplate.execute(tx -> jobRepository.findAll().stream()
                .filter(j -> j.getPost().getId().equals(post.getId()) && j.getStatus() == PostingJobStatus.RETRYING)
                .toList());
        assertEquals(1, retries.size());
        assertEquals(1, retries.get(0).getRetryCount());
    }

    @Test
    void recoverStuck_jobStartedRecently_untouched() {
        Graph g = newGraph("fb-" + UUID.randomUUID());
        Post post = newPost(g.schedule(), null, PostStatus.POSTING);
        PostingJob job = new PostingJob();
        job.setPost(post);
        job.setRetryCount(0);
        job.setStatus(PostingJobStatus.RUNNING);
        job.setStartTime(java.time.Instant.now().minus(java.time.Duration.ofMinutes(2)));
        job = jobRepository.save(job);

        postPublishWorkerService.recoverStuck(job.getId(), java.time.Instant.now().minus(java.time.Duration.ofMinutes(10)));

        assertEquals(PostingJobStatus.RUNNING, jobRepository.findById(job.getId()).orElseThrow().getStatus());
    }

    // ================================================================== ShedLock

    @Test
    void shedLock_secondAcquireOfSameLockFails() {
        LockConfiguration config = new LockConfiguration(Instant.now(), "it-lock-" + UUID.randomUUID(),
                Duration.ofMinutes(1), Duration.ZERO);

        Optional<SimpleLock> first = lockProvider.lock(config);
        Optional<SimpleLock> second = lockProvider.lock(config);

        assertTrue(first.isPresent(), "bảng shedlock phải được tạo và khoá lấy được");
        assertTrue(second.isEmpty(), "instance thứ hai không được giữ cùng khoá");
        first.get().unlock();
        Optional<SimpleLock> afterUnlock = lockProvider.lock(config);
        assertTrue(afterUnlock.isPresent());
        afterUnlock.get().unlock();
    }
}
