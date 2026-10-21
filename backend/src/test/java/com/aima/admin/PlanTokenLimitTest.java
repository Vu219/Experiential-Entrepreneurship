package com.aima.admin;

import com.aima.config.init.PlanDataInitializer;
import com.aima.dto.request.PlanCreateRequest;
import com.aima.dto.request.PlanFeatureLimitsRequest;
import com.aima.dto.request.PlanUpdateRequest;
import com.aima.dto.response.PlanResponse;
import com.aima.entity.Plan;
import com.aima.entity.PlanFeatureLimits;
import com.aima.enums.Platform;
import com.aima.enums.PlanLimitKey;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PlanMapperImpl;
import com.aima.repository.PlanFeatureRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.EntitlementHoldService;
import com.aima.service.PlanLimitService;
import com.aima.service.PlatformAvailabilityService;
import com.aima.service.Impl.PlanServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.EnumMap;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Hạn mức token THẬT ({@code Plan.monthlyTokenLimit}, null = không giới hạn) và giới hạn theo gói khi admin tạo/sửa:
 * null ở request = GIỮ NGUYÊN, về "Mặc định" bằng resetToDefault (chỉ gói lõi), gói tự tạo bắt buộc điền đủ (2211),
 * tokenQuota hiển thị sinh từ monthlyTokenLimit.
 */
class PlanTokenLimitTest {

    private PlanRepository planRepository;
    private PlanLimitService planLimitService;
    private EntitlementHoldService entitlementHoldService;
    private PlanServiceImpl service;
    private final PlanMapperImpl mapper = new PlanMapperImpl();

    @BeforeEach
    void setUp() {
        planRepository = mock(PlanRepository.class);
        planLimitService = mock(PlanLimitService.class);
        entitlementHoldService = mock(EntitlementHoldService.class);
        when(planRepository.save(any())).thenAnswer(inv -> {
            Plan p = inv.getArgument(0);
            if (p.getId() == null) p.setId(UUID.randomUUID());
            return p;
        });
        when(planLimitService.featuresOf(any())).thenAnswer(inv -> limitsOf(inv.getArgument(0)));
        service = new PlanServiceImpl(mock(ActivityLogService.class), planRepository,
                mock(PlanFeatureRepository.class), mapper, planLimitService, mock(SubscriptionRepository.class),
                mock(PlatformAvailabilityService.class), entitlementHoldService);
    }

    /** Bản rút gọn của PlanLimitService.featuresOf: chỉ nền tảng + lên lịch (đủ cho nhánh đồng bộ lịch). */
    private static PlanLimitService.FeatureLimits limitsOf(Plan plan) {
        PlanFeatureLimits l = plan.getFeatureLimits();
        EnumMap<PlanLimitKey, Long> values = new EnumMap<>(PlanLimitKey.class);
        values.put(PlanLimitKey.SCHEDULING, l != null && Boolean.FALSE.equals(l.getScheduling()) ? 0L : null);
        Set<Platform> platforms = l == null || l.getAllowedPlatforms() == null ? Set.of(Platform.FACEBOOK)
                : com.aima.util.PlatformCsv.parse(l.getAllowedPlatforms());
        return new PlanLimitService.FeatureLimits(plan.getCode(), values, platforms);
    }

    /** Đủ mọi giới hạn (gói tự tạo bắt buộc). */
    private static PlanFeatureLimitsRequest completeLimits() {
        return PlanFeatureLimitsRequest.builder()
                .brandProfiles(2).strategiesPerBrand(2).connectedChannels(2).allowedPlatforms(List.of(Platform.FACEBOOK))
                .trendResearchPerPeriod(5).autoTrendResearch(false).ideasPerResearch(5)
                .scheduling(true).scheduledPostsPerPeriod(20).activeSchedules(10).scheduleHorizonDays(14)
                .goldenHours(true).analyticsHistoryDays(30).analyticsAdvanced(false).analyticsExport(false)
                .strategyOptimizationPerPeriod(1).policyCheckAiPerPeriod(5).aiFixPerVersion(2).build();
    }

