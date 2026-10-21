package com.aima.posting;

import com.aima.dto.response.AiAssistUsageResponse;
import com.aima.entity.Plan;
import com.aima.entity.PlanFeatureLimits;
import com.aima.entity.Subscription;
import com.aima.enums.PlanSource;
import com.aima.repository.PlanRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.service.PlanLimitService;
import com.aima.service.SubscriptionService;
import com.aima.dto.ai.PolicyCheckPayload;
import com.aima.dto.ai.PolicyCheckResultPayload;
import com.aima.dto.ai.PolicyFixPayload;
import com.aima.dto.ai.PolicyFixResultPayload;
import com.aima.dto.ai.PolicyIssuePayload;
import com.aima.dto.request.AiFixApplyRequest;
import com.aima.dto.request.AiFixStartRequest;
import com.aima.dto.request.PolicyCheckRequest;
import com.aima.dto.response.AiAssistJobResponse;
import com.aima.dto.response.AiFixApplyResponse;
import com.aima.dto.response.FailedPostResponse;
import com.aima.dto.response.PolicyCheckResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostingJob;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.entity.UserPublishingSettings;
import com.aima.enums.AiFixApplyAction;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.FailedPostFilter;
import com.aima.enums.FailedPostStateFilter;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PolicyCheckAiStatus;
import com.aima.enums.PolicyRiskLevel;
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
import com.aima.repository.UserPublishingSettingsRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AiAssistService;
import com.aima.service.AiServiceClient;
import com.aima.service.FailedPostService;
import com.aima.service.PostPublishWorkerService;
import com.aima.service.TokenUsageService;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AI sửa bài vi phạm + kiểm tra chính sách (failed-posts đợt 2, plan §8): chỉ gọi AI khi được phép, giới hạn lần/bản,
 * hết token thì không gọi, áp dụng qua luồng sửa tay rồi đăng lại, kiểm tra 2 tầng + cache theo hash + giới hạn gói.
 * AI service và hạn mức token được giả lập; lỗi đăng bài tạo bằng worker THẬT (MockWebServer giả Meta).
 */
@SpringBootTest(properties = {
        "meta.app-secret-proof-enabled=false",
        "meta.response-timeout-seconds=5",
        "aima.ai-assist.fix-max-per-version=2",
        "aima.ai-assist.policy-check.ai-monthly-limit-default=0",
})
class AiAssistIntegrationTest {

    static final MockWebServer META = new MockWebServer();
    static final String POLICY = "{\"error\":{\"message\":\"This content violates our Community Standards\","
            + "\"type\":\"OAuthException\",\"code\":100}}";
    static final String TOKEN_EXPIRED = "{\"error\":{\"message\":\"Error validating access token\",\"type\":\"OAuthException\",\"code\":190}}";
    static final String RISKY = "Cam kết hoàn tiền 100% nếu không hiệu quả";

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

    @MockitoBean private AiServiceClient aiServiceClient;
    @MockitoBean private TokenUsageService tokenUsageService;

    @Autowired private AiAssistService aiAssistService;
    @Autowired private FailedPostService failedPostService;
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
    @Autowired private UserPublishingSettingsRepository settingsRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private PlanRepository planRepository;
    @Autowired private SubscriptionService subscriptionService;
    @Autowired private SubscriptionRepository subscriptionRepository;

    @BeforeEach
    void quotaAvailable() {
        when(tokenUsageService.state(any())).thenReturn(new TokenUsageService.QuotaState(0, 1_000_000L, 0));
    }

    /** Giới hạn AI nằm trên gói (V15): FREE tắt AI kiểm tra, PLUS 5 lượt; AI sửa để "Mặc định" (= 2 ở trên). */
    @BeforeEach
    void planLimits() {
        setPlanLimits("FREE", 0, null);
        setPlanLimits("PLUS", 5, null);
    }

