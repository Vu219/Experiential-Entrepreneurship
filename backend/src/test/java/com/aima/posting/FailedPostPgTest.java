package com.aima.posting;

import com.aima.dto.response.AdminFailedPostResponse;
import com.aima.dto.response.AdminFailedPostSummaryResponse;
import com.aima.dto.response.FailedPostResponse;
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
import com.aima.enums.FailedPostFilter;
import com.aima.enums.FailedPostStateFilter;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.PublishErrorCode;
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
import com.aima.service.AdminMonitorService;
import com.aima.service.FailedPostService;
import com.aima.service.PlatformIncidentService;
import com.aima.service.PostPublishWorkerService;
import com.aima.service.PublishErrorAdminService;
import com.aima.util.PublishReference;
import com.aima.util.PublishingTime;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.sql.DriverManager;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Bài lỗi trên PostgreSQL THẬT (stack cô lập :55432): Flyway V1→V13 + Hibernate validate, rồi các truy vấn mà H2
 * không chạy được / có thể khác PG — native admin (AT TIME ZONE, tra mã tham chiếu `ref`), JPQL lọc vòng đời
 * (`:state in (...)`), tổng hợp mã lỗi hàng đầu, hàng đợi chưa phân loại, phát hiện sự cố.
 * Chạy: {@code -Disolated.postgres=true} (docker compose -f isolated/compose.yml up -d postgres).
 */
@EnabledIfSystemProperty(named = "isolated.postgres", matches = "true")
@SpringBootTest(properties = {
        "meta.app-secret-proof-enabled=false",
        "meta.response-timeout-seconds=5",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
})
class FailedPostPgTest {

    static final String URL = "jdbc:postgresql://127.0.0.1:55432/aima_isolated";
    static final String SCHEMA = "failedposts_" + UUID.randomUUID().toString().replace("-", "");
    static final MockWebServer META = new MockWebServer();

