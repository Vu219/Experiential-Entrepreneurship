package com.aima.admin;

import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.SubscriptionHistory;
import com.aima.entity.User;
import com.aima.enums.DurationUnit;
import com.aima.enums.PlanSource;
import com.aima.enums.SubscriptionChangeCategory;
import com.aima.enums.SubscriptionHistoryAction;
import com.aima.enums.SubscriptionStatus;
import com.aima.enums.UserPlan;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UsageMapperImpl;
import com.aima.repository.PlanRepository;
import com.aima.repository.SubscriptionHistoryRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.NotificationService;
import com.aima.service.SubscriptionService;
import com.aima.service.Impl.SubscriptionServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Ba thao tác admin trên gói của MỘT user (gia hạn / đổi / thu hồi) + việc ghi
 * {@code subscription_history} ở mọi đường đổi gói. Mapper THẬT ({@code UsageMapperImpl}) để
 * bắt luôn lỗi map from/to của dòng lịch sử; repository mock.
 */
class SubscriptionAdminActionsTest {

    // Mốc thật (không cố định): getOrCreate so hạn dùng với LocalDateTime.now() của chính nó.
    private final LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);

    private SubscriptionRepository subscriptionRepository;
    private PlanRepository planRepository;
    private SubscriptionHistoryRepository historyRepository;
    private SubscriptionServiceImpl service;

    private Plan freePlan;
    private Plan plusPlan;
    private Plan proPlan;
    private final SubscriptionService.AdminChange change = new SubscriptionService.AdminChange(
            UUID.randomUUID(), "admin@aima.local", SubscriptionChangeCategory.PROMOTION, "Tặng dịp 2/9");

    @BeforeEach
    void setUp() {
        subscriptionRepository = mock(SubscriptionRepository.class);
        planRepository = mock(PlanRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        historyRepository = mock(SubscriptionHistoryRepository.class);
        service = new SubscriptionServiceImpl(subscriptionRepository, planRepository, userRepository,
                new UsageMapperImpl(), mock(NotificationService.class), mock(ActivityLogService.class),
                historyRepository);

        freePlan = plan("FREE", 1_000L);
        plusPlan = plan("PLUS", 100_000L);
        proPlan = plan("PRO", 1_000_000L);
        when(subscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(planRepository.findByCodeAndDeletedAtIsNull("FREE")).thenReturn(Optional.of(freePlan));
    }

    private static Plan plan(String code, long limit) {
        return Plan.builder().code(code).nameVi(code).nameEn(code).price(0L)
                .monthlyTokenLimit(limit).billingIntervalMonths((short) 1).isActive(true).build();
    }

    private User user(UserPlan label) {
        User u = User.builder().email(label + "@user.local").plan(label).build();
        u.setId(UUID.randomUUID());
        return u;
    }

    private Subscription subscription(User user, Plan plan, PlanSource source, LocalDateTime startedAt,
                                      LocalDateTime expiresAt) {
        Subscription s = Subscription.builder()
                .user(user).plan(plan).status(SubscriptionStatus.ACTIVE)
                .planSource(source).planStartedAt(startedAt).planExpiresAt(expiresAt)
                .currentPeriodStart(now.withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS))
                .currentPeriodEnd(now.withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS).plusMonths(1))
                .build();
        s.setId(UUID.randomUUID());
        when(subscriptionRepository.findWithPlanByUserId(user.getId())).thenReturn(Optional.of(s));
        return s;
    }

    private SubscriptionHistory savedHistory() {
        ArgumentCaptor<SubscriptionHistory> captor = ArgumentCaptor.forClass(SubscriptionHistory.class);
        verify(historyRepository).save(captor.capture());
        return captor.getValue();
    }

    // ================================================================== gia hạn

    /** Cộng dồn vào hạn cũ, KHÔNG cộng từ now; gói tự mua vẫn giữ nguồn PAYMENT + ngày bắt đầu. */
    @Test
    void extend_accumulatesOntoCurrentExpiry_andKeepsPaidSource() {
        User user = user(UserPlan.PRO);
        LocalDateTime startedAt = now.minusDays(20);
        LocalDateTime expiry = now.plusDays(10);
        Subscription s = subscription(user, proPlan, PlanSource.PAYMENT, startedAt, expiry);

        service.extendPlan(user, 7, DurationUnit.DAY, now, change);

        assertEquals(expiry.plusDays(7), s.getPlanExpiresAt());
        assertEquals(PlanSource.PAYMENT, s.getPlanSource(), "gia hạn gói tự mua KHÔNG được đổi nguồn sang ADMIN");
        assertEquals(startedAt, s.getPlanStartedAt());
        assertEquals("PRO", s.getPlan().getCode());

        SubscriptionHistory h = savedHistory();
        assertEquals(SubscriptionHistoryAction.ADMIN_EXTENDED, h.getAction());
        assertEquals(user, h.getUser());
        assertEquals("PRO", h.getFromPlanCode());
        assertEquals("PRO", h.getToPlanCode());
        assertEquals(expiry, h.getFromExpiresAt());
        assertEquals(expiry.plusDays(7), h.getToExpiresAt());
        assertEquals(PlanSource.PAYMENT, h.getFromSource());
        assertEquals(PlanSource.PAYMENT, h.getToSource());
        assertEquals(7, h.getExtendAmount());
        assertEquals(DurationUnit.DAY, h.getExtendUnit());
        assertEquals(change.actorId(), h.getActorUserId());
        assertEquals("admin@aima.local", h.getActorEmail());
        assertEquals(SubscriptionChangeCategory.PROMOTION, h.getCategory());
        assertEquals("Tặng dịp 2/9", h.getReason());
    }

    @Test
    void extend_weeksAndMonthsUseCalendarArithmetic() {
        User user = user(UserPlan.PLUS);
        LocalDateTime expiry = now.plusDays(3);
        Subscription s = subscription(user, plusPlan, PlanSource.ADMIN, now, expiry);

        service.extendPlan(user, 2, DurationUnit.WEEK, now, change);
        assertEquals(expiry.plusWeeks(2), s.getPlanExpiresAt());

        service.extendPlan(user, 1, DurationUnit.MONTH, now, change);
        assertEquals(expiry.plusWeeks(2).plusMonths(1), s.getPlanExpiresAt());
    }

    /** Trần user chốt 25/9: 1–365 ngày, 1–52 tuần, 1–24 tháng. */
    @ParameterizedTest
    @CsvSource({"0,DAY", "366,DAY", "53,WEEK", "25,MONTH", "-1,MONTH"})
    void extend_rejectsDurationsOutsideTheCap(int amount, DurationUnit unit) {
        User user = user(UserPlan.PRO);
        Subscription s = subscription(user, proPlan, PlanSource.PAYMENT, now, now.plusDays(5));

        AppException e = assertThrows(AppException.class,
                () -> service.extendPlan(user, amount, unit, now, change));

        assertEquals(ErrorCode.SUBSCRIPTION_DURATION_INVALID, e.getErrorCode());
        assertEquals(now.plusDays(5), s.getPlanExpiresAt());
        verifyNoInteractions(historyRepository);
    }

    @ParameterizedTest
    @CsvSource({"365,DAY", "52,WEEK", "24,MONTH", "1,DAY"})
    void extend_acceptsTheBoundaries(int amount, DurationUnit unit) {
        User user = user(UserPlan.PRO);
        subscription(user, proPlan, PlanSource.PAYMENT, now, now.plusDays(5));

        assertDoesNotThrow(() -> service.extendPlan(user, amount, unit, now, change));
    }

    @Test
    void extend_rejectsFreeAndNeverExpiringPlans() {
        User free = user(UserPlan.FREE);
        subscription(free, freePlan, PlanSource.FREE, null, null);
        assertEquals(ErrorCode.SUBSCRIPTION_NOT_EXTENDABLE, assertThrows(AppException.class,
                () -> service.extendPlan(free, 7, DurationUnit.DAY, now, change)).getErrorCode());

        User permanent = user(UserPlan.PRO);
        subscription(permanent, proPlan, PlanSource.ADMIN, now, null);
        assertEquals(ErrorCode.SUBSCRIPTION_NOT_EXTENDABLE, assertThrows(AppException.class,
                () -> service.extendPlan(permanent, 7, DurationUnit.DAY, now, change)).getErrorCode());
        verifyNoInteractions(historyRepository);
    }

    // ================================================================== đổi gói

    @Test
    void change_setsAdminSourceAndDurationFromNow_andSyncsTheLabel() {
        User user = user(UserPlan.FREE);
        Subscription s = subscription(user, freePlan, PlanSource.FREE, null, null);

        service.changePlan(user, plusPlan, 3, DurationUnit.MONTH, now, change);

        assertEquals("PLUS", s.getPlan().getCode());
        assertEquals(PlanSource.ADMIN, s.getPlanSource());
        assertEquals(now, s.getPlanStartedAt());
        assertEquals(now.plusMonths(3), s.getPlanExpiresAt());
        assertEquals(UserPlan.PLUS, user.getPlan(), "nhãn cache User.plan phải khớp gói thật");

        SubscriptionHistory h = savedHistory();
        assertEquals(SubscriptionHistoryAction.ADMIN_CHANGED, h.getAction());
        assertEquals("FREE", h.getFromPlanCode());
        assertEquals("PLUS", h.getToPlanCode());
        assertNull(h.getFromExpiresAt());
        assertEquals(PlanSource.FREE, h.getFromSource());
        assertEquals(PlanSource.ADMIN, h.getToSource());
        assertEquals(3, h.getExtendAmount());
        assertEquals(DurationUnit.MONTH, h.getExtendUnit());
    }

    @Test
    void change_withoutUnitMeansNeverExpires() {
        User user = user(UserPlan.PLUS);
        Subscription s = subscription(user, plusPlan, PlanSource.PAYMENT, now, now.plusDays(9));

        service.changePlan(user, proPlan, null, null, now, change);

        assertEquals("PRO", s.getPlan().getCode());
        assertNull(s.getPlanExpiresAt());
        SubscriptionHistory h = savedHistory();
        assertNull(h.getExtendAmount());
        assertNull(h.getExtendUnit());
        assertEquals(now.plusDays(9), h.getFromExpiresAt());
    }

    @Test
    void change_rejectsFreeTarget_samePlanWithExpiry_andBadDuration() {
        User user = user(UserPlan.PRO);
        subscription(user, proPlan, PlanSource.PAYMENT, now, now.plusDays(9));

        assertEquals(ErrorCode.SUBSCRIPTION_CHANGE_TO_FREE, assertThrows(AppException.class,
                () -> service.changePlan(user, freePlan, 1, DurationUnit.MONTH, now, change)).getErrorCode());
        assertEquals(ErrorCode.SUBSCRIPTION_SAME_PLAN, assertThrows(AppException.class,
                () -> service.changePlan(user, proPlan, 1, DurationUnit.MONTH, now, change)).getErrorCode());
        assertEquals(ErrorCode.SUBSCRIPTION_DURATION_INVALID, assertThrows(AppException.class,
                () -> service.changePlan(user, plusPlan, 25, DurationUnit.MONTH, now, change)).getErrorCode());
        verifyNoInteractions(historyRepository);
    }

    /** Gói trùng nhưng đang KHÔNG hết hạn: cho đặt lại một thời hạn cụ thể (không đi được đường gia hạn). */
    @Test
    void change_samePlanWithoutExpiry_canBeGivenADuration() {
        User user = user(UserPlan.PRO);
        Subscription s = subscription(user, proPlan, PlanSource.ADMIN, now, null);

        service.changePlan(user, proPlan, 30, DurationUnit.DAY, now, change);

        assertEquals(now.plusDays(30), s.getPlanExpiresAt());
    }

    // ================================================================== thu hồi

    @Test
    void revoke_dropsToFreeImmediately_withFreeSource() {
        User user = user(UserPlan.PRO);
        Subscription s = subscription(user, proPlan, PlanSource.PAYMENT, now.minusDays(5), now.plusDays(25));

        service.revokeToFree(user, now, change);

        assertEquals("FREE", s.getPlan().getCode());
        assertEquals(PlanSource.FREE, s.getPlanSource());
        assertNull(s.getPlanStartedAt());
        assertNull(s.getPlanExpiresAt());
        assertEquals(UserPlan.FREE, user.getPlan());

        SubscriptionHistory h = savedHistory();
        assertEquals(SubscriptionHistoryAction.ADMIN_REVOKED, h.getAction());
        assertEquals("PRO", h.getFromPlanCode());
        assertEquals("FREE", h.getToPlanCode());
        assertEquals(now.plusDays(25), h.getFromExpiresAt());
        assertNull(h.getToExpiresAt());
    }

    @Test
    void revoke_onFreeUser_isRejected() {
        User user = user(UserPlan.FREE);
        subscription(user, freePlan, PlanSource.FREE, null, null);

        assertEquals(ErrorCode.SUBSCRIPTION_ALREADY_FREE, assertThrows(AppException.class,
                () -> service.revokeToFree(user, now, change)).getErrorCode());
        verifyNoInteractions(historyRepository);
    }

    // ================================================================== sự kiện hệ thống

    @Test
    void paymentActivation_isRecordedWithoutActor() {
        User user = user(UserPlan.FREE);
        subscription(user, freePlan, PlanSource.FREE, null, null);

        service.activatePaidPlan(user, proPlan, now);

        SubscriptionHistory h = savedHistory();
        assertEquals(SubscriptionHistoryAction.PAYMENT_ACTIVATED, h.getAction());
        assertEquals("FREE", h.getFromPlanCode());
        assertEquals("PRO", h.getToPlanCode());
        assertEquals(PlanSource.PAYMENT, h.getToSource());
        assertNull(h.getActorUserId());
        assertNull(h.getActorEmail());
        assertNull(h.getCategory());
    }

    @Test
    void expiry_isRecordedWithoutActor() {
        User user = user(UserPlan.PRO);
        LocalDateTime expired = now.minusHours(1);
        Subscription s = subscription(user, proPlan, PlanSource.PAYMENT, now.minusMonths(1), expired);

        assertTrue(service.expireToFreePlan(s, now));

        SubscriptionHistory h = savedHistory();
        assertEquals(SubscriptionHistoryAction.EXPIRED, h.getAction());
        assertEquals("PRO", h.getFromPlanCode());
        assertEquals(expired, h.getFromExpiresAt());
        assertEquals("FREE", h.getToPlanCode());
        assertNull(h.getActorEmail());
    }
}
