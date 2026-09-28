package com.aima.posting;

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
import com.aima.enums.ContentLifecycle;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.PublishErrorType;
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
import com.aima.service.PostPublishWorkerService;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import okhttp3.mockwebserver.SocketPolicy;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tích hợp worker đăng bài THẬT: gọi {@link PostPublishWorkerService#process} qua proxy @Async (chạy trên
 * thread {@code post-publish-*}), repository thật trên H2, Meta giả bằng MockWebServer.
 *
 * <p>CỐ Ý không đặt {@code @Transactional} trên class: transaction của test sẽ giữ session mở và che mất
 * đúng loại lỗi cần bắt — worker chạm proxy lazy {@code PlatformAccount} sau khi transaction của nó đã
 * đóng ("Could not initialize proxy ... - no session"). Mọi đọc kiểm chứng đi qua {@link TransactionTemplate}.</p>
 */
@SpringBootTest(properties = {
        "meta.app-secret-proof-enabled=false",
        "meta.response-timeout-seconds=5",
})
class PostPublishWorkerIntegrationTest {

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

    @Autowired private PostPublishWorkerService worker;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private BrandProfileRepository brandProfileRepository;
    @Autowired private ContentItemRepository contentItemRepository;
    @Autowired private ContentVersionRepository contentVersionRepository;
    @Autowired private PlatformAccountRepository accountRepository;
    @Autowired private PostScheduleRepository scheduleRepository;
    @Autowired private PostRepository postRepository;
    @Autowired private PostingJobRepository jobRepository;
    @Autowired private TransactionTemplate transactionTemplate;

    // ================================================================== các case

    @Test
    void pageTarget_metaReturnsId_postIsPublished() throws Exception {
        Fixture f = newFixture(PlatformAccountType.PAGE);
        int before = META.getRequestCount();
        META.enqueue(json(200, "{\"id\":\"" + f.pageId() + "_987\"}"));

        worker.process(f.jobId());
        PostingJob job = awaitFinished(f.jobId());

        assertEquals(PostingJobStatus.SUCCESS, job.getStatus(), "job phải SUCCESS, lỗi: " + job.getErrorMessage());
        assertEquals(before + 1, META.getRequestCount());
        RecordedRequest request = takeRequestFor(f.pageId());
        assertEquals("POST", request.getMethod());
        assertTrue(request.getPath().endsWith("/" + f.pageId() + "/feed"), request.getPath());
        String form = URLDecoder.decode(request.getBody().readUtf8(), StandardCharsets.UTF_8);
        assertTrue(form.contains("access_token=page-token-" + f.pageId()), "phải dùng token Page đã giải mã");
        assertTrue(form.contains("message=Xin chao AIMA\n\n#aima #test"), form);

        transactionTemplate.executeWithoutResult(tx -> {
            Post post = postRepository.findById(f.postId()).orElseThrow();
            assertEquals(PostStatus.POSTED, post.getStatus());
            assertEquals(f.pageId() + "_987", post.getPlatformPostId());
            assertNotNull(post.getPublishedAt());
            PostSchedule schedule = post.getSchedule();
            assertEquals(ScheduleStatus.POSTED, schedule.getStatus());
            assertEquals(ContentLifecycle.POSTED, schedule.getContentVersion().getStatus());
            assertEquals(ContentLifecycle.POSTED, schedule.getContentVersion().getContentItem().getStatus());
        });
        assertEquals(1, jobsOf(f.postId()).size(), "thành công thì không có job retry");
    }

