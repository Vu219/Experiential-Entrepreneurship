package com.aima.platform;

import com.aima.dto.request.BrandProfileRequest;
import com.aima.dto.request.PostScheduleRequest;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentStrategy;
import com.aima.entity.ContentVersion;
import com.aima.entity.Plan;
import com.aima.entity.PlatformAccount;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PlanLimitKey;
import com.aima.enums.PlanSource;
import com.aima.enums.ReviewStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.ErrorCode;
import com.aima.exception.PlanLimitException;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.BrandProfileService;
import com.aima.service.PlanUsageService;
import com.aima.service.PostScheduleService;
import com.aima.service.SubscriptionService;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

import java.sql.DriverManager;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Giới hạn gói qua API thật trên PostgreSQL cô lập (kịch bản 1i): envelope 2205/2206 (HTTP 403 + result), hai request
 * song song tranh lượt cuối, GET /users/me/plan-usage, kỳ tính lượt theo chu kỳ thanh toán, lịch tái sử dụng tính lượt
 * mới, user vừa hết hạn gọi /analytics/* đầu tiên (transaction read-only), gói tự tạo thiếu giới hạn (2211).
 * Chạy: {@code -Disolated.postgres=true}.
 */
@EnabledIfSystemProperty(named = "isolated.postgres", matches = "true")
@SpringBootTest(properties = {
        "meta.app-secret-proof-enabled=false",
        "meta.graph-base-url=http://127.0.0.1:9",
        "meta.threads-base-url=http://127.0.0.1:9",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
})
class PlanLimitsApiPgTest {

