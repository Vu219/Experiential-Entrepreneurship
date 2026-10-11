package com.aima.posting;

import com.aima.dto.request.AdminActionReasonRequest;
import com.aima.dto.request.PublishErrorMappingRequest;
import com.aima.dto.response.AdminFailedPostDetailResponse;
import com.aima.dto.response.PublishErrorMappingResponse;
import com.aima.dto.response.UnclassifiedErrorGroupResponse;
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
import com.aima.enums.PublishErrorCode;
import com.aima.enums.PublishErrorType;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.PostingJobRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.scheduler.PostingDispatchJob;
import com.aima.service.PlatformIncidentService;
import com.aima.service.PostPublishWorkerService;
import com.aima.service.PublishErrorAdminService;
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
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Admin xử lý bài lỗi (docs/failed-posts-error-handling-plan.md Phase 4): hàng đợi chưa phân loại → ánh xạ → áp cho
 * lỗi cũ + lỗi mới; chi tiết lỗi thô đã redact; thử lại thay người dùng; phát hiện sự cố nền tảng + hoãn retry.
 * Ngưỡng sự cố hạ thấp và tắt cache để quan sát được trong test.
 */
@SpringBootTest(properties = {
        "meta.app-secret-proof-enabled=false",
        "meta.response-timeout-seconds=5",
        "aima.publishing.outage.min-failures=3",
        "aima.publishing.outage.min-accounts=2",
        "aima.publishing.outage.cache-seconds=0",
})
class PublishErrorAdminIntegrationTest {

    static final MockWebServer META = new MockWebServer();
    static final String ADMIN_EMAIL = "admin-" + UUID.randomUUID() + "@it.local";

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

    @Autowired private PublishErrorAdminService adminService;
    @Autowired private PlatformIncidentService incidentService;
    @Autowired private PostingDispatchJob dispatchJob;
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
    void unknownError_queuedAsUnclassified_mappingReclassifiesStoredAndFutureFailures() {
        String odd = "{\"error\":{\"message\":\"Weird thing 4471 happened\",\"type\":\"GraphMethodException\",\"code\":12345}}";
        Fixture first = failedFixture(odd);
        assertEquals(PublishErrorCode.UNKNOWN, job(first).getErrorCode());

        LocalDate today = LocalDate.now(com.aima.util.PublishingTime.LEGACY_ZONE);
        UnclassifiedErrorGroupResponse group = adminService.unclassified(today.minusDays(1), today).getResult().stream()
                .filter(g -> "12345".equals(g.getPlatformCode())).findFirst().orElseThrow();
        assertEquals(Platform.FACEBOOK, group.getPlatform());
        assertEquals(1, group.getCount());
        assertEquals(com.aima.util.PublishReference.of(first.jobId()), group.getSampleReferenceCode());

        PublishErrorMappingRequest request = PublishErrorMappingRequest.builder()
                .platform(Platform.FACEBOOK).platformCode(" 12345 ").errorCode(PublishErrorCode.CONTENT_INVALID)
                .note("Meta trả mã lạ khi caption có ký tự điều khiển").applyToExisting(true).build();
        PublishErrorMappingResponse mapping = adminService.createMapping(ADMIN_EMAIL, request).getResult();
        assertEquals("12345", mapping.getPlatformCode());
        assertEquals(1, mapping.getAppliedCount());
        PostingJob reclassified = job(first);
        assertEquals(PublishErrorCode.CONTENT_INVALID, reclassified.getErrorCode());
        assertEquals(PublishErrorType.PERMANENT, reclassified.getErrorType());

        AppException duplicate = assertThrows(AppException.class, () -> adminService.createMapping(ADMIN_EMAIL,
                PublishErrorMappingRequest.builder().platform(Platform.FACEBOOK).platformCode("12345")
                        .errorCode(PublishErrorCode.RATE_LIMITED).build()));
        assertEquals(ErrorCode.PUBLISH_ERROR_MAPPING_INVALID, duplicate.getErrorCode());

        // Lỗi MỚI cùng chữ ký → dùng ánh xạ admin thay vì UNKNOWN.
        Fixture second = failedFixture(odd);
        assertEquals(PublishErrorCode.CONTENT_INVALID, job(second).getErrorCode());
        assertTrue(adminService.unclassified(today.minusDays(1), today).getResult().stream()
                .noneMatch(g -> "12345".equals(g.getPlatformCode())), "đã phân loại → rời hàng đợi");

        adminService.deleteMapping(ADMIN_EMAIL, mapping.getId());
        assertTrue(adminService.listMappings().getResult().stream().noneMatch(m -> m.getId().equals(mapping.getId())));
    }