    @Test
    void metaReturns190_failsPermanently_noRetry_accountExpired() {
        Fixture f = newFixture(PlatformAccountType.PAGE);
        META.enqueue(json(400, "{\"error\":{\"message\":\"Error validating access token: Session has expired\","
                + "\"type\":\"OAuthException\",\"code\":190}}"));

        worker.process(f.jobId());
        PostingJob job = awaitFinished(f.jobId());

        assertEquals(PostingJobStatus.FAILED, job.getStatus());
        assertEquals(PublishErrorType.PERMANENT, job.getErrorType());
        assertTrue(job.getErrorMessage().contains("Error validating access token"), job.getErrorMessage());
        assertEquals(1, jobsOf(f.postId()).size(), "lỗi vĩnh viễn: KHÔNG tạo job retry");

        transactionTemplate.executeWithoutResult(tx -> {
            Post post = postRepository.findById(f.postId()).orElseThrow();
            assertEquals(PostStatus.FAILED, post.getStatus());
            assertEquals(ScheduleStatus.FAILED, post.getSchedule().getStatus());
            assertEquals("190", post.getPublishResults().getLast().getResponseCode());
            // FR-70: token hết hạn → kết nối EXPIRED.
            assertEquals(ConnectionStatus.EXPIRED, post.getSchedule().getPlatformAccount().getConnectionStatus());
        });
    }

    @Test
    void networkError_failsTemporarily_retryScheduledAfter5Minutes() {
        Fixture f = newFixture(PlatformAccountType.PAGE);
        int before = META.getRequestCount();
        // Meta nhận request rồi cắt kết nối trước khi trả header = lỗi mạng không có response.
        META.enqueue(new MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AFTER_REQUEST));

        LocalDateTime startedAt = LocalDateTime.now();
        worker.process(f.jobId());
        PostingJob job = awaitFinished(f.jobId());

        assertEquals(before + 1, META.getRequestCount(), "worker phải thực sự gọi tới Meta");
        assertEquals(PostingJobStatus.FAILED, job.getStatus());
        assertEquals(PublishErrorType.TEMPORARY, job.getErrorType(), job.getErrorMessage());

        List<PostingJob> jobs = jobsOf(f.postId());
        assertEquals(2, jobs.size(), "lỗi tạm thời: tạo đúng một job RETRYING");
        PostingJob retry = jobs.get(1);
        assertEquals(PostingJobStatus.RETRYING, retry.getStatus());
        assertEquals(1, retry.getRetryCount());
        assertTrue(retry.getNextRetryAt().isAfter(startedAt.plusMinutes(4)), "retry lần 1 sau 5 phút");
        assertTrue(retry.getNextRetryAt().isBefore(startedAt.plusMinutes(6)), "retry lần 1 sau 5 phút");

