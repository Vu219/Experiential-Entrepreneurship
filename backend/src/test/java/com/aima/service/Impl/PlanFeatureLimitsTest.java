package com.aima.service.Impl;

import com.aima.entity.Plan;
import com.aima.entity.PlanFeatureLimits;
import com.aima.entity.Subscription;
import com.aima.entity.TrendResearchSchedule;
import com.aima.entity.User;
import com.aima.enums.PlanLimitKey;
import com.aima.enums.TrendScheduleFrequency;
import com.aima.enums.UserPlan;
import com.aima.exception.ErrorCode;
import com.aima.exception.PlanLimitException;
import com.aima.mapper.PlanMapperImpl;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.StrategyOptimizationJobRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.TrendResearchSessionRepository;
import com.aima.repository.UserRepository;
import com.aima.scheduler.DailyTrendResearchJob;
import com.aima.service.PlanLimitService;
import com.aima.service.SubscriptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Giới hạn TÍNH NĂNG theo gói (Flyway V18): quy đổi null/-1/0/n ở {@link PlanLimitServiceImpl#features} và chặn ở
 * {@link PlanUsageServiceImpl}; kèm lịch nghiên cứu tự động đến giờ ({@code DailyTrendResearchJob.isDue}, V19).
 */
class PlanFeatureLimitsTest {

    private SubscriptionService subscriptionService;
    private MockEnvironment environment;
    private PlanLimitServiceImpl limitService;
    private PlanUsageServiceImpl usageService;
    private BrandProfileRepository brandProfileRepository;
    private PostScheduleRepository postScheduleRepository;
    private final User user = User.builder().plan(UserPlan.FREE).build();
    private Plan plan;

    @BeforeEach
    void setUp() {
        user.setId(UUID.randomUUID());
        subscriptionService = mock(SubscriptionService.class);
        environment = new MockEnvironment();
        limitService = new PlanLimitServiceImpl(subscriptionService, mock(PlanRepository.class), environment);
        brandProfileRepository = mock(BrandProfileRepository.class);
        postScheduleRepository = mock(PostScheduleRepository.class);
        usageService = new PlanUsageServiceImpl(limitService, subscriptionService, mock(SubscriptionRepository.class),
                brandProfileRepository, mock(ContentStrategyRepository.class), mock(PlatformAccountRepository.class),
                mock(TrendResearchSessionRepository.class), postScheduleRepository,
                mock(StrategyOptimizationJobRepository.class), mock(UserRepository.class), new PlanMapperImpl());

        plan = Plan.builder().code("FREE").build();
        LocalDateTime start = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        Subscription subscription = Subscription.builder().plan(plan)
                .currentPeriodStart(start).currentPeriodEnd(start.plusMonths(1)).build();
        when(subscriptionService.getOrCreate(any())).thenReturn(subscription);
    }

    @Test
    void columnsNull_useSystemDefault_unlimitedAndOnUnlessConfigured() {
        environment.setProperty("aima.plan-limits.defaults.brand-profiles", "2");
        PlanLimitService.FeatureLimits limits = limitService.features(user);

        assertEquals(2L, limits.limit(PlanLimitKey.BRAND_PROFILES));
        assertNull(limits.limit(PlanLimitKey.ACTIVE_SCHEDULES), "không cấu hình = không giới hạn");
        assertTrue(limits.included(PlanLimitKey.GOLDEN_HOURS), "cờ không cấu hình = bật");
    }

    @Test
    void columnConvention_minusOneUnlimited_zeroOff_falseOff() {
        plan.setFeatureLimits(PlanFeatureLimits.builder().brandProfiles(-1).activeSchedules(0).goldenHours(false).build());
        PlanLimitService.FeatureLimits limits = limitService.features(user);

        assertNull(limits.limit(PlanLimitKey.BRAND_PROFILES));
        assertFalse(limits.included(PlanLimitKey.ACTIVE_SCHEDULES));
        assertFalse(limits.included(PlanLimitKey.GOLDEN_HOURS));
    }

    @Test
    void quotaReached_throwsWithDetail_belowLimitPasses() {
        plan.setFeatureLimits(PlanFeatureLimits.builder().brandProfiles(1).build());
        when(brandProfileRepository.countByUser_IdAndDeletedAtIsNull(user.getId())).thenReturn(0L, 1L);

        assertDoesNotThrow(() -> usageService.requireQuota(user, PlanLimitKey.BRAND_PROFILES, null));
        PlanLimitException ex = assertThrows(PlanLimitException.class,
                () -> usageService.requireQuota(user, PlanLimitKey.BRAND_PROFILES, null));
        assertEquals(ErrorCode.PLAN_LIMIT_REACHED, ex.getErrorCode());
        assertEquals(PlanLimitKey.BRAND_PROFILES, ex.getDetail().getLimitKey());
        assertEquals(1L, ex.getDetail().getLimit());
        assertEquals(1L, ex.getDetail().getUsed());
        assertEquals("FREE", ex.getDetail().getPlanCode());
    }

    @Test
    void quotaOff_isNotIncluded_unlimitedNeverCounts() {
        plan.setFeatureLimits(PlanFeatureLimits.builder().activeSchedules(0).scheduledPostsPerPeriod(-1).build());

        PlanLimitException ex = assertThrows(PlanLimitException.class,
                () -> usageService.requireQuota(user, PlanLimitKey.ACTIVE_SCHEDULES, null));
        assertEquals(ErrorCode.PLAN_FEATURE_NOT_INCLUDED, ex.getErrorCode());

        usageService.requireQuota(user, PlanLimitKey.SCHEDULED_POSTS_PER_PERIOD, null);
        verify(postScheduleRepository, never()).countCreatedInPeriod(eq(user.getId()), any(), any());
    }

    @Test
    void scheduleHorizon_beyondCapRejected_withinCapPasses() {
        plan.setFeatureLimits(PlanFeatureLimits.builder().scheduleHorizonDays(7).build());

        assertDoesNotThrow(() -> usageService.requireScheduleHorizon(user, Instant.now().plus(7, ChronoUnit.DAYS)));
        PlanLimitException ex = assertThrows(PlanLimitException.class,
                () -> usageService.requireScheduleHorizon(user, Instant.now().plus(9, ChronoUnit.DAYS)));
        assertEquals(PlanLimitKey.SCHEDULE_HORIZON_DAYS, ex.getDetail().getLimitKey());
    }

    @Test
    void analyticsHistory_earliestDateCountsToday() {
        plan.setFeatureLimits(PlanFeatureLimits.builder().analyticsHistoryDays(7).build());
        LocalDate today = LocalDate.of(2026, 10, 20);

        assertEquals(LocalDate.of(2026, 10, 14), usageService.analyticsEarliestDate(user, today));
    }

    @Test
    void trendSchedule_dueOnlyAtItsHourOnceADayAndOnChosenWeekdays() throws Exception {
        Method isDue = DailyTrendResearchJob.class.getDeclaredMethod("isDue", TrendResearchSchedule.class, LocalDateTime.class);
        isDue.setAccessible(true);
        TrendResearchSchedule daily = TrendResearchSchedule.builder().enabled(true)
                .frequency(TrendScheduleFrequency.DAILY).runTime(LocalTime.of(9, 30)).build();
        LocalDateTime tuesday9 = LocalDateTime.of(2026, 10, 20, 9, 0); // 20/10/2026 là Thứ Ba

        assertTrue((boolean) isDue.invoke(null, daily, tuesday9));
        assertFalse((boolean) isDue.invoke(null, daily, tuesday9.plusHours(1)));
        daily.setLastRunAt(tuesday9.minusMinutes(1).plusMinutes(1));
        assertFalse((boolean) isDue.invoke(null, daily, tuesday9), "đã chạy hôm nay");

        TrendResearchSchedule weekly = TrendResearchSchedule.builder().enabled(true)
                .frequency(TrendScheduleFrequency.WEEKLY).days("0,3").runTime(LocalTime.of(9, 0)).build();
        assertFalse((boolean) isDue.invoke(null, weekly, tuesday9), "Thứ Ba = 1, không nằm trong 0,3");
        assertTrue((boolean) isDue.invoke(null, weekly, tuesday9.minusDays(1)), "Thứ Hai = 0");
    }
}