    private static PlanCreateRequest create(long price, Long limit) {
        return PlanCreateRequest.builder().code("team").nameVi("Team").nameEn("Team")
                .price(price).billingIntervalMonths((short) 1).monthlyTokenLimit(limit)
                .featureLimits(completeLimits()).build();
    }

    private static PlanUpdateRequest.PlanUpdateRequestBuilder update(String name, long price) {
        return PlanUpdateRequest.builder().nameVi(name).nameEn(name).price(price)
                .billingIntervalMonths((short) 1).highlight(false).displayOrder(1).isActive(true);
    }

    private Plan existing(String code, long price, Long tokenLimit, PlanFeatureLimits limits, boolean active) {
        Plan plan = Plan.builder().code(code).nameVi(code).nameEn(code).price(price)
                .monthlyTokenLimit(tokenLimit).featureLimits(limits).isActive(active).build();
        plan.setId(UUID.randomUUID());
        when(planRepository.findByIdAndDeletedAtIsNull(plan.getId())).thenReturn(Optional.of(plan));
        return plan;
    }

    private static PlanFeatureLimits completeEntityLimits() {
        PlanFeatureLimits limits = new PlanFeatureLimits();
        new PlanMapperImpl().updateLimits(completeLimits(), limits);
        return limits;
    }

    @Test
    void create_sellablePlanWithLimit_storesTheRealLimit() {
        service.create(create(999_000L, 250_000L));

        verify(planRepository).save(argThat(p -> Long.valueOf(250_000L).equals(p.getMonthlyTokenLimit())));
    }

    @Test
    void create_sellablePlanWithoutLimit_isRejected() {
        AppException e = assertThrows(AppException.class, () -> service.create(create(999_000L, null)));

        assertEquals(ErrorCode.PLAN_TOKEN_LIMIT_REQUIRED, e.getErrorCode());
        verify(planRepository, never()).save(any());
    }

    @Test
    void create_freePlanWithoutLimit_isAllowed() {
        assertDoesNotThrow(() -> service.create(create(0L, null)));
    }

    /** Fail-closed (V20): gói tự tạo thiếu bất kỳ giới hạn nào → 2211, không ngầm "Mặc định = không giới hạn". */
    @Test
    void create_customPlanWithMissingLimit_isRejected() {
        PlanCreateRequest request = create(0L, null);
        request.getFeatureLimits().setGoldenHours(null);

        AppException e = assertThrows(AppException.class, () -> service.create(request));
        assertEquals(ErrorCode.PLAN_LIMIT_VALUE_REQUIRED, e.getErrorCode());

        request.setFeatureLimits(null);
        assertEquals(ErrorCode.PLAN_LIMIT_VALUE_REQUIRED,
                assertThrows(AppException.class, () -> service.create(request)).getErrorCode());
        verify(planRepository, never()).save(any());
    }

    /** FE cũ chưa gửi monthlyTokenLimit: PUT không được xoá hạn mức đang có (null = giữ nguyên). */
    @Test
    void update_withoutLimit_keepsExistingLimit() {
        Plan plan = existing("PLUS", 99_000L, 100_000L, null, true);

        service.update(plan.getId(), update("Plus", 129_000L).build());

        assertEquals(100_000L, plan.getMonthlyTokenLimit());
        assertEquals(129_000L, plan.getPrice());
    }

    @Test
    void update_minusOneTokenLimit_meansUnlimited() {
        Plan plan = existing("PLUS", 0L, 100_000L, null, true);

        service.update(plan.getId(), update("Plus", 0L).monthlyTokenLimit(-1L).build());

        assertNull(plan.getMonthlyTokenLimit());
    }

