package com.aima.service.Impl;

import com.aima.entity.Plan;
import com.aima.entity.PlanFeatureLimits;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.Platform;
import com.aima.enums.PlanLimitKey;
import com.aima.enums.UserPlan;
import com.aima.repository.PlanRepository;
import com.aima.service.PlanLimitService;
import com.aima.service.PlanLimitService.FeatureLimits;
import com.aima.service.SubscriptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Giới hạn AI theo gói (V15, nay là khoá POLICY_CHECK_AI_PER_PERIOD / AI_FIX_PER_VERSION của PlanLimitKey): null = mặc
 * định hệ thống, -1 = không giới hạn, 0 = tắt; gói lấy từ subscription (gói admin tự tạo cũng có giới hạn riêng), không
 * so tên gói. Fail-closed: không tra được gói → giới hạn gói FREE lõi.
 */
class PlanLimitServiceImplTest {

    private SubscriptionService subscriptionService;
    private PlanRepository planRepository;
    private MockEnvironment environment;
    private PlanLimitServiceImpl service;
    private final User user = User.builder().plan(UserPlan.PLUS).build();

    @BeforeEach
    void setUp() {
        subscriptionService = mock(SubscriptionService.class);
        planRepository = mock(PlanRepository.class);
        environment = new MockEnvironment();
        service = newService();
    }

    private PlanLimitServiceImpl newService() {
        PlanLimitServiceImpl s = new PlanLimitServiceImpl(subscriptionService, planRepository, environment);
        ReflectionTestUtils.setField(s, "policyCheckDefault", 10);
        ReflectionTestUtils.setField(s, "aiFixDefault", 3);
        ReflectionTestUtils.invokeMethod(s, "readLegacyEnv");
        return s;
    }

    private void subscribedTo(Plan plan) {
        when(subscriptionService.getOrCreate(any())).thenReturn(Subscription.builder().plan(plan).build());
    }

    private static Plan plan(String code, Integer policyCheck, Integer aiFix) {
        return Plan.builder().code(code).featureLimits(PlanFeatureLimits.builder()
                .policyCheckAiPerPeriod(policyCheck).aiFixPerVersion(aiFix).build()).build();
    }

    private static Long policy(FeatureLimits limits) {
        return limits.limit(PlanLimitKey.POLICY_CHECK_AI_PER_PERIOD);
    }

    private static Long aiFix(FeatureLimits limits) {
        return limits.limit(PlanLimitKey.AI_FIX_PER_VERSION);
    }

    @Test
    void planWithValues_usesThePlanValues() {
        subscribedTo(plan("TEAM", 75, 5));

        FeatureLimits limits = service.features(user);
        assertEquals("TEAM", limits.planCode());
        assertEquals(75L, policy(limits));
        assertEquals(5L, aiFix(limits));
    }

    @Test
    void planWithNullValues_fallsBackToSystemDefault() {
        subscribedTo(plan("TEAM", null, null));

        FeatureLimits limits = service.features(user);
        assertEquals(10L, policy(limits));
        assertEquals(3L, aiFix(limits));
    }

    @Test
    void minusOne_meansUnlimited() {
        subscribedTo(plan("TEAM", PlanLimitService.UNLIMITED, PlanLimitService.UNLIMITED));

        FeatureLimits limits = service.features(user);
        assertNull(policy(limits));
        assertNull(aiFix(limits));
    }

    @Test
    void zero_meansDisabled() {
        subscribedTo(plan("TEAM", 0, 0));

        FeatureLimits limits = service.features(user);
        assertEquals(0L, policy(limits));
        assertEquals(0L, aiFix(limits));
        assertFalse(limits.included(PlanLimitKey.AI_FIX_PER_VERSION));
    }

    /** Gói lấy theo subscription, không theo nhãn User.plan (PLUS) — không còn so tên gói. */
    @Test
    void customPlan_isResolvedFromSubscription_notFromUserLabel() {
        subscribedTo(plan("ENTERPRISE", 999, null));

        assertEquals("ENTERPRISE", service.features(user).planCode());
        assertEquals(999L, policy(service.features(user)));
    }

    @Test
    void noSubscription_usesPlanMatchingTheLabel() {
        when(subscriptionService.getOrCreate(any())).thenReturn(null);
        when(planRepository.findByCodeAndDeletedAtIsNull("PLUS")).thenReturn(Optional.of(plan("PLUS", 30, null)));

        FeatureLimits limits = service.features(user);
        assertEquals("PLUS", limits.planCode());
        assertEquals(30L, policy(limits));
        assertEquals(3L, aiFix(limits));
    }

    /** Fail-closed (V20): không subscription, không gói nào tra được → giới hạn gói FREE lõi, KHÔNG phải "không giới hạn". */
    @Test
    void userWithoutAnyPlan_getsFreeCoreLimits_notUnlimited() {
        when(subscriptionService.getOrCreate(any())).thenReturn(null);
        when(planRepository.findByCodeAndDeletedAtIsNull(anyString())).thenReturn(Optional.empty());

        FeatureLimits limits = service.features(user);
        assertEquals("FREE", limits.planCode());
        assertEquals(1L, limits.limit(PlanLimitKey.BRAND_PROFILES));
        assertEquals(0L, policy(limits));
        assertEquals(Set.of(Platform.FACEBOOK), limits.allowedPlatforms());
        assertFalse(limits.included(PlanLimitKey.GOLDEN_HOURS));
    }

    /** Biến env cũ theo tên gói (deprecated) chỉ thay mặc định cho gói CÙNG MÃ khi gói chưa cấu hình. */
    @Test
    void legacyPerPlanEnv_onlyFillsUnconfiguredPlanWithSameCode() {
        environment.setProperty("AIMA_POLICY_CHECK_AI_LIMIT_PRO", "200");
        service = newService();

        subscribedTo(plan("PRO", null, null));
        assertEquals(200L, policy(service.features(user)));

        subscribedTo(plan("PRO", 50, null));
        assertEquals(50L, policy(service.features(user)), "giá trị trên gói luôn thắng env cũ");

        subscribedTo(plan("TEAM", null, null));
        assertEquals(10L, policy(service.features(user)));
    }

    /** Cấu hình sai (âm khác -1) không bao giờ thành "không giới hạn" ngoài ý muốn. */
    @Test
    void invalidNegativeDefault_isTreatedAsDisabled() {
        ReflectionTestUtils.setField(service, "policyCheckDefault", -5);
        subscribedTo(plan("TEAM", null, null));

        assertEquals(0L, policy(service.features(user)));
    }

    /** ALLOWED_PLATFORMS: null = mặc định hệ thống (chỉ FACEBOOK nếu không cấu hình), CSV trên gói thắng. */
    @Test
    void allowedPlatforms_defaultFacebookOnly_planValueWins() {
        subscribedTo(plan("TEAM", null, null));
        assertEquals(Set.of(Platform.FACEBOOK), service.features(user).allowedPlatforms());
        assertTrue(service.features(user).allows(Platform.FACEBOOK));
        assertFalse(service.features(user).allows(Platform.THREADS));

        Plan team = plan("TEAM", null, null);
        team.getFeatureLimits().setAllowedPlatforms("FACEBOOK,THREADS");
        subscribedTo(team);
        assertEquals(Set.of(Platform.FACEBOOK, Platform.THREADS), service.features(user).allowedPlatforms());

        team.getFeatureLimits().setAllowedPlatforms("");
        assertFalse(service.features(user).included(PlanLimitKey.ALLOWED_PLATFORMS), "rỗng = không nền tảng nào");
    }
}