        transactionTemplate.executeWithoutResult(tx -> {
            Post post = postRepository.findById(f.postId()).orElseThrow();
            assertEquals("NETWORK", post.getPublishResults().getLast().getResponseCode());
            // Trong chu kỳ retry, lịch giữ POSTING (Failed → Retrying → Posted).
            assertEquals(ScheduleStatus.POSTING, post.getSchedule().getStatus());
        });
    }

    @Test
    void facebookUserTarget_failsPermanently_withoutCallingMeta() {
        Fixture f = newFixture(PlatformAccountType.USER);
        int before = META.getRequestCount();

        worker.process(f.jobId());
        PostingJob job = awaitFinished(f.jobId());

        assertEquals(PostingJobStatus.FAILED, job.getStatus());
        assertEquals(PublishErrorType.PERMANENT, job.getErrorType());
        assertEquals("Facebook chỉ cho phép đăng lên Trang, vui lòng chọn một Trang", job.getErrorMessage());
        assertEquals(before, META.getRequestCount(), "kênh USER: không được gọi Graph API");
        assertEquals(1, jobsOf(f.postId()).size(), "lỗi vĩnh viễn: KHÔNG tạo job retry");
        transactionTemplate.executeWithoutResult(tx -> assertEquals(ScheduleStatus.FAILED,
                postRepository.findById(f.postId()).orElseThrow().getSchedule().getStatus()));
    }

    // ================================================================== dựng dữ liệu

    private record Fixture(UUID jobId, UUID postId, String pageId) {
    }

    /**
     * Chuỗi entity thật ở đúng trạng thái PostingDispatchJob để lại sau khi claim: lịch POSTING (giờ đăng
     * ở tương lai để dispatcher thật của context không đụng tới), Post POSTING, job PENDING.
     */
    private Fixture newFixture(PlatformAccountType targetType) {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "publish-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Publish IT").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());

        BrandProfile brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Brand IT");
        brand.setIndustry("Beauty");
        brand.setTargetAudience("Everyone");
        brand = brandProfileRepository.save(brand);

        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.setStatus(ContentLifecycle.SCHEDULED);
        item = contentItemRepository.save(item);

        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(Platform.FACEBOOK);
        version.setFormattedCaption("Xin chao AIMA");
        version.setFormattedHashtag("aima, test");
        version.setStatus(ContentLifecycle.SCHEDULED);
        version = contentVersionRepository.save(version);

        String fbUserId = "fbuser-" + UUID.randomUUID();
        PlatformAccount root = accountRepository.save(account(user, fbUserId, PlatformAccountType.USER, null));
        String pageId = "page" + Math.abs(UUID.randomUUID().getMostSignificantBits());
        PlatformAccount page = accountRepository.save(account(user, pageId, PlatformAccountType.PAGE, root));

        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setPlatformAccount(targetType == PlatformAccountType.PAGE ? page : root);
        schedule.setScheduledTime(LocalDateTime.now().plusDays(3));
        schedule.setStatus(ScheduleStatus.POSTING);
        schedule = scheduleRepository.save(schedule);

        Post post = new Post();
        post.setSchedule(schedule);
        post.setPlatformName(Platform.FACEBOOK);
        post.setStatus(PostStatus.POSTING);
        post = postRepository.save(post);

        PostingJob job = new PostingJob();
        job.setPost(post);
        job.setRetryCount(0);
        job.setStatus(PostingJobStatus.PENDING);
        job = jobRepository.save(job);
        return new Fixture(job.getId(), post.getId(), pageId);
    }

    private static PlatformAccount account(User user, String platformId, PlatformAccountType type, PlatformAccount parent) {
        PlatformAccount a = new PlatformAccount();
        a.setUser(user);
        a.setPlatformName(Platform.FACEBOOK);
        a.setPlatformAccountId(platformId);
        a.setAccountName("IT " + type);
        a.setAccountType(type);
        a.setTokenType(type == PlatformAccountType.PAGE ? TokenType.PAGE_TOKEN : TokenType.LONG_LIVED_USER_TOKEN);
        a.setAccessToken((type == PlatformAccountType.PAGE ? "page-token-" : "user-token-") + platformId);
        a.setConnectionStatus(ConnectionStatus.ACTIVE);
        a.setParentConnection(parent);
        return a;
    }

    private static MockResponse json(int status, String body) {
        return new MockResponse().setResponseCode(status).setHeader("Content-Type", "application/json").setBody(body);
    }

    /** MockWebServer dùng chung cả class — bỏ qua request của các test chạy trước. */
    private static RecordedRequest takeRequestFor(String pageId) throws InterruptedException {
        RecordedRequest request;
        while ((request = META.takeRequest(5, TimeUnit.SECONDS)) != null) {
            if (request.getPath() != null && request.getPath().contains("/" + pageId + "/")) {
                return request;
            }
        }
        return fail("Meta không nhận request nào cho Page " + pageId);
    }

    /** Chờ worker @Async ghi kết quả (job rời PENDING/RUNNING). */
    private PostingJob awaitFinished(UUID jobId) {
        long deadline = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < deadline) {
            PostingJob job = jobRepository.findById(jobId).orElseThrow();
            if (job.getStatus() == PostingJobStatus.SUCCESS || job.getStatus() == PostingJobStatus.FAILED) {
                return job;
            }
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(e);
            }
        }
        fail("Job " + jobId + " không kết thúc sau 15s (kẹt RUNNING?)");
        return null;
    }

    private List<PostingJob> jobsOf(UUID postId) {
        return jobRepository.findAll().stream()
                .filter(j -> j.getPost().getId().equals(postId))
                .sorted(Comparator.comparing(PostingJob::getRetryCount))
                .toList();
    }
}
