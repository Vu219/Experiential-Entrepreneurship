package com.aima.posting;

import com.aima.dto.request.FailedPostBulkRequest;
import com.aima.dto.response.FailedPostBulkResponse;
import com.aima.dto.response.FailedPostDetailResponse;
import com.aima.dto.response.FailedPostResponse;
import com.aima.dto.response.FailedPostRetryResponse;
import com.aima.dto.response.FailedPostSummaryResponse;
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
import com.aima.enums.FailedPostBulkAction;
import com.aima.enums.FailedPostFilter;
import com.aima.enums.FailedPostStateFilter;
import com.aima.enums.FailureResolution;
import com.aima.enums.FailureState;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PostSnapshotState;
import com.aima.enums.PostStatus;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.PublishErrorAction;
import com.aima.enums.PublishErrorCode;
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
import com.aima.service.FailedPostService;
import com.aima.service.PostPublishWorkerService;
import com.aima.service.PostScheduleService;
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
import java.lang.reflect.Field;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Trang "Bài lỗi & cần xử lý" (docs/failed-posts-error-handling-plan.md Phase 2): danh sách theo vòng đời, chặn
 * "Thử lại ngay" sai chỗ, bỏ qua, hàng loạt, quyền sở hữu và DTO không mang lỗi thô. Lỗi được tạo bằng worker THẬT
 * (MockWebServer giả Meta) — không chèn tay dữ liệu lỗi. Không {@code @Transactional} trên class (xem
 * {@link PostPublishWorkerIntegrationTest}).
 */
@SpringBootTest(properties = {
        "meta.app-secret-proof-enabled=false",
        "meta.response-timeout-seconds=5",
})
class FailedPostRecoveryIntegrationTest {

    static final MockWebServer META = new MockWebServer();

    static final String DUPLICATE = "{\"error\":{\"message\":\"Duplicate status message\",\"type\":\"OAuthException\",\"code\":506}}";
    static final String TOKEN_EXPIRED = "{\"error\":{\"message\":\"Error validating access token\",\"type\":\"OAuthException\",\"code\":190}}";

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

    @Autowired private FailedPostService failedPostService;
    @Autowired private PostScheduleService postScheduleService;
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
    void contentError_listedAsNeedsAction_retryRequiresEdit_thenRepublishes() {
        Fixture f = failedFixture(DUPLICATE);

        FailedPostResponse row = onlyRow(f, FailedPostStateFilter.NEEDS_ACTION);
        assertEquals(PublishErrorCode.CONTENT_DUPLICATE, row.getCode());
        assertEquals(FailureState.NEEDS_ACTION, row.getState());
        assertNull(row.getErrorMessage(), "người dùng không nhận message gốc của nền tảng");
        assertEquals("506", row.getErrorCode());
        assertNotNull(row.getReferenceCode());
        assertFalse(row.isContentChanged());
        assertEquals(List.of(PublishErrorAction.EDIT_CONTENT, PublishErrorAction.AI_FIX, PublishErrorAction.DISMISS), row.getActions(),
                "chưa sửa nội dung: không mời thử lại");

        AppException editFirst = assertThrows(AppException.class, () -> failedPostService.retry(f.email(), f.postId()));
        assertEquals(ErrorCode.FAILED_POST_EDIT_REQUIRED, editFirst.getErrorCode());

        bumpRevision(f); // người dùng sửa bản nền tảng
        assertEquals(List.of(PublishErrorAction.EDIT_CONTENT, PublishErrorAction.RETRY_NOW, PublishErrorAction.AI_FIX,
                        PublishErrorAction.DISMISS),
                onlyRow(f, FailedPostStateFilter.NEEDS_ACTION).getActions());

        META.enqueue(json(200, "{\"id\":\"" + f.pageId() + "_42\"}"));
        FailedPostRetryResponse retried = failedPostService.retry(f.email(), f.postId()).getResult();
        assertNotNull(retried.getJobId());
        assertNull(retried.getHeldReason());
        assertEquals(PostingJobStatus.SUCCESS, awaitFinished(retried.getJobId()).getStatus());
        transactionTemplate.executeWithoutResult(tx -> {
            Post post = postRepository.findById(f.postId()).orElseThrow();
            assertEquals(PostStatus.POSTED, post.getStatus());
            assertEquals(ScheduleStatus.POSTED, post.getSchedule().getStatus());
            assertEquals(1, post.getSnapshotRevision(), "lần đăng lại dùng nội dung ĐÃ sửa");
        });
        assertEquals(FailureResolution.RETRIED, jobRepository.findById(f.jobId()).orElseThrow().getResolution());
        assertTrue(failedPostService.list(f.email(), FailedPostFilter.ALL, FailedPostStateFilter.ALL, 0, 50)
                .getResult().getContent().isEmpty(), "bài đã đăng rời danh sách bài lỗi");
    }

