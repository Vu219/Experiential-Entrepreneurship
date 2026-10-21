package com.aima.platform;

import com.aima.dto.request.PostScheduleRequest;
import com.aima.dto.request.PostScheduleUpdateRequest;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.Plan;
import com.aima.entity.PlanFeatureLimits;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostScheduleHold;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.HoldReason;
import com.aima.enums.OAuthSkipReason;
import com.aima.enums.PlanSource;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PlanLimitKey;
import com.aima.enums.ReviewStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.SubscriptionChangeCategory;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.exception.PlanLimitException;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PlatformAvailabilityRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.MetaApiClient;
import com.aima.service.PlatformAvailabilityService;
import com.aima.service.PostPublishWorkerService;
import com.aima.service.PostScheduleService;
import com.aima.service.PostingDispatchService;
import com.aima.service.SubscriptionService;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.util.UriComponentsBuilder;

import java.sql.DriverManager;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Khoá nền tảng toàn hệ thống (A) + nền tảng theo gói (B) end-to-end trên PostgreSQL THẬT (stack cô lập :55432, Flyway
 * V1→V21 + Hibernate validate). Mọi lời gọi Meta đi qua {@link MetaApiClient} được MOCK — không gọi Meta thật; verify
 * publisher không bao giờ được gọi khi nền tảng bị khoá. Kịch bản 1a–1h của docs/PLAN_LIMITS_MANUAL_TEST.md.
 * Chạy: {@code -Disolated.postgres=true} (docker compose -f isolated/compose.yml up -d postgres).
 */
@EnabledIfSystemProperty(named = "isolated.postgres", matches = "true")
@SpringBootTest(properties = {
        "meta.app-secret-proof-enabled=false",
        "aima.oauth.state-ttl-minutes=10",
        "aima.oauth.frontend-success-redirect=http://fe/settings?tab=connections",
        "aima.oauth.frontend-error-redirect=http://fe/settings?tab=connections&error=oauth_failed",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
})
class PlatformEntitlementPgTest {