    private void setPlanLimits(String code, Integer policyCheck, Integer aiFix) {
        transactionTemplate.executeWithoutResult(tx -> {
            Plan plan = planRepository.findByCodeAndDeletedAtIsNull(code).orElseThrow();
            if (plan.getFeatureLimits() == null) {
                plan.setFeatureLimits(new PlanFeatureLimits());
            }
            plan.getFeatureLimits().setPolicyCheckAiPerPeriod(policyCheck);
            plan.getFeatureLimits().setAiFixPerVersion(aiFix);
            planRepository.save(plan);
        });
    }

    // ================================================================== A1 — AI sửa bài

    @Test
    void policyViolation_aiSuggestion_userEdits_applyAndRetry_publishesEditedText() {
        Fixture f = failedFixture(POLICY);
        FailedPostResponse row = failedPostService.list(f.email(), FailedPostFilter.ALL, FailedPostStateFilter.NEEDS_ACTION,
                0, 10).getResult().getContent().getFirst();
        assertEquals(PublishErrorCode.POLICY_VIOLATION, row.getCode());
        assertTrue(row.getActions().contains(PublishErrorAction.AI_FIX), "bài vi phạm có nút AI sửa nội dung");

        when(aiServiceClient.policyFix(any())).thenReturn(PolicyFixResultPayload.builder()
                .caption("Xin chao AIMA ban an toan").hashtags(List.of("aima")).changes(List.of("Bỏ tuyên bố tuyệt đối"))
                .tokensUsed(1200L).inputTokens(900L).outputTokens(300L).build());
        AiAssistJobResponse started = aiAssistService.startFix(f.email(),
                AiFixStartRequest.builder().contentVersionId(f.versionId()).postId(f.postId()).build()).getResult();
        assertEquals(GenerationJobStatus.PENDING, started.getStatus());

        AiAssistJobResponse done = awaitJob(f.email(), started.getId());
        assertEquals(GenerationJobStatus.SUCCESS, done.getStatus());
        assertEquals("Xin chao AIMA", done.getFix().getOriginalCaption());
        assertEquals(List.of("aima", "test"), done.getFix().getOriginalHashtags());
        assertEquals("Xin chao AIMA ban an toan", done.getFix().getCaption());
        assertFalse(done.isStale());

        ArgumentCaptor<PolicyFixPayload> sent = ArgumentCaptor.forClass(PolicyFixPayload.class);
        verify(aiServiceClient).policyFix(sent.capture());
        assertEquals("POLICY_VIOLATION", sent.getValue().getErrorCode(), "chỉ gửi mã chuẩn, không message thô");
        assertEquals("Facebook", sent.getValue().getPlatform());
        assertEquals("Brand IT", sent.getValue().getBrandProfile().getBrandName(), "giữ giọng thương hiệu");

        META.enqueue(json(200, "{\"id\":\"" + f.pageId() + "_9\"}"));
        AiFixApplyResponse applied = aiAssistService.applyFix(f.email(), started.getId(), AiFixApplyRequest.builder()
                .caption("Xin chao AIMA - ban da duyet").hashtags(List.of("#aima")).action(AiFixApplyAction.RETRY_NOW)
                .build()).getResult();
        assertNotNull(applied.getRetry().getJobId());
        assertEquals(PostingJobStatus.SUCCESS, awaitPosting(applied.getRetry().getJobId()).getStatus());
        transactionTemplate.executeWithoutResult(tx -> {
            ContentVersion version = contentVersionRepository.findById(f.versionId()).orElseThrow();
            assertEquals("Xin chao AIMA - ban da duyet", version.getFormattedCaption(), "áp dụng bản người dùng đã sửa");
            assertEquals("aima", version.getFormattedHashtag());
            assertEquals(PostStatus.POSTED, postRepository.findById(f.postId()).orElseThrow().getStatus());
        });
        assertNotNull(aiAssistService.getJob(f.email(), started.getId()).getResult().getAppliedAt());
    }