    @Test
    void tokenExpired_retryBlockedUntilAccountIsActiveAgain() {
        Fixture f = failedFixture(TOKEN_EXPIRED);
        FailedPostResponse row = onlyRow(f, FailedPostStateFilter.NEEDS_ACTION);
        assertEquals(PublishErrorCode.AUTH_TOKEN_EXPIRED, row.getCode());
        assertEquals(ConnectionStatus.EXPIRED, row.getAccountStatus());
        assertFalse(row.isAccountReady());
        assertEquals(PublishErrorAction.RECONNECT_ACCOUNT, row.getActions().getFirst());

        AppException notReady = assertThrows(AppException.class, () -> failedPostService.retry(f.email(), f.postId()));
        assertEquals(ErrorCode.FAILED_POST_ACCOUNT_NOT_READY, notReady.getErrorCode());

        // Người dùng kết nối lại (OAuth upsert → ACTIVE).
        transactionTemplate.executeWithoutResult(tx -> accountRepository.findById(row.getAccountId()).orElseThrow()
                .setConnectionStatus(ConnectionStatus.ACTIVE));
        META.enqueue(json(200, "{\"id\":\"" + f.pageId() + "_43\"}"));
        UUID jobId = failedPostService.retry(f.email(), f.postId()).getResult().getJobId();
        assertEquals(PostingJobStatus.SUCCESS, awaitFinished(jobId).getStatus());
    }

    @Test
    void dismiss_movesToDismissed_isIdempotent_andCanStillBeRetried() {
        Fixture f = failedFixture(TOKEN_EXPIRED);

        FailedPostResponse dismissed = failedPostService.dismiss(f.email(), f.postId()).getResult();
        assertEquals(FailureState.DISMISSED, dismissed.getState());
        assertFalse(dismissed.getActions().contains(PublishErrorAction.DISMISS));
        failedPostService.dismiss(f.email(), f.postId()); // lặp lại = no-op
        assertEquals(FailureResolution.DISMISSED, jobRepository.findById(f.jobId()).orElseThrow().getResolution());

        assertTrue(ids(f, FailedPostStateFilter.NEEDS_ACTION).isEmpty());
        assertEquals(Set.of(f.postId()), ids(f, FailedPostStateFilter.DISMISSED));
        assertEquals(Set.of(f.postId()), ids(f, FailedPostStateFilter.ALL));
        FailedPostSummaryResponse summary = failedPostService.summary(f.email()).getResult();
        assertEquals(0, summary.getNeedsAction());
        assertEquals(1, summary.getDismissed());
        assertEquals(1, summary.getTotal(), "tổng bài lỗi chung cuộc giữ nghĩa cũ (gồm bài đã bỏ qua)");
    }