    @BeforeAll
    static void startMeta() throws IOException {
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

    @Autowired private FailedPostService failedPostService;
    @Autowired private AdminMonitorService adminMonitorService;
    @Autowired private PublishErrorAdminService adminService;
    @Autowired private PlatformIncidentService incidentService;
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

    @Test
    void userAndAdminQueriesRunOnPostgres() {
        Fixture expired = fail("{\"error\":{\"message\":\"Error validating access token\",\"type\":\"OAuthException\",\"code\":190}}", "Bai token");
        Fixture duplicate = fail("{\"error\":{\"message\":\"Duplicate status message\",\"code\":506}}", "Bai trung lap");
        Fixture odd = fail("{\"error\":{\"message\":\"Weird 77 thing\",\"code\":424242}}", "Bai la");

        // JPQL vòng đời (:state in (...)) trên PG.
        List<FailedPostResponse> needsAction = failedPostService.list(expired.email(), FailedPostFilter.ALL,
                FailedPostStateFilter.NEEDS_ACTION, 0, 50).getResult().getContent();
        assertEquals(1, needsAction.size());
        assertEquals(PublishErrorCode.AUTH_TOKEN_EXPIRED, needsAction.getFirst().getCode());
        failedPostService.dismiss(duplicate.email(), duplicate.postId());
        assertEquals(1, failedPostService.list(duplicate.email(), FailedPostFilter.TECHNICAL, FailedPostStateFilter.DISMISSED,
                0, 50).getResult().getContent().size());
        assertEquals(0, failedPostService.summary(duplicate.email()).getResult().getNeedsAction());

        // Native admin: tra theo mã tham chiếu ERR-XXXXXX (tiền tố id job) và theo chữ.
        LocalDate today = LocalDate.now(PublishingTime.LEGACY_ZONE);
        String reference = PublishReference.of(expired.jobId());
        List<AdminFailedPostResponse> byRef = adminMonitorService.listFailedPosts(new AdminMonitorService.FailedPostFilterQuery(
                FailedPostFilter.ALL, false, null, null, today.minusDays(1), today, reference.toLowerCase()), false, 0, 20)
                .getResult().getContent();
        assertEquals(List.of(expired.postId()), byRef.stream().map(AdminFailedPostResponse::getId).toList());
        assertEquals(reference, byRef.getFirst().getReferenceCode());
        assertEquals(PublishErrorCode.AUTH_TOKEN_EXPIRED, byRef.getFirst().getCode());
        assertEquals(1, adminMonitorService.listFailedPosts(new AdminMonitorService.FailedPostFilterQuery(
                FailedPostFilter.ALL, false, null, null, today.minusDays(1), today, "trung lap"), false, 0, 20)
                .getResult().getContent().size());
        String csv = adminMonitorService.exportFailedPosts(new AdminMonitorService.FailedPostFilterQuery(
                FailedPostFilter.ALL, false, null, null, today.minusDays(1), today, reference)).getResult();
        assertTrue(csv.contains(reference), csv);

        // Tổng hợp: mã lỗi hàng đầu + phân bố nền tảng + bài đã đăng + sự cố.
        AdminFailedPostSummaryResponse summary = adminMonitorService.failedPostSummary(FailedPostFilter.ALL,
                today.minusDays(6), today).getResult();
        assertTrue(summary.getTopCodes().stream().anyMatch(c -> c.getCode() == PublishErrorCode.CONTENT_DUPLICATE));
        assertTrue(summary.getTopCodes().stream().anyMatch(c -> c.getCode() == PublishErrorCode.UNKNOWN));
        assertEquals(3, summary.getByPlatform().stream().filter(p -> p.getPlatform() == Platform.FACEBOOK)
                .findFirst().orElseThrow().getCount());
        assertEquals(0, summary.getPostedTotal());
        assertTrue(summary.getIncidents().isEmpty());

        // Hàng đợi chưa phân loại + phát hiện sự cố (JPQL count distinct / min Instant) trên PG.
        assertTrue(adminService.unclassified(today.minusDays(1), today).getResult().stream()
                .anyMatch(g -> "424242".equals(g.getPlatformCode()) && g.getCount() == 1));
        assertFalse(incidentService.isActive(Platform.FACEBOOK));
        assertNotNull(odd.jobId());
    }

    // ================================================================== dựng dữ liệu

    private record Fixture(String email, UUID jobId, UUID postId) {
    }

    private Fixture fail(String errorBody, String caption) {
        Fixture f = newFixture(caption);
        META.enqueue(new MockResponse().setResponseCode(400).setHeader("Content-Type", "application/json").setBody(errorBody));
        worker.process(f.jobId());
        long deadline = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < deadline) {
            ScheduleStatus status = transactionTemplate.execute(tx ->
                    postRepository.findById(f.postId()).orElseThrow().getSchedule().getStatus());
            if (status == ScheduleStatus.FAILED) {
                return f;
            }
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        return org.junit.jupiter.api.Assertions.fail("Lịch không về FAILED");
    }

    private Fixture newFixture(String caption) {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "pg-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("PG IT").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        BrandProfile brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Brand PG");
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
        version.setFormattedCaption(caption);
        version.setStatus(ContentVersionStatus.FORMATTED);
        version = contentVersionRepository.save(version);
        String pageId = "page" + Math.abs(UUID.randomUUID().getMostSignificantBits());
        PlatformAccount page = new PlatformAccount();
        page.setUser(user);
        page.setPlatformName(Platform.FACEBOOK);
        page.setPlatformAccountId(pageId);
        page.setAccountName("Page PG");
        page.setAccountType(PlatformAccountType.PAGE);
        page.setTokenType(TokenType.PAGE_TOKEN);
        page.setAccessToken("page-token-" + pageId);
        page.setConnectionStatus(ConnectionStatus.ACTIVE);
        page = accountRepository.save(page);
        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setPlatformAccount(page);
        schedule.setScheduledTime(Instant.now().plus(Duration.ofDays(3)));
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
        return new Fixture(email, job.getId(), post.getId());
    }
}