    @Test
    void fix_onlyForContentErrors_limitedPerVersion_andBlockedWithoutTokens() {
        Fixture expired = failedFixture(TOKEN_EXPIRED);
        AppException notEligible = assertThrows(AppException.class, () -> aiAssistService.startFix(expired.email(),
                AiFixStartRequest.builder().contentVersionId(expired.versionId()).postId(expired.postId()).build()));
        assertEquals(ErrorCode.AI_FIX_NOT_ELIGIBLE, notEligible.getErrorCode());

        Fixture f = failedFixture(POLICY);
        when(aiServiceClient.policyFix(any())).thenReturn(PolicyFixResultPayload.builder().caption("ok").build());
        AiFixStartRequest request = AiFixStartRequest.builder().contentVersionId(f.versionId()).postId(f.postId()).build();
        aiAssistService.startFix(f.email(), request);
        aiAssistService.startFix(f.email(), request);
        AppException limit = assertThrows(AppException.class, () -> aiAssistService.startFix(f.email(), request));
        assertEquals(ErrorCode.AI_FIX_LIMIT_REACHED, limit.getErrorCode());

        Fixture broke = failedFixture(POLICY);
        doThrow(new AppException(ErrorCode.TOKEN_QUOTA_EXCEEDED)).when(tokenUsageService).checkQuota(any());
        try {
            AppException quota = assertThrows(AppException.class, () -> aiAssistService.startFix(broke.email(),
                    AiFixStartRequest.builder().contentVersionId(broke.versionId()).postId(broke.postId()).build()));
            assertEquals(ErrorCode.TOKEN_QUOTA_EXCEEDED, quota.getErrorCode());
        } finally {
            org.mockito.Mockito.reset(tokenUsageService);
            quotaAvailable();
        }
    }

    @Test
    void fixFromPreCheck_requiresRuleHit() {
        Fixture f = newFixture(UserPlan.PLUS, "Chao buoi sang, chuc ban mot ngay vui");
        transactionTemplate.executeWithoutResult(tx -> postRepository.findById(f.postId()).orElseThrow().getSchedule()
                .setStatus(ScheduleStatus.SCHEDULED)); // bài chưa đăng (cảnh báo trước khi đăng)
        AppException nothing = assertThrows(AppException.class, () -> aiAssistService.startFix(f.email(),
                AiFixStartRequest.builder().contentVersionId(f.versionId()).build()));
        assertEquals(ErrorCode.AI_FIX_NOTHING_TO_FIX, nothing.getErrorCode());
        verify(aiServiceClient, never()).policyFix(any());
    }

    // ================================================================== A2 — kiểm tra chính sách

    @Test
    void policyCheck_harmlessContent_rulesOnly_noAiCall() {
        Fixture f = newFixture(UserPlan.PRO, "Chao buoi sang, chuc ban mot ngay vui");
        PolicyCheckResponse result = check(f);
        assertTrue(result.isEnabled());
        assertTrue(result.getRuleHits().isEmpty());
        assertEquals(PolicyCheckAiStatus.NOT_NEEDED, result.getAiStatus());
        verify(aiServiceClient, never()).policyCheck(any());
    }

    @Test
    void policyCheck_freePlan_rulesWarnButNoAi() {
        Fixture f = newFixture(UserPlan.FREE, RISKY);
        PolicyCheckResponse result = check(f);
        assertFalse(result.getRuleHits().isEmpty());
        assertEquals("REFUND_GUARANTEE", result.getRuleHits().getFirst().getCategory());
        assertEquals(PolicyRiskLevel.HIGH, result.getRuleRisk());
        assertEquals(PolicyCheckAiStatus.PLAN_NOT_INCLUDED, result.getAiStatus());
        verify(aiServiceClient, never()).policyCheck(any());
    }