    @Test
    void temporaryError_listedAsAutoRetrying_withNextRetryAndNoActions() {
        Fixture f = newFixture();
        META.enqueue(json(503, "{\"error\":{\"message\":\"Service temporarily unavailable\",\"code\":2}}"));
        worker.process(f.jobId());
        awaitFinished(f.jobId());

        assertTrue(ids(f, FailedPostStateFilter.NEEDS_ACTION).isEmpty(), "đang tự thử lại: chưa cần người dùng xử lý");
        FailedPostResponse row = onlyRow(f, FailedPostStateFilter.AUTO_RETRYING);
        assertEquals(FailureState.AUTO_RETRYING, row.getState());
        assertEquals(PublishErrorCode.PLATFORM_TEMPORARY, row.getCode());
        assertTrue(row.isAutoRetry());
        assertEquals(1, row.getAttempt());
        assertEquals(4, row.getMaxAttempts());
        assertNotNull(row.getNextRetryAt());
        assertTrue(row.getActions().isEmpty());
        assertEquals(Set.of(f.postId()), ids(f, FailedPostStateFilter.ACTIVE));

        AppException notFailedYet = assertThrows(AppException.class, () -> failedPostService.retry(f.email(), f.postId()));
        assertEquals(ErrorCode.FAILED_POST_NOT_ACTIONABLE, notFailedYet.getErrorCode());
    }

    @Test
    void detail_hasTimelineWithReferenceCodes() {
        Fixture f = failedFixture(DUPLICATE);

        FailedPostDetailResponse detail = failedPostService.get(f.email(), f.postId()).getResult();
        assertEquals(1, detail.getAttempts().size());
        assertEquals(PublishErrorCode.CONTENT_DUPLICATE, detail.getAttempts().getFirst().getCode());
        assertEquals(detail.getPost().getReferenceCode(), detail.getAttempts().getFirst().getReferenceCode());
        assertEquals("506", detail.getAttempts().getFirst().getPlatformCode());
    }

    @Test
    void otherUsersPost_isNotFound_forEveryAction() {
        Fixture f = failedFixture(DUPLICATE);
        Fixture other = newFixture();

        for (Runnable action : List.<Runnable>of(
                () -> failedPostService.get(other.email(), f.postId()),
                () -> failedPostService.retry(other.email(), f.postId()),
                () -> failedPostService.dismiss(other.email(), f.postId()))) {
            AppException e = assertThrows(AppException.class, action::run);
            assertEquals(ErrorCode.POST_NOT_FOUND, e.getErrorCode());
        }
    }

    @Test
    void bulk_eachRowIndependent() {
        Fixture a = failedFixture(TOKEN_EXPIRED);
        Fixture foreign = failedFixture(DUPLICATE);

        FailedPostBulkResponse result = failedPostService.bulk(a.email(), FailedPostBulkRequest.builder()
                .action(FailedPostBulkAction.DISMISS).postIds(List.of(a.postId(), foreign.postId())).build()).getResult();
        assertEquals(1, result.getSucceeded());
        assertEquals(1, result.getFailed());
        assertEquals(200, result.getResults().getFirst().getCode());
        assertEquals(ErrorCode.POST_NOT_FOUND.getCode(), result.getResults().get(1).getCode());
        assertEquals(FailureResolution.DISMISSED, jobRepository.findById(a.jobId()).orElseThrow().getResolution());
    }

    @Test
    void cancellingFailedSchedule_marksFailureCancelled() {
        Fixture f = failedFixture(DUPLICATE);
        UUID scheduleId = transactionTemplate.execute(tx -> postRepository.findById(f.postId()).orElseThrow().getSchedule().getId());

        postScheduleService.cancel(f.email(), scheduleId);

        assertEquals(FailureResolution.CANCELLED, jobRepository.findById(f.jobId()).orElseThrow().getResolution());
        assertTrue(ids(f, FailedPostStateFilter.ALL).isEmpty());
    }

    @Test
    void userFacingDtoHasNoRawErrorFields() {
        Set<String> fields = Arrays.stream(FailedPostResponse.class.getDeclaredFields()).map(Field::getName)
                .collect(Collectors.toSet());
        for (String forbidden : List.of("rawError", "errorDetail", "responseMessage", "platformMessage", "stack", "detail")) {
            assertFalse(fields.contains(forbidden), "DTO của user không được có trường " + forbidden);
        }
    }