    @Test
    void update_activatingPaidPlanWithoutLimit_isRejected() {
        Plan plan = existing("TEAM", 0L, null, completeEntityLimits(), false);

        AppException e = assertThrows(AppException.class, () -> service.update(plan.getId(),
                update("Team", 999_000L).build()));

        assertEquals(ErrorCode.PLAN_TOKEN_LIMIT_REQUIRED, e.getErrorCode());
    }

    /** C8: ô giới hạn null ở request = GIỮ NGUYÊN (trước đây null = về mặc định — dễ xoá nhầm giá trị). */
    @Test
    void update_nullLimitFields_keepExistingValues() {
        PlanFeatureLimits limits = PlanFeatureLimits.builder().policyCheckAiPerPeriod(30).aiFixPerVersion(5).build();
        Plan plan = existing("PLUS", 0L, 100_000L, limits, true);

        service.update(plan.getId(), update("Plus", 0L)
                .featureLimits(PlanFeatureLimitsRequest.builder().policyCheckAiPerPeriod(45).build()).build());

        assertEquals(45, plan.getFeatureLimits().getPolicyCheckAiPerPeriod());
        assertEquals(5, plan.getFeatureLimits().getAiFixPerVersion(), "null ở request = giữ nguyên");
    }

    /** resetToDefault: gói lõi về "Mặc định hệ thống"; gói tự tạo không được (2211). */
    @Test
    void resetToDefault_onlyForCorePlans() {
        Plan plus = existing("PLUS", 0L, 100_000L,
                PlanFeatureLimits.builder().policyCheckAiPerPeriod(30).goldenHours(true).build(), true);
        service.update(plus.getId(), update("Plus", 0L)
                .resetToDefault(List.of(PlanLimitKey.POLICY_CHECK_AI_PER_PERIOD)).build());
        assertNull(plus.getFeatureLimits().getPolicyCheckAiPerPeriod());
        assertTrue(plus.getFeatureLimits().getGoldenHours());

        Plan team = existing("TEAM", 0L, null, completeEntityLimits(), true);
        AppException e = assertThrows(AppException.class, () -> service.update(team.getId(), update("Team", 0L)
                .resetToDefault(List.of(PlanLimitKey.GOLDEN_HOURS)).build()));
        assertEquals(ErrorCode.PLAN_LIMIT_VALUE_REQUIRED, e.getErrorCode());
    }

    /** C10: số token hiển thị sinh từ hạn mức thật — không còn hai con số lệch nhau. */
    @Test
    void tokenQuota_isDerivedFromMonthlyTokenLimit() {
        Plan plan = Plan.builder().code("PLUS").monthlyTokenLimit(100_000L).tokenQuota(5L)
                .featureLimits(PlanDataInitializer.coreFeatureLimits("PLUS")).build();

        PlanResponse response = mapper.toResponse(plan);
        assertEquals(100_000L, response.getTokenQuota());
        assertEquals(List.of(Platform.FACEBOOK), response.getFeatureLimits().getAllowedPlatforms());
    }

    /** Gói thu hẹp nền tảng / tắt lên lịch → đồng bộ lịch của người đang ở gói; nới rộng thì không. */
    @Test
    void narrowingPlatformsOrScheduling_syncsSubscribers() {
        PlanFeatureLimits limits = completeEntityLimits();
        limits.setAllowedPlatforms("FACEBOOK,THREADS");
        Plan team = existing("TEAM", 0L, null, limits, true);

        service.update(team.getId(), update("Team", 0L).featureLimits(PlanFeatureLimitsRequest.builder()
                .allowedPlatforms(List.of(Platform.FACEBOOK, Platform.THREADS, Platform.INSTAGRAM)).build()).build());
        verify(entitlementHoldService, never()).syncPlanSubscribers(any());

        service.update(team.getId(), update("Team", 0L).featureLimits(PlanFeatureLimitsRequest.builder()
                .allowedPlatforms(List.of(Platform.FACEBOOK)).build()).build());
        verify(entitlementHoldService).syncPlanSubscribers(team.getId());
    }
}