    @Test
    void policyCheck_flagged_aiOnce_thenCachedByContentHash() {
        Fixture f = newFixture(UserPlan.PLUS, RISKY);
        when(aiServiceClient.policyCheck(any())).thenReturn(PolicyCheckResultPayload.builder()
                .riskLevel("high").summary("Có cam kết hoàn tiền")
                .issues(List.of(PolicyIssuePayload.builder().excerpt("hoàn tiền 100%").reason("refund")
                        .suggestion("Bỏ cam kết").build()))
                .tokensUsed(900L).build());

        PolicyCheckResponse first = check(f);
        assertEquals(PolicyCheckAiStatus.PENDING, first.getAiStatus());
        assertEquals(1, first.getAiChecksUsed());
        assertEquals(5L, first.getAiChecksLimit());
        assertEquals(GenerationJobStatus.SUCCESS, awaitJob(f.email(), first.getJobId()).getStatus());

        PolicyCheckResponse again = check(f);
        assertEquals(PolicyCheckAiStatus.DONE, again.getAiStatus());
        assertEquals(PolicyRiskLevel.HIGH, again.getAi().getRiskLevel());
        assertEquals("Bỏ cam kết", again.getAi().getIssues().getFirst().getSuggestion());
        verify(aiServiceClient, times(1)).policyCheck(any());
        ArgumentCaptor<PolicyCheckPayload> sent = ArgumentCaptor.forClass(PolicyCheckPayload.class);
        verify(aiServiceClient).policyCheck(sent.capture());
        assertFalse(sent.getValue().getRuleHits().isEmpty(), "AI chỉ được gọi kèm nghi vấn của bộ luật");
    }

    @Test
    void policyCheck_disabledInSettings_returnsDisabled() {
        Fixture f = newFixture(UserPlan.PRO, RISKY);
        UUID userId = userRepository.findByEmail(f.email()).orElseThrow().getId();
        UserPublishingSettings settings = settingsRepository.findById(userId).orElseGet(() -> {
            UserPublishingSettings s = new UserPublishingSettings();
            s.setUserId(userId);
            return s;
        });
        settings.setPolicyCheckEnabled(false);
        settingsRepository.save(settings);

        PolicyCheckResponse result = check(f);
        assertFalse(result.isEnabled());
        assertEquals(PolicyCheckAiStatus.DISABLED, result.getAiStatus());
        assertTrue(result.getRuleHits().isEmpty());
        verify(aiServiceClient, never()).policyCheck(any());
    }

    @Test
    void policyCheck_noTokensLeft_quotaExceeded_noAiCall() {
        Fixture f = newFixture(UserPlan.PRO, RISKY + " (het token)");
        when(tokenUsageService.state(any())).thenReturn(new TokenUsageService.QuotaState(1000, 1000L, 0));
        assertEquals(PolicyCheckAiStatus.QUOTA_EXCEEDED, check(f).getAiStatus());
        verify(aiServiceClient, never()).policyCheck(any());
    }