    // ================================================================== dựng dữ liệu

    private record Fixture(String email, UUID jobId, UUID postId, String pageId) {
    }

    private FailedPostResponse onlyRow(Fixture f, FailedPostStateFilter state) {
        List<FailedPostResponse> rows = failedPostService.list(f.email(), FailedPostFilter.ALL, state, 0, 50)
                .getResult().getContent();
        assertEquals(1, rows.size(), state + ": " + rows);
        assertEquals(f.postId(), rows.getFirst().getId());
        return rows.getFirst();
    }

    private Set<UUID> ids(Fixture f, FailedPostStateFilter state) {
        return failedPostService.list(f.email(), FailedPostFilter.ALL, state, 0, 50).getResult().getContent()
                .stream().map(FailedPostResponse::getId).collect(Collectors.toSet());
    }

    /** Bài đã đăng lỗi CHUNG CUỘC qua worker thật với body lỗi {@code errorBody}. */
    private Fixture failedFixture(String errorBody) {
        Fixture f = newFixture();
        META.enqueue(json(400, errorBody));
        worker.process(f.jobId());
        assertEquals(PostingJobStatus.FAILED, awaitFinished(f.jobId()).getStatus());
        // Thông báo/tạm giữ chạy sau commit trên cùng thread worker — chờ lịch về FAILED là đủ cho các assert.
        awaitScheduleFailed(f.postId());
        return f;
    }

    private void bumpRevision(Fixture f) {
        transactionTemplate.executeWithoutResult(tx -> {
            ContentVersion version = postRepository.findById(f.postId()).orElseThrow().getSchedule().getContentVersion();
            version.setRevision(version.getRevision() + 1);
            version.setFormattedCaption("Xin chao AIMA — da sua");
        });
    }

    private Fixture newFixture() {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "recover-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Recover IT").password("{noop}x")
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
        version.setFormattedHashtag("aima, test");
        version.setStatus(ContentVersionStatus.FORMATTED);
        version = contentVersionRepository.save(version);

        PlatformAccount root = accountRepository.save(account(user, "fbuser-" + UUID.randomUUID(), PlatformAccountType.USER, null));
        String pageId = "page" + Math.abs(UUID.randomUUID().getMostSignificantBits());
        PlatformAccount page = accountRepository.save(account(user, pageId, PlatformAccountType.PAGE, root));

        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setPlatformAccount(page);
        schedule.setScheduledTime(Instant.now().plus(Duration.ofDays(3)));
        schedule.setStatus(ScheduleStatus.POSTING);
        schedule = scheduleRepository.save(schedule);

        // Snapshot như dispatcher chụp (revision 0) — so với revision của bản để biết người dùng đã sửa chưa.
        Post post = new Post();
        post.setSchedule(schedule);
        post.setPlatformName(Platform.FACEBOOK);
        post.setStatus(PostStatus.POSTING);
        post.setSnapshotState(PostSnapshotState.CAPTURED);
        post.setSnapshotVersionId(version.getId());
        post.setSnapshotRevision(0);
        post.setSnapshotCaption("Xin chao AIMA");
        post.setSnapshotHashtag("aima, test");
        post.setSnapshotCapturedAt(Instant.now());
        post = postRepository.save(post);

        PostingJob job = new PostingJob();
        job.setPost(post);
        job.setRetryCount(0);
        job.setStatus(PostingJobStatus.PENDING);
        job = jobRepository.save(job);
        return new Fixture(email, job.getId(), post.getId(), pageId);
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

    private void awaitScheduleFailed(UUID postId) {
        long deadline = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < deadline) {
            ScheduleStatus status = transactionTemplate.execute(tx ->
                    postRepository.findById(postId).orElseThrow().getSchedule().getStatus());
            if (status == ScheduleStatus.FAILED) {
                return;
            }
            sleep();
        }
        fail("Lịch của bài " + postId + " không về FAILED");
    }

    /** Chờ worker @Async ghi kết quả (job rời PENDING/RUNNING). */
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