    static final String URL = "jdbc:postgresql://127.0.0.1:55432/aima_isolated";
    static final String SCHEMA = "entitlement_" + UUID.randomUUID().toString().replace("-", "");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
        registry.add("spring.datasource.username", () -> "aima_isolated");
        registry.add("spring.datasource.password", () -> "isolated-only");
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
        // Cổng đóng: lời gọi Meta nào lọt khỏi mock đều hỏng tại chỗ.
        registry.add("meta.graph-base-url", () -> "http://127.0.0.1:9");
        registry.add("meta.threads-base-url", () -> "http://127.0.0.1:9");
    }

    @AfterAll
    static void dropSchema() throws Exception {
        try (var db = DriverManager.getConnection(URL, "aima_isolated", "isolated-only")) {
            db.createStatement().execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }

    @MockitoBean MetaApiClient metaApiClient;
    // Spy (không mock): redisKeyValueAdapter cần ConnectionFactory thật; chỉ thay opsForValue/delete bằng bộ nhớ.
    @MockitoSpyBean RedisTemplate<String, String> redisTemplate;

    @Autowired WebApplicationContext context;
    @Autowired PlatformAvailabilityService availabilityService;
    @Autowired PlatformAvailabilityRepository availabilityRepository;
    @Autowired PostScheduleService scheduleService;
    @Autowired PostingDispatchService dispatchService;
    @Autowired PostPublishWorkerService workerBean;
    @Autowired SubscriptionService subscriptionService;
    @Autowired SubscriptionRepository subscriptionRepository;
    @Autowired PlanRepository planRepository;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired BrandProfileRepository brandProfileRepository;
    @Autowired ContentItemRepository contentItemRepository;
    @Autowired ContentVersionRepository contentVersionRepository;
    @Autowired PlatformAccountRepository accountRepository;
    @Autowired PostScheduleRepository scheduleRepository;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate jdbc;

    MockMvc mvc;
    final Map<String, String> redis = new ConcurrentHashMap<>();
    User admin;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        reset(metaApiClient);
        when(metaApiClient.publishPagePost(anyString(), anyString(), anyString()))
                .thenReturn(new MetaApiClient.MetaPostResult("page_" + UUID.randomUUID()));
        when(metaApiClient.publishThreadsPost(anyString(), anyString()))
                .thenReturn(new MetaApiClient.MetaPostResult("th_" + UUID.randomUUID()));
        // Redis giả trong bộ nhớ (state OAuth + kết quả liên kết).
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        doReturn(ops).when(redisTemplate).opsForValue();
        doAnswer(inv -> redis.put(inv.getArgument(0), inv.getArgument(1))).when(ops).set(anyString(), anyString(), any(Duration.class));
        when(ops.get(any())).thenAnswer(inv -> redis.get((String) inv.getArgument(0)));
        doAnswer(inv -> redis.remove((String) inv.getArgument(0)) != null).when(redisTemplate).delete(anyString());
        // Trạng thái nền tảng như seed V20: chỉ Facebook mở (test nào đổi thì đổi trong test).
        setSystem(Platform.FACEBOOK, true);
        setSystem(Platform.INSTAGRAM, false);
        setSystem(Platform.THREADS, false);
        admin = admin();
    }

    // =========================================================== 1a — giữ lịch một lần sau seed

    @Test
    void s1a_initialSeed_holdsPreExistingThreadsSchedulesOnce_andNotifiesOnce() {
        User user = user(entitlementPlan("FACEBOOK,THREADS", true, -1, -1));
        PlatformAccount threads = account(user, Platform.THREADS, PlatformAccountType.PERSONAL);
        UUID scheduleId = existingSchedule(version(item(user), Platform.THREADS), threads, in(1));
        jdbc.update("delete from platform_availability");
        clearCache();

        int held = availabilityService.seedDefaults();

        assertTrue(held >= 1);
        assertEquals(ScheduleStatus.ON_HOLD, statusOf(scheduleId));
        assertEquals(List.of(HoldReason.PLATFORM_DISABLED), holdsOf(scheduleId));
        assertEquals(1, heldNotifications(user));

        assertEquals(0, availabilityService.seedDefaults(), "chạy lại không seed / không giữ thêm");
        assertEquals(1, heldNotifications(user), "không tạo trùng thông báo");
        assertEquals(List.of(HoldReason.PLATFORM_DISABLED), holdsOf(scheduleId));
    }

    // =========================================================== 1b — tạo / dời / đăng ngay đều bị chặn

    @Test
    void s1b_preConnectedThreadsAccount_createRescheduleAndPublishNow_blockedWith2210() {
        User user = user(entitlementPlan("FACEBOOK,THREADS", true, -1, -1));
        PlatformAccount threads = account(user, Platform.THREADS, PlatformAccountType.PERSONAL);
        ContentItem item = item(user);

        AppException create = assertThrows(AppException.class, () -> scheduleService.create(user.getEmail(),
                PostScheduleRequest.builder().contentVersionId(version(item, Platform.THREADS).getId())
                        .platformAccountId(threads.getId()).scheduledTime(in(1)).build(), null));
        assertEquals(ErrorCode.SCHEDULE_PLATFORM_DISABLED, create.getErrorCode());

        UUID existing = existingSchedule(version(item(user), Platform.THREADS), threads, in(1));
        AppException update = assertThrows(AppException.class, () -> scheduleService.update(user.getEmail(), existing,
                PostScheduleUpdateRequest.builder().scheduledTime(in(2)).build()));
        assertEquals(ErrorCode.SCHEDULE_PLATFORM_DISABLED, update.getErrorCode());

        AppException now = assertThrows(AppException.class, () -> scheduleService.publishNow(user.getEmail(), existing, null));
        assertEquals(ErrorCode.SCHEDULE_PLATFORM_DISABLED, now.getErrorCode());
        verify(metaApiClient, never()).publishThreadsPost(anyString(), anyString());
    }

    // =========================================================== 1c — dispatch + worker không gọi publisher

    @Test
    void s1c_lockedPlatform_dispatchHoldsAndWorkerStopsWithoutCallingPublisher() {
        User user = user(entitlementPlan("FACEBOOK,THREADS", true, -1, -1));
        PlatformAccount threads = account(user, Platform.THREADS, PlatformAccountType.PERSONAL);

        // (1) Dispatcher: lịch đến hạn của nền tảng khoá → ON_HOLD, không tạo job.
        UUID due = existingSchedule(version(item(user), Platform.THREADS), threads, Instant.now().minusSeconds(60));
        PostingDispatchService.Outcome outcome = tx.execute(s -> dispatchService.dispatch(due));
        assertNull(outcome.jobId());
        assertEquals(HoldReason.PLATFORM_DISABLED, outcome.heldFor());
        assertEquals(ScheduleStatus.ON_HOLD, statusOf(due));
        assertEquals(0, jobsOf(due));

        // (2) Worker: job tạo khi nền tảng còn mở, admin khoá trước khi worker nhận → FAILED, không retry, ON_HOLD.
        setSystem(Platform.THREADS, true);
        UUID second = existingSchedule(version(item(user), Platform.THREADS), threads, Instant.now().minusSeconds(60));
        UUID jobId = tx.execute(s -> dispatchService.dispatch(second)).jobId();
        assertNotNull(jobId);
        adminLock(Platform.THREADS);

        worker().process(jobId);

        verify(metaApiClient, never()).publishThreadsPost(anyString(), anyString());
        assertEquals("FAILED", jobStatus(jobId));
        assertEquals(1, jobsOf(second), "không tạo lượt thử lại");
        assertEquals(ScheduleStatus.ON_HOLD, statusOf(second));
        assertTrue(holdsOf(second).contains(HoldReason.PLATFORM_DISABLED));
    }

    // =========================================================== 1d — admin khoá Facebook qua API rồi mở lại

    @Test
    void s1d_adminLocksFacebookViaApi_holdsSchedules_unlockKeepsHold_userResumes_publishesOnce() throws Exception {
        User user = user(entitlementPlan("FACEBOOK", true, -1, -1));
        PlatformAccount page = account(user, Platform.FACEBOOK, PlatformAccountType.PAGE);
        UUID a = existingSchedule(version(item(user), Platform.FACEBOOK), page, in(1));
        UUID b = existingSchedule(version(item(user), Platform.FACEBOOK), page, in(2));
        long before = pendingOf(Platform.FACEBOOK);

        // Thiếu lý do → 2212; user thường → 403.
        mvc.perform(put("/admin/platforms/FACEBOOK/availability").with(asAdmin()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(2212));
        mvc.perform(put("/admin/platforms/FACEBOOK/availability").with(asUser(user)).contentType(MediaType.APPLICATION_JSON)
                        .content(lockBody()))
                .andExpect(status().isForbidden());

        mvc.perform(get("/admin/platforms/availability").with(asAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result[?(@.platform=='FACEBOOK')].pendingSchedules").value((int) before));
        mvc.perform(put("/admin/platforms/FACEBOOK/availability").with(asAdmin()).contentType(MediaType.APPLICATION_JSON)
                        .content(lockBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.connectionEnabled").value(false))
                .andExpect(jsonPath("$.result.heldSchedules").value((int) before));
        assertEquals(ScheduleStatus.ON_HOLD, statusOf(a));
        assertEquals(ScheduleStatus.ON_HOLD, statusOf(b));
        assertEquals(1, heldNotifications(user), "một thông báo gộp / user");
        mvc.perform(get("/connections").with(asUser(user)))
                .andExpect(jsonPath("$.result[0].locked").value(true))
                .andExpect(jsonPath("$.result[0].lockReason").value("PLATFORM_DISABLED"));
        mvc.perform(get("/connections/platforms").with(asUser(user)))
                .andExpect(jsonPath("$.result.platforms[0].platform").value("FACEBOOK"))
                .andExpect(jsonPath("$.result.platforms[0].usable").value(false))
                .andExpect(jsonPath("$.result.platforms[0].reasonVi").value("Bảo trì"));

        // Mở lại: tài khoản hết khoá, lịch VẪN ON_HOLD (không tự đăng lại).
        mvc.perform(put("/admin/platforms/FACEBOOK/availability").with(asAdmin()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.result.connectionEnabled").value(true));
        mvc.perform(get("/connections").with(asUser(user))).andExpect(jsonPath("$.result[0].locked").value(false));
        assertEquals(ScheduleStatus.ON_HOLD, statusOf(a));
        assertEquals(List.of(HoldReason.PLATFORM_DISABLED), holdsOf(a));

        // User tiếp tục lịch a (giờ mới) → SCHEDULED → đăng được: publisher gọi ĐÚNG một lần.
        scheduleService.update(user.getEmail(), a, PostScheduleUpdateRequest.builder().scheduledTime(in(1)).build());
        assertEquals(ScheduleStatus.SCHEDULED, statusOf(a));
        assertEquals(List.of(), holdsOf(a));
        UUID jobId = tx.execute(s -> dispatchService.dispatch(a)).jobId();
        worker().process(jobId);
        verify(metaApiClient, times(1)).publishPagePost(anyString(), anyString(), anyString());
        assertEquals(ScheduleStatus.POSTED, statusOf(a));
        assertEquals(ScheduleStatus.ON_HOLD, statusOf(b), "lịch chưa tiếp tục vẫn giữ");
    }

    // =========================================================== 1e — worker đọc thẳng DB, không tin cache

    @Test
    void s1e_lockWhileWorkerRunning_finalCheckReadsDatabaseNotCache() {
        User user = user(entitlementPlan("FACEBOOK,THREADS", true, -1, -1));
        setSystem(Platform.THREADS, true);
        PlatformAccount threads = account(user, Platform.THREADS, PlatformAccountType.PERSONAL);
        UUID scheduleId = existingSchedule(version(item(user), Platform.THREADS), threads, Instant.now().minusSeconds(60));
        assertTrue(availabilityService.isEnabled(Platform.THREADS)); // nạp cache 30s
        UUID jobId = tx.execute(s -> dispatchService.dispatch(scheduleId)).jobId();
        assertNotNull(jobId);

        // Khoá thẳng trong DB (vd instance khác khoá) — cache của instance này CHƯA hết hạn, vẫn báo "mở".
        jdbc.update("update platform_availability set connection_enabled = false where platform = 'THREADS'");
        assertTrue(availabilityService.isEnabled(Platform.THREADS), "cache vẫn cũ");

        worker().process(jobId);

        verify(metaApiClient, never()).publishThreadsPost(anyString(), anyString());
        assertEquals("FAILED", jobStatus(jobId));
        assertEquals(ScheduleStatus.ON_HOLD, statusOf(scheduleId));
        assertTrue(holdsOf(scheduleId).contains(HoldReason.PLATFORM_DISABLED));
    }

    // =========================================================== 1f — nền tảng ngoài gói

    @Test
    void s1f_platformNotInPlan_oauthSkipsChannel_createBlocked2206_downgradeHolds() throws Exception {
        setSystem(Platform.INSTAGRAM, true);
        setSystem(Platform.THREADS, true);
        User user = user(entitlementPlan("FACEBOOK", true, -1, -1));

        // OAuth callback Facebook: Trang được thêm, IG con bị bỏ vì gói không gồm Instagram.
        stubFacebookOAuth("page-1", "ig-1");
        redis.put("oauth_state:st-1", user.getId() + "|FACEBOOK");
        MvcResult callback = mvc.perform(get("/connections/facebook/callback").param("code", "c").param("state", "st-1"))
                .andExpect(status().isFound()).andReturn();
        String location = callback.getResponse().getRedirectedUrl();
        String resultId = UriComponentsBuilder.fromUriString(location).build().getQueryParams().getFirst("result");
        assertNotNull(resultId, location);
        mvc.perform(get("/connections/oauth-results/" + resultId).with(asUser(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.skipped[0].platform").value("INSTAGRAM"))
                .andExpect(jsonPath("$.result.skipped[0].reason").value(OAuthSkipReason.PLAN_PLATFORM.name()));
        User stranger = user(entitlementPlan("FACEBOOK", true, -1, -1));
        mvc.perform(get("/connections/oauth-results/" + resultId).with(asUser(stranger)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value(2213));

        // Tạo lịch Threads với gói không gồm Threads → 2206 (ALLOWED_PLATFORMS + platform).
        PlatformAccount threads = account(user, Platform.THREADS, PlatformAccountType.PERSONAL);
        PlanLimitException create = assertThrows(PlanLimitException.class, () -> scheduleService.create(user.getEmail(),
                PostScheduleRequest.builder().contentVersionId(version(item(user), Platform.THREADS).getId())
                        .platformAccountId(threads.getId()).scheduledTime(in(1)).build(), null));
        assertEquals(ErrorCode.PLAN_FEATURE_NOT_INCLUDED, create.getErrorCode());
        assertEquals(PlanLimitKey.ALLOWED_PLATFORMS, create.getDetail().getLimitKey());
        assertEquals(Platform.THREADS, create.getDetail().getPlatform());

        // Hạ gói: gói có Threads → Free (chỉ Facebook) → lịch Threads ON_HOLD (PLAN_PLATFORM_EXCLUDED).
        User pro = user(entitlementPlan("FACEBOOK,THREADS", true, -1, -1));
        PlatformAccount proThreads = account(pro, Platform.THREADS, PlatformAccountType.PERSONAL);
        UUID scheduled = existingSchedule(version(item(pro), Platform.THREADS), proThreads, in(1));
        tx.executeWithoutResult(s -> subscriptionService.revokeToFree(userRepository.findById(pro.getId()).orElseThrow(),
                LocalDateTime.now(), new SubscriptionService.AdminChange(admin.getId(), admin.getEmail(),
                        SubscriptionChangeCategory.SUPPORT, "e2e")));
        assertEquals(ScheduleStatus.ON_HOLD, statusOf(scheduled));
        assertEquals(List.of(HoldReason.PLAN_PLATFORM_EXCLUDED), holdsOf(scheduled));
        assertEquals(1, heldNotifications(pro));
    }

    // =========================================================== 1g — hạ gói / hết hạn lười

    @Test
    void s1g_lazyExpiryToFreeWithoutScheduling_oldProScheduleNeverPublishes() {
        Plan free = planRepository.findByCodeAndDeletedAtIsNull("FREE").orElseThrow();
        Boolean freeScheduling = free.getFeatureLimits().getScheduling();
        tx.executeWithoutResult(s -> {
            Plan f = planRepository.findByCodeAndDeletedAtIsNull("FREE").orElseThrow();
            f.getFeatureLimits().setScheduling(false); // gói Free tắt lên lịch cho kịch bản này
            planRepository.save(f);
        });
        try {
            User user = user(entitlementPlan("FACEBOOK", true, -1, -1));
            PlatformAccount page = account(user, Platform.FACEBOOK, PlatformAccountType.PAGE);
            UUID due = existingSchedule(version(item(user), Platform.FACEBOOK), page, Instant.now().minusSeconds(60));
            // Gói trả tiền đã hết hạn — chưa job nào hạ: dispatcher tự hạ lười rồi chặn.
            tx.executeWithoutResult(s -> {
                Subscription sub = subscriptionRepository.findWithPlanByUserId(user.getId()).orElseThrow();
                sub.setPlanExpiresAt(LocalDateTime.now().minusMinutes(5));
                subscriptionRepository.save(sub);
            });

            PostingDispatchService.Outcome outcome = tx.execute(s -> dispatchService.dispatch(due));

            assertNull(outcome.jobId());
            assertEquals(HoldReason.PLAN_SCHEDULING_DISABLED, outcome.heldFor());
            assertEquals(ScheduleStatus.ON_HOLD, statusOf(due));
            assertTrue(holdsOf(due).contains(HoldReason.PLAN_SCHEDULING_DISABLED));
            assertEquals("FREE", tx.execute(s -> subscriptionRepository.findWithPlanByUserId(user.getId())
                    .orElseThrow().getPlan().getCode()));
            verify(metaApiClient, never()).publishPagePost(anyString(), anyString(), anyString());
        } finally {
            tx.executeWithoutResult(s -> {
                Plan f = planRepository.findByCodeAndDeletedAtIsNull("FREE").orElseThrow();
                f.getFeatureLimits().setScheduling(freeScheduling);
                planRepository.save(f);
            });
        }
    }

    // =========================================================== 1h — lịch hệ thống giữ không chiếm ACTIVE_SCHEDULES

    @Test
    void s1h_systemHeldSchedulesFreeTheQueue_resumeRechecksQuotaAndHorizon() {
        User user = user(entitlementPlan("FACEBOOK,THREADS", true, 1, 7));
        PlatformAccount threads = account(user, Platform.THREADS, PlatformAccountType.PERSONAL);
        PlatformAccount page = account(user, Platform.FACEBOOK, PlatformAccountType.PAGE);
        setSystem(Platform.THREADS, true);
        UUID held = existingSchedule(version(item(user), Platform.THREADS), threads, in(1));
        adminLock(Platform.THREADS);
        assertEquals(List.of(HoldReason.PLATFORM_DISABLED), holdsOf(held));

        // Hàng chờ 1 chỗ: lịch hệ thống giữ không chiếm chỗ → tạo được một lịch Facebook.
        assertDoesNotThrow(() -> scheduleService.create(user.getEmail(), PostScheduleRequest.builder()
                .contentVersionId(version(item(user), Platform.FACEBOOK).getId()).platformAccountId(page.getId())
                .scheduledTime(in(1)).build(), null));

        // Mở lại Threads; tiếp tục lịch giữ: hàng chờ đã đầy → 2205 ACTIVE_SCHEDULES; quá số ngày → 2205 HORIZON.
        adminUnlock(Platform.THREADS);
        PlanLimitException quota = assertThrows(PlanLimitException.class, () -> scheduleService.update(user.getEmail(), held,
                PostScheduleUpdateRequest.builder().scheduledTime(in(2)).build()));
        assertEquals(PlanLimitKey.ACTIVE_SCHEDULES, quota.getDetail().getLimitKey());
        PlanLimitException horizon = assertThrows(PlanLimitException.class, () -> scheduleService.update(user.getEmail(),
                held, PostScheduleUpdateRequest.builder().scheduledTime(in(30)).build()));
        assertEquals(PlanLimitKey.SCHEDULE_HORIZON_DAYS, horizon.getDetail().getLimitKey());
        assertEquals(List.of(HoldReason.PLATFORM_DISABLED), holdsOf(held), "bị từ chối thì vẫn giữ nguyên lý do");
    }

    // ================================================================== helpers

    private PostPublishWorkerService worker() {
        return AopTestUtils.getTargetObject(workerBean); // gọi đồng bộ, bỏ proxy @Async
    }

    private void setSystem(Platform platform, boolean enabled) {
        jdbc.update("update platform_availability set connection_enabled = ?, reason_vi = null, reason_en = null "
                + "where platform = ?", enabled, platform.name());
        clearCache();
    }

    @SuppressWarnings("unchecked")
    private void clearCache() {
        Object target = AopTestUtils.getTargetObject(availabilityService);
        ((Map<Platform, ?>) ReflectionTestUtils.getField(target, "cache")).clear();
    }

    private void adminLock(Platform platform) {
        availabilityService.update(platform, com.aima.dto.request.PlatformAvailabilityRequest.builder().enabled(false)
                .reasonVi("Bảo trì").reasonEn("Maintenance").build(), admin.getEmail());
    }

    private void adminUnlock(Platform platform) {
        availabilityService.update(platform, com.aima.dto.request.PlatformAvailabilityRequest.builder().enabled(true)
                .build(), admin.getEmail());
    }

    private static String lockBody() {
        return "{\"enabled\":false,\"reasonVi\":\"Bảo trì\",\"reasonEn\":\"Maintenance\"}";
    }

    private RequestPostProcessor asAdmin() {
        return SecurityMockMvcRequestPostProcessors.user(admin.getEmail()).roles("ADMIN");
    }

    private static RequestPostProcessor asUser(User user) {
        return SecurityMockMvcRequestPostProcessors.user(user.getEmail()).roles("USER");
    }

    private void stubFacebookOAuth(String pageId, String igId) {
        when(metaApiClient.exchangeCodeForToken(eq(Platform.FACEBOOK), anyString()))
                .thenReturn(new MetaApiClient.MetaTokenResult("short", 3600L));
        when(metaApiClient.getLongLivedUserToken(eq(Platform.FACEBOOK), anyString()))
                .thenReturn(new MetaApiClient.MetaTokenResult("long", 5_000_000L));
        when(metaApiClient.getGrantedPermissions(anyString())).thenReturn(List.of("pages_show_list", "pages_manage_posts"));
        when(metaApiClient.getMe(eq(Platform.FACEBOOK), anyString()))
                .thenReturn(new MetaApiClient.MetaUser("fbuser-" + UUID.randomUUID(), "FB User", null, null));
        when(metaApiClient.getMyAccounts(anyString()))
                .thenReturn(List.of(new MetaApiClient.MetaPage(pageId, "Trang E2E", "ptok", null)));
        when(metaApiClient.getInstagramBusinessAccount(eq(pageId), anyString()))
                .thenReturn(Optional.of(new MetaApiClient.MetaIgAccount(igId, "brand_ig", "Brand IG", null)));
    }

    /** Gói tự tạo đủ giới hạn — chỉ đổi nền tảng / lên lịch / hàng chờ / số ngày cho từng kịch bản. */
    private Plan entitlementPlan(String platforms, boolean scheduling, int activeSchedules, int horizonDays) {
        PlanFeatureLimits limits = PlanFeatureLimits.builder()
                .brandProfiles(-1).strategiesPerBrand(-1).connectedChannels(-1).allowedPlatforms(platforms)
                .trendResearchPerPeriod(-1).autoTrendResearch(true).ideasPerResearch(-1)
                .scheduling(scheduling).scheduledPostsPerPeriod(-1).activeSchedules(activeSchedules)
                .scheduleHorizonDays(horizonDays).goldenHours(true).analyticsHistoryDays(-1).analyticsAdvanced(true)
                .analyticsExport(true).strategyOptimizationPerPeriod(-1).policyCheckAiPerPeriod(-1).aiFixPerVersion(-1)
                .build();
        return planRepository.save(Plan.builder().code("E2E" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .nameVi("E2E").nameEn("E2E").price(0L).isActive(false).featureLimits(limits).build());
    }

    /** User ở gói {@code plan} (nguồn ADMIN — không bị nhãn User.plan đồng bộ ngược). */
    private User user(Plan plan) {
        String email = "ent-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder().username(email).email(email).fullName("E2E").password("{noop}x")
                .role(roleRepository.findByRoleName("USER").orElseThrow())
                .status(UserStatus.ACTIVE).plan(UserPlan.PRO).build());
        tx.executeWithoutResult(s -> {
            subscriptionService.getOrCreate(userRepository.findById(user.getId()).orElseThrow());
            Subscription sub = subscriptionRepository.findWithPlanByUserId(user.getId()).orElseThrow();
            sub.setPlan(planRepository.findById(plan.getId()).orElseThrow());
            sub.setPlanSource(PlanSource.ADMIN);
            sub.setPlanStartedAt(LocalDateTime.now());
            sub.setPlanExpiresAt(LocalDateTime.now().plusMonths(1));
            subscriptionRepository.save(sub);
        });
        return user;
    }

    private User admin() {
        return userRepository.findByEmail("e2e-admin@it.local").orElseGet(() -> userRepository.save(User.builder()
                .username("e2e-admin@it.local").email("e2e-admin@it.local").fullName("Admin").password("{noop}x")
                .role(roleRepository.findByRoleName("ADMIN").orElseThrow())
                .status(UserStatus.ACTIVE).plan(UserPlan.FREE).build()));
    }

    private ContentItem item(User owner) {
        BrandProfile brand = new BrandProfile();
        brand.setUser(owner);
        brand.setBrandName("Brand E2E");
        brand.setIndustry("Beauty");
        brand.setTargetAudience("Everyone");
        brandProfileRepository.save(brand);
        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.setReviewStatus(ReviewStatus.NONE);
        item.applyResolvedStatus(ContentItemStatus.FORMATTED);
        return contentItemRepository.save(item);
    }

    private ContentVersion version(ContentItem item, Platform platform) {
        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(platform);
        version.setFormattedCaption("Caption " + UUID.randomUUID());
        version.setStatus(ContentVersionStatus.FORMATTED);
        return contentVersionRepository.save(version);
    }

    private PlatformAccount account(User owner, Platform platform, PlatformAccountType type) {
        PlatformAccount a = new PlatformAccount();
        a.setUser(owner);
        a.setPlatformName(platform);
        a.setPlatformAccountId(platform + "-" + UUID.randomUUID());
        a.setAccountName("E2E " + platform);
        a.setAccountType(type);
        a.setTokenType(type == PlatformAccountType.PAGE ? TokenType.PAGE_TOKEN : TokenType.LONG_LIVED_USER_TOKEN);
        a.setAccessToken("fake-token");
        a.setConnectionStatus(ConnectionStatus.ACTIVE);
        return accountRepository.save(a);
    }

    /** Lịch có TỪ TRƯỚC (vd trước khi nền tảng bị khoá) — ghi thẳng, không qua API lên lịch. */
    private UUID existingSchedule(ContentVersion version, PlatformAccount account, Instant time) {
        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setPlatformAccount(account);
        schedule.setScheduledTime(time);
        schedule.setStatus(ScheduleStatus.SCHEDULED);
        return scheduleRepository.save(schedule).getId();
    }

    private ScheduleStatus statusOf(UUID scheduleId) {
        return tx.execute(s -> scheduleRepository.findById(scheduleId).orElseThrow().getStatus());
    }

    private List<HoldReason> holdsOf(UUID scheduleId) {
        return tx.execute(s -> scheduleRepository.findById(scheduleId).orElseThrow().getHolds().stream()
                .map(PostScheduleHold::getReason).sorted().toList());
    }

    private long heldNotifications(User user) {
        return jdbc.queryForObject("select count(*) from notifications where user_id = ? and type = 'SCHEDULE_HELD'",
                Long.class, user.getId());
    }

    private long jobsOf(UUID scheduleId) {
        return jdbc.queryForObject("select count(*) from posting_jobs j join posts p on p.id = j.post_id "
                + "where p.schedule_id = ?", Long.class, scheduleId);
    }

    private String jobStatus(UUID jobId) {
        return jdbc.queryForObject("select status from posting_jobs where id = ?", String.class, jobId);
    }

    private long pendingOf(Platform platform) {
        return jdbc.queryForObject("select count(*) from post_schedules s join platform_accounts a on a.id = s.platform_account_id "
                + "where a.platform_name = ? and a.deleted_at is null and s.deleted_at is null "
                + "and s.status in ('SCHEDULED','ON_HOLD')", Long.class, platform.name());
    }

    private static Instant in(int days) {
        return Instant.now().plus(Duration.ofDays(days)).truncatedTo(ChronoUnit.SECONDS);
    }
}