    @Test
    void adminDetail_hasRedactedRawError_andRetryOnBehalfFollowsTheSameGuards() {
        Fixture f = failedFixture("{\"error\":{\"message\":\"Error validating access token: access_token=EAABsecretLeak99 "
                + "owner owner@aima.vn\",\"type\":\"OAuthException\",\"code\":190,\"error_subcode\":463,\"fbtrace_id\":\"Tr4ce\"}}");

        AdminFailedPostDetailResponse detail = adminService.get(f.postId()).getResult();
        assertEquals(PublishErrorCode.AUTH_TOKEN_EXPIRED, detail.getPost().getCode());
        assertNotNull(detail.getPost().getReferenceCode());
        for (String raw : List.of(detail.getRawError(), detail.getAttempts().getFirst().getErrorDetail(),
                detail.getAttempts().getFirst().getErrorMessage(), detail.getPost().getErrorMessage())) {
            assertFalse(raw.contains("EAABsecretLeak99"), raw);
            assertFalse(raw.contains("owner@aima.vn"), raw);
        }
        assertTrue(detail.getRawError().contains("Tr4ce"), detail.getRawError());
        assertEquals("463", detail.getAttempts().getFirst().getPlatformSubcode());

        AdminActionReasonRequest reason = AdminActionReasonRequest.builder().reason("Người dùng đã kết nối lại qua hỗ trợ").build();
        AppException notReady = assertThrows(AppException.class, () -> adminService.retry(ADMIN_EMAIL, f.postId(), reason));
        assertEquals(ErrorCode.FAILED_POST_ACCOUNT_NOT_READY, notReady.getErrorCode());

        transactionTemplate.executeWithoutResult(tx -> postRepository.findById(f.postId()).orElseThrow()
                .getSchedule().getPlatformAccount().setConnectionStatus(ConnectionStatus.ACTIVE));
        META.enqueue(json(200, "{\"id\":\"" + f.pageId() + "_9\"}"));
        UUID jobId = adminService.retry(ADMIN_EMAIL, f.postId(), reason).getResult().getJobId();
        assertEquals(PostingJobStatus.SUCCESS, awaitFinished(jobId).getStatus());
        assertEquals(com.aima.enums.FailureResolution.RETRIED, job(f).getResolution());
    }

    @Test
    void wideTransientFailures_openAnIncident_markOutage_andDeferRetries() {
        String unavailable = "{\"error\":{\"message\":\"Service temporarily unavailable\",\"code\":2}}";
        // Ngưỡng test: ≥ 3 lỗi tạm thời từ ≥ 2 kết nối (mỗi fixture một Trang riêng).
        for (int i = 0; i < 3; i++) {
            Fixture f = newFixture();
            META.enqueue(json(503, unavailable));
            worker.process(f.jobId());
            assertEquals(PublishErrorCode.PLATFORM_TEMPORARY, awaitFinished(f.jobId()).getErrorCode());
        }
        assertTrue(incidentService.isActive(Platform.FACEBOOK));
        assertFalse(incidentService.isActive(Platform.THREADS));

        Fixture during = newFixture();
        META.enqueue(json(503, unavailable));
        worker.process(during.jobId());
        assertEquals(PublishErrorCode.PLATFORM_OUTAGE, awaitFinished(during.jobId()).getErrorCode(),
                "lỗi tạm thời giữa lúc sự cố được đánh dấu sự cố nền tảng");

        // Retry đến hạn của nền tảng đang sự cố bị HOÃN: dispatcher không nhận job, không gọi Meta.
        PostingJob retry = transactionTemplate.execute(tx -> {
            PostingJob r = postRepository.findById(during.postId()).orElseThrow().getPostingJobs().stream()
                    .filter(j -> j.getStatus() == PostingJobStatus.RETRYING).findFirst().orElseThrow();
            r.setNextRetryAt(Instant.now().minus(Duration.ofMinutes(1)));
            return r;
        });
        int before = META.getRequestCount();
        dispatchJob.run();
        assertEquals(PostingJobStatus.RETRYING, jobRepository.findById(retry.getId()).orElseThrow().getStatus());
        assertEquals(before, META.getRequestCount());
    }

    // ================================================================== dựng dữ liệu

    private record Fixture(UUID jobId, UUID postId, String pageId) {
    }

    private PostingJob job(Fixture f) {
        return jobRepository.findById(f.jobId()).orElseThrow();
    }

    private Fixture failedFixture(String errorBody) {
        Fixture f = newFixture();
        META.enqueue(json(400, errorBody));
        worker.process(f.jobId());
        assertEquals(PostingJobStatus.FAILED, awaitFinished(f.jobId()).getStatus());
        long deadline = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < deadline) {
            ScheduleStatus status = transactionTemplate.execute(tx ->
                    postRepository.findById(f.postId()).orElseThrow().getSchedule().getStatus());
            if (status == ScheduleStatus.FAILED) {
                return f;
            }
            sleep();
        }
        return fail("Lịch không về FAILED");
    }

    private Fixture newFixture() {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        if (userRepository.findByEmail(ADMIN_EMAIL).isEmpty()) {
            userRepository.save(User.builder().username(ADMIN_EMAIL).email(ADMIN_EMAIL).fullName("Admin IT")
                    .password("{noop}x").role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        }
        String email = "admin-fixture-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Admin Fixture").password("{noop}x")
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
        version.setFormattedCaption("Xin chao AIMA");
        version.setStatus(ContentVersionStatus.FORMATTED);
        version = contentVersionRepository.save(version);

        String pageId = "page" + Math.abs(UUID.randomUUID().getMostSignificantBits());
        PlatformAccount page = new PlatformAccount();
        page.setUser(user);
        page.setPlatformName(Platform.FACEBOOK);
        page.setPlatformAccountId(pageId);
        page.setAccountName("Page IT");
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
        return new Fixture(job.getId(), post.getId(), pageId);
    }

    private static MockResponse json(int status, String body) {
        return new MockResponse().setResponseCode(status).setHeader("Content-Type", "application/json").setBody(body);
    }

    private PostingJob awaitFinished(UUID jobId) {
        long deadline = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < deadline) {
            PostingJob job = jobRepository.findById(jobId).orElseThrow();
            if (job.getStatus() == PostingJobStatus.SUCCESS || job.getStatus() == PostingJobStatus.FAILED) {
                return job;
            }
            sleep();
        }
        return fail("Job " + jobId + " không kết thúc");
    }

    private static void sleep() {
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
