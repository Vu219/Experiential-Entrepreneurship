package com.aima.service.Impl;

import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.UserPlan;
import com.aima.repository.PlanRepository;
import com.aima.service.PlanLimitService;
import com.aima.service.PlanLimitService.PlanLimits;
import com.aima.service.SubscriptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Giới hạn AI theo gói (Flyway V15): null = mặc định hệ thống, -1 = không giới hạn, 0 = tắt; gói lấy từ subscription
 * (gói admin tự tạo cũng có giới hạn riêng), không so tên gói.
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
        return Plan.builder().code(code).policyCheckAiMonthlyLimit(policyCheck).aiFixMaxPerVersion(aiFix).build();
    }

    @Test
    void planWithValues_usesThePlanValues() {
        subscribedTo(plan("TEAM", 75, 5));

        assertEquals(new PlanLimits("TEAM", 75L, 5L), service.resolve(user));
    }

    @Test
    void planWithNullValues_fallsBackToSystemDefault() {
        subscribedTo(plan("TEAM", null, null));

        assertEquals(new PlanLimits("TEAM", 10L, 3L), service.resolve(user));
    }

    @Test
    void minusOne_meansUnlimited() {
        subscribedTo(plan("TEAM", PlanLimitService.UNLIMITED, PlanLimitService.UNLIMITED));

        PlanLimits limits = service.resolve(user);
        assertNull(limits.policyCheckAiMonthly());
        assertNull(limits.aiFixPerVersion());
    }

    @Test
    void zero_meansDisabled() {
        subscribedTo(plan("TEAM", 0, 0));

        PlanLimits limits = service.resolve(user);
        assertEquals(0L, limits.policyCheckAiMonthly());
        assertEquals(0L, limits.aiFixPerVersion());
    }

    /** Gói lấy theo subscription, không theo nhãn User.plan (PLUS) — không còn so tên gói. */
    @Test
    void customPlan_isResolvedFromSubscription_notFromUserLabel() {
        subscribedTo(plan("ENTERPRISE", 999, null));

        assertEquals("ENTERPRISE", service.resolve(user).planCode());
        assertEquals(999L, service.resolve(user).policyCheckAiMonthly());
    }

    @Test
    void noSubscription_usesPlanMatchingTheLabel() {
        when(subscriptionService.getOrCreate(any())).thenReturn(null);
        when(planRepository.findByCodeAndDeletedAtIsNull("PLUS")).thenReturn(Optional.of(plan("PLUS", 30, null)));

        assertEquals(new PlanLimits("PLUS", 30L, 3L), service.resolve(user));
    }

    @Test
    void userWithoutAnyPlan_getsSystemDefaults() {
        when(subscriptionService.getOrCreate(any())).thenReturn(null);
        when(planRepository.findByCodeAndDeletedAtIsNull(anyString())).thenReturn(Optional.empty());

        assertEquals(new PlanLimits(null, 10L, 3L), service.resolve(user));
        assertEquals(service.defaults(), service.resolve(user));
    }

    /** Biến env cũ theo tên gói (deprecated) chỉ thay mặc định cho gói CÙNG MÃ khi gói chưa cấu hình. */
    @Test
    void legacyPerPlanEnv_onlyFillsUnconfiguredPlanWithSameCode() {
        environment.setProperty("AIMA_POLICY_CHECK_AI_LIMIT_PRO", "200");
        service = newService();

        subscribedTo(plan("PRO", null, null));
        assertEquals(200L, service.resolve(user).policyCheckAiMonthly());

        subscribedTo(plan("PRO", 50, null));
        assertEquals(50L, service.resolve(user).policyCheckAiMonthly(), "giá trị trên gói luôn thắng env cũ");

        subscribedTo(plan("TEAM", null, null));
        assertEquals(10L, service.resolve(user).policyCheckAiMonthly());
    }

    /** Cấu hình sai (âm khác -1) không bao giờ thành "không giới hạn" ngoài ý muốn. */
    @Test
    void invalidNegativeDefault_isTreatedAsDisabled() {
        ReflectionTestUtils.setField(service, "policyCheckDefault", -5);

        assertEquals(0L, service.defaults().policyCheckAiMonthly());
    }
}