    /** Gói admin tự tạo: giới hạn đọc từ gói của SUBSCRIPTION, không theo nhãn User.plan (PRO). */
    @Test
    void customPlan_limitsComeFromSubscriptionPlan_notFromLabel() {
        Fixture f = newFixture(UserPlan.PRO, RISKY + " (goi tu tao)");
        transactionTemplate.executeWithoutResult(tx -> postRepository.findById(f.postId()).orElseThrow().getSchedule()
                .setStatus(ScheduleStatus.SCHEDULED)); // bài chưa đăng — AI sửa từ cảnh báo trước khi đăng
        Plan team = planRepository.findByCodeAndDeletedAtIsNull("TEAMIT").orElseGet(() -> planRepository.save(
                Plan.builder().code("TEAMIT").nameVi("Team").nameEn("Team").price(0L).isActive(false).build()));
        if (team.getFeatureLimits() == null) {
            team.setFeatureLimits(new PlanFeatureLimits());
        }
        team.getFeatureLimits().setPolicyCheckAiPerPeriod(0);
        team.getFeatureLimits().setAiFixPerVersion(0);
        planRepository.save(team);
        transactionTemplate.executeWithoutResult(tx -> {
            User user = userRepository.findByEmail(f.email()).orElseThrow();
            subscriptionService.getOrCreate(user);
            Subscription subscription = subscriptionRepository.findWithPlanByUserId(user.getId()).orElseThrow();
            subscription.setPlan(team);
            subscription.setPlanSource(PlanSource.ADMIN); // không đồng bộ ngược theo nhãn
            subscriptionRepository.save(subscription);
        });

        PolicyCheckResponse result = check(f);
        assertEquals(PolicyCheckAiStatus.PLAN_NOT_INCLUDED, result.getAiStatus());
        assertEquals(0L, result.getAiChecksLimit());
        AppException fix = assertThrows(AppException.class, () -> aiAssistService.startFix(f.email(),
                AiFixStartRequest.builder().contentVersionId(f.versionId()).build()));
        assertEquals(ErrorCode.AI_FIX_NOT_IN_PLAN, fix.getErrorCode());

        team.getFeatureLimits().setPolicyCheckAiPerPeriod(PlanLimitService.UNLIMITED);
        planRepository.save(team);
        when(aiServiceClient.policyCheck(any())).thenReturn(PolicyCheckResultPayload.builder().riskLevel("low").build());
        PolicyCheckResponse unlimited = check(f);
        assertEquals(PolicyCheckAiStatus.PENDING, unlimited.getAiStatus());
        assertNull(unlimited.getAiChecksLimit(), "-1 = không giới hạn → FE nhận null");
        assertEquals(GenerationJobStatus.SUCCESS, awaitJob(f.email(), unlimited.getJobId()).getStatus());

        AiAssistUsageResponse usage = aiAssistService.getUsage(f.email()).getResult();
        assertEquals("TEAMIT", usage.getPlanCode());
        assertEquals(1, usage.getPolicyCheckAiUsed());
        assertNull(usage.getPolicyCheckAiLimit());
        assertEquals(0L, usage.getAiFixMaxPerVersion());
    }

    // ================================================================== dựng dữ liệu

    private record Fixture(String email, UUID jobId, UUID postId, UUID versionId, String pageId) {
    }

    private PolicyCheckResponse check(Fixture f) {
        return aiAssistService.checkPolicy(f.email(), PolicyCheckRequest.builder().contentVersionId(f.versionId()).build())
                .getResult();
    }

    private Fixture failedFixture(String errorBody) {
        Fixture f = newFixture(UserPlan.FREE, "Xin chao AIMA");
        META.enqueue(json(400, errorBody));
        worker.process(f.jobId());
        assertEquals(PostingJobStatus.FAILED, awaitPosting(f.jobId()).getStatus());
        awaitScheduleFailed(f.postId());
        return f;
    }

    private Fixture newFixture(UserPlan plan, String caption) {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "aiassist-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("AI Assist IT").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(plan).build());

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
        version.setFormattedCaption(caption);
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

        Post post = new Post();
        post.setSchedule(schedule);
        post.setPlatformName(Platform.FACEBOOK);
        post.setStatus(PostStatus.POSTING);
        post.setSnapshotState(PostSnapshotState.CAPTURED);
        post.setSnapshotVersionId(version.getId());
        post.setSnapshotRevision(0);
        post.setSnapshotCaption(caption);
        post.setSnapshotHashtag("aima, test");
        post.setSnapshotCapturedAt(Instant.now());
        post = postRepository.save(post);

        PostingJob job = new PostingJob();
        job.setPost(post);
        job.setRetryCount(0);
        job.setStatus(PostingJobStatus.PENDING);
        job = jobRepository.save(job);
        return new Fixture(email, job.getId(), post.getId(), version.getId(), pageId);
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

    private AiAssistJobResponse awaitJob(String email, UUID jobId) {
        long deadline = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < deadline) {
            AiAssistJobResponse job = aiAssistService.getJob(email, jobId).getResult();
            if (job.getStatus() == GenerationJobStatus.SUCCESS || job.getStatus() == GenerationJobStatus.FAILED) {
                return job;
            }
            sleep();
        }
        return fail("AI job " + jobId + " không kết thúc");
    }

    private PostingJob awaitPosting(UUID jobId) {
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

    private static void sleep() {
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