    static final String URL = "jdbc:postgresql://127.0.0.1:55432/aima_isolated";
    static final String SCHEMA = "planlimits_" + UUID.randomUUID().toString().replace("-", "");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
        registry.add("spring.datasource.username", () -> "aima_isolated");
        registry.add("spring.datasource.password", () -> "isolated-only");
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
    }

    @AfterAll
    static void dropSchema() throws Exception {
        try (var db = DriverManager.getConnection(URL, "aima_isolated", "isolated-only")) {
            db.createStatement().execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }

    @Autowired WebApplicationContext context;
    @Autowired BrandProfileService brandProfileService;
    @Autowired PostScheduleService scheduleService;
    @Autowired PlanUsageService planUsageService;
    @Autowired SubscriptionService subscriptionService;
    @Autowired SubscriptionRepository subscriptionRepository;
    @Autowired PlanRepository planRepository;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired BrandProfileRepository brandProfileRepository;
    @Autowired ContentStrategyRepository strategyRepository;
    @Autowired ContentItemRepository contentItemRepository;
    @Autowired ContentVersionRepository contentVersionRepository;
    @Autowired PlatformAccountRepository accountRepository;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate jdbc;

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    // ------------------------------------------------------------------ envelope 2205 / 2206

    @Test
    void quotaReached_isHttp403_code2205_withViolationDetail() throws Exception {
        User user = user(UserPlan.FREE);
        String body = "{\"brandName\":\"A\",\"industry\":\"Food\",\"targetAudience\":\"All\",\"platforms\":[\"FACEBOOK\"]}";

        mvc.perform(post("/brand-profiles").with(as(user)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        mvc.perform(post("/brand-profiles").with(as(user)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.PLAN_LIMIT_REACHED.getCode()))
                .andExpect(jsonPath("$.result.limitKey").value("BRAND_PROFILES"))
                .andExpect(jsonPath("$.result.limit").value(1))
                .andExpect(jsonPath("$.result.used").value(1))
                .andExpect(jsonPath("$.result.planCode").value("FREE"));
    }

    @Test
    void featureNotIncluded_isHttp403_code2206() throws Exception {
        User user = user(UserPlan.FREE); // Free không gồm giờ vàng
        mvc.perform(get("/schedules/golden-hours").param("platform", "FACEBOOK").with(as(user)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.PLAN_FEATURE_NOT_INCLUDED.getCode()))
                .andExpect(jsonPath("$.result.limitKey").value("GOLDEN_HOURS"));
    }

    // ------------------------------------------------------------------ request song song

    @Test
    void concurrentRequests_onlyOneTakesTheLastSlot() throws Exception {
        User user = user(UserPlan.FREE); // 1 hồ sơ
        ExecutorService pool = Executors.newFixedThreadPool(4);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> results = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            int n = i;
            results.add(pool.submit(() -> {
                start.await();
                try {
                    brandProfileService.create(user.getEmail(), BrandProfileRequest.builder().brandName("B" + n)
                            .industry("Food").targetAudience("All").platforms(Set.of(Platform.FACEBOOK)).build());
                    return true;
                } catch (PlanLimitException e) {
                    assertEquals(ErrorCode.PLAN_LIMIT_REACHED, e.getErrorCode());
                    return false;
                }
            }));
        }
        start.countDown();
        int succeeded = 0;
        for (Future<Boolean> f : results) {
            if (f.get()) succeeded++;
        }
        pool.shutdown();
        assertEquals(1, succeeded, "khoá dòng subscription: chỉ một request lấy được lượt cuối");
        assertEquals(1, brandProfileRepository.countByUser_IdAndDeletedAtIsNull(user.getId()));
    }

    // ------------------------------------------------------------------ plan-usage

    @Test
    void planUsage_reportsPerBrandScopes_platforms_andPolicyUsage() throws Exception {
        User user = user(UserPlan.FREE);
        BrandProfile brand = brand(user);
        ContentStrategy strategy = new ContentStrategy();
        strategy.setBrandProfile(brand);
        strategy.setName("S");
        strategy.setFrequencyCount(3);
        strategyRepository.save(strategy);

        mvc.perform(get("/users/me/plan-usage").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.planCode").value("FREE"))
                .andExpect(jsonPath("$.result.items[?(@.key=='STRATEGIES_PER_BRAND')].scopes[0].used").value(1))
                .andExpect(jsonPath("$.result.items[?(@.key=='STRATEGIES_PER_BRAND')].scopes[0].scopeName").value("Brand"))
                .andExpect(jsonPath("$.result.items[?(@.key=='ALLOWED_PLATFORMS')].platforms[0]").value("FACEBOOK"))
                .andExpect(jsonPath("$.result.items[?(@.key=='POLICY_CHECK_AI_PER_PERIOD')].used").value(0))
                .andExpect(jsonPath("$.result.items[?(@.key=='BRAND_PROFILES')].used").value(1));
    }

    // ------------------------------------------------------------------ kỳ tính lượt theo chu kỳ thanh toán

    @Test
    void paidActivation_restartsPeriodFromActivation_sameplanRenewalKeepsIt() {
        User user = user(UserPlan.FREE);
        Plan plus = planRepository.findByCodeAndDeletedAtIsNull("PLUS").orElseThrow();
        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);

        Subscription first = tx.execute(s -> subscriptionService.activatePaidPlan(reload(user), plus, now));
        assertEquals(now, first.getCurrentPeriodStart());
        assertEquals(now.plusMonths(1), first.getCurrentPeriodEnd());
        assertEquals(now, first.getPeriodAnchorAt());

        LocalDateTime later = now.plusDays(10);
        Subscription renewed = tx.execute(s -> subscriptionService.activatePaidPlan(reload(user), plus, later));
        assertEquals(now, renewed.getCurrentPeriodStart(), "gia hạn cùng gói khi còn hạn không reset lượt");
        assertEquals(now.plusMonths(2), renewed.getPlanExpiresAt());
    }

    // ------------------------------------------------------------------ lịch CANCELLED tái sử dụng = lượt mới

    @Test
    void reusedCancelledSchedule_countsAsNewUseInCurrentPeriod() {
        User user = user(UserPlan.FREE);
        PlatformAccount page = page(user);
        ContentVersion version = version(item(brand(user)));
        UUID id = scheduleService.create(user.getEmail(), PostScheduleRequest.builder().contentVersionId(version.getId())
                .platformAccountId(page.getId()).scheduledTime(in(1)).build(), null).getResult().getId();
        scheduleService.cancel(user.getEmail(), id);
        // Lịch tạo từ 2 tháng trước (kỳ cũ) rồi bị huỷ — trước V20 lên lại không tốn lượt kỳ này.
        jdbc.update("update post_schedules set created_at = ?, counted_at = ? where id = ?",
                LocalDateTime.now().minusMonths(2), LocalDateTime.now().minusMonths(2), id);
        assertEquals(0, planUsageService.usage(reload(user), PlanLimitKey.SCHEDULED_POSTS_PER_PERIOD).used());

        UUID reused = scheduleService.create(user.getEmail(), PostScheduleRequest.builder().contentVersionId(version.getId())
                .platformAccountId(page.getId()).scheduledTime(in(1)).build(), null).getResult().getId();

        assertEquals(id, reused, "bản ghi lịch được tái sử dụng");
        assertEquals(1, planUsageService.usage(reload(user), PlanLimitKey.SCHEDULED_POSTS_PER_PERIOD).used());
    }

    // ------------------------------------------------------------------ analytics: user vừa hết hạn, read-only

    @Test
    void expiredUser_firstCallIsAnalytics_readOnlyTransactionDowngradesSafely() throws Exception {
        User user = user(UserPlan.PRO);
        tx.executeWithoutResult(s -> {
            subscriptionService.getOrCreate(reload(user));
            Subscription sub = subscriptionRepository.findWithPlanByUserId(user.getId()).orElseThrow();
            sub.setPlan(planRepository.findByCodeAndDeletedAtIsNull("PRO").orElseThrow());
            sub.setPlanSource(PlanSource.PAYMENT);
            sub.setPlanExpiresAt(LocalDateTime.now().minusMinutes(1));
            subscriptionRepository.save(sub);
        });

        mvc.perform(get("/analytics/summary").with(as(user))).andExpect(status().isOk());
        mvc.perform(get("/analytics/posts").with(as(user))).andExpect(status().isOk());

        assertEquals("FREE", tx.execute(s -> subscriptionRepository.findWithPlanByUserId(user.getId())
                .orElseThrow().getPlan().getCode()), "hết hạn được hạ (ghi ở transaction riêng) dù vào từ read-only");
    }

    // ------------------------------------------------------------------ admin: gói tự tạo thiếu giới hạn

    @Test
    void adminCreatesCustomPlanWithoutAllLimits_rejected2211() throws Exception {
        User admin = userRepository.save(User.builder().username("adm-" + UUID.randomUUID()).email("adm-" + UUID.randomUUID() + "@it.local")
                .fullName("Admin").password("{noop}x").role(roleRepository.findByRoleName("ADMIN").orElseThrow())
                .status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        mvc.perform(post("/admin/plans").with(SecurityMockMvcRequestPostProcessors.user(admin.getEmail()).roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"TEAM\",\"nameVi\":\"Team\",\"nameEn\":\"Team\",\"price\":0,"
                                + "\"billingIntervalMonths\":1,\"featureLimits\":{\"brandProfiles\":3}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.PLAN_LIMIT_VALUE_REQUIRED.getCode()));
    }

    // ================================================================== helpers

    private static RequestPostProcessor as(User user) {
        return SecurityMockMvcRequestPostProcessors.user(user.getEmail()).roles("USER");
    }

    private User reload(User user) {
        return userRepository.findById(user.getId()).orElseThrow();
    }

    private User user(UserPlan plan) {
        String email = "pl-" + UUID.randomUUID() + "@it.local";
        return userRepository.save(User.builder().username(email).email(email).fullName("PL").password("{noop}x")
                .role(roleRepository.findByRoleName("USER").orElseThrow())
                .status(UserStatus.ACTIVE).plan(plan).build());
    }

    private BrandProfile brand(User owner) {
        BrandProfile b = new BrandProfile();
        b.setUser(owner);
        b.setBrandName("Brand");
        b.setIndustry("Beauty");
        b.setTargetAudience("Everyone");
        return brandProfileRepository.save(b);
    }

    private ContentItem item(BrandProfile brand) {
        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.setReviewStatus(ReviewStatus.NONE);
        item.applyResolvedStatus(ContentItemStatus.FORMATTED);
        return contentItemRepository.save(item);
    }

    private ContentVersion version(ContentItem item) {
        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(Platform.FACEBOOK);
        version.setFormattedCaption("Caption " + UUID.randomUUID());
        version.setStatus(ContentVersionStatus.FORMATTED);
        return contentVersionRepository.save(version);
    }

    private PlatformAccount page(User owner) {
        PlatformAccount a = new PlatformAccount();
        a.setUser(owner);
        a.setPlatformName(Platform.FACEBOOK);
        a.setPlatformAccountId("FB-" + UUID.randomUUID());
        a.setAccountName("Page");
        a.setAccountType(PlatformAccountType.PAGE);
        a.setTokenType(TokenType.PAGE_TOKEN);
        a.setAccessToken("fake-token");
        a.setConnectionStatus(ConnectionStatus.ACTIVE);
        return accountRepository.save(a);
    }

    private static Instant in(int days) {
        return Instant.now().plus(Duration.ofDays(days)).truncatedTo(ChronoUnit.SECONDS);
    }
}
