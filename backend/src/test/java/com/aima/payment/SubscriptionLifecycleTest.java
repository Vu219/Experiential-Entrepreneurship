package com.aima.payment;

import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.NotificationType;
import com.aima.enums.PlanSource;
import com.aima.enums.SubscriptionStatus;
import com.aima.enums.UserPlan;
import com.aima.mapper.UsageMapper;
import com.aima.repository.PlanRepository;
import com.aima.repository.SubscriptionHistoryRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.NotificationService;
import com.aima.service.Impl.SubscriptionServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Vòng đời gói: kích hoạt (Q1), hết hạn, và <b>bẫy §6</b> — nhánh đồng bộ theo nhãn
 * {@code User.plan} từng khôi phục lại gói vừa bị hạ.
 */
class SubscriptionLifecycleTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 22, 10, 0);

    private SubscriptionRepository subscriptionRepository;
    private PlanRepository planRepository;
    private UserRepository userRepository;
    private NotificationService notificationService;
    private ActivityLogService activityLogService;
    private SubscriptionServiceImpl service;

    private Plan freePlan;
    private Plan proPlan;
    private Plan plusPlan;

    @BeforeEach
    void setUp() {
        subscriptionRepository = mock(SubscriptionRepository.class);
        planRepository = mock(PlanRepository.class);
        userRepository = mock(UserRepository.class);
        notificationService = mock(NotificationService.class);
        activityLogService = mock(ActivityLogService.class);
        service = new SubscriptionServiceImpl(subscriptionRepository, planRepository,
                userRepository, mock(UsageMapper.class), notificationService, activityLogService,
                mock(SubscriptionHistoryRepository.class));

        freePlan = plan("FREE", 0L, 100_000L);
        plusPlan = plan("PLUS", 99_000L, 500_000L);
        proPlan = plan("PRO", 299_000L, 2_000_000L);

        when(subscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(planRepository.findByCodeAndDeletedAtIsNull("FREE")).thenReturn(Optional.of(freePlan));
    }

    private static Plan plan(String code, long price, Long tokenLimit) {
        return Plan.builder()
                .code(code).nameVi(code).nameEn(code)
                .price(price).monthlyTokenLimit(tokenLimit)
                .billingIntervalMonths((short) 1).isActive(true)
                .build();
    }

    private User user(UserPlan label) {
        User u = User.builder().email("a@b.c").plan(label).build();
        u.setId(UUID.randomUUID());
        return u;
    }

    private Subscription subscription(User user, Plan plan, PlanSource source, LocalDateTime expiresAt) {
        Subscription s = Subscription.builder()
                .user(user).plan(plan).status(SubscriptionStatus.ACTIVE)
                .planSource(source).planExpiresAt(expiresAt)
                .planStartedAt(expiresAt == null ? null : NOW.minusMonths(1))
                .currentPeriodStart(NOW.withDayOfMonth(1))
                .currentPeriodEnd(NOW.withDayOfMonth(1).plusMonths(1))
                .build();
        s.setId(UUID.randomUUID());
        when(subscriptionRepository.findWithPlanByUserId(user.getId())).thenReturn(Optional.of(s));
        return s;
    }

    // ------------------------------------------------------------ Q1: cộng dồn / thay thế

    /** Trùng gói + CÒN hạn → cộng vào hạn cũ, không phải cộng từ now. */
    @Test
    void activatePaidPlan_samePlanStillValid_accumulatesOntoExistingExpiry() {
        User user = user(UserPlan.PRO);
        LocalDateTime currentExpiry = NOW.plusDays(10);
        subscription(user, proPlan, PlanSource.PAYMENT, currentExpiry);

        Subscription result = service.activatePaidPlan(user, proPlan, NOW);

        assertEquals(currentExpiry.plusMonths(1), result.getPlanExpiresAt());
    }

    /** Trùng gói nhưng ĐÃ hết hạn → cộng từ now, không nối tiếp quá khứ. */
    @Test
    void activatePaidPlan_samePlanAlreadyExpired_accumulatesFromNow() {
        User user = user(UserPlan.PRO);
        subscription(user, proPlan, PlanSource.PAYMENT, NOW.minusDays(3));

        Subscription result = service.activatePaidPlan(user, proPlan, NOW);

        assertEquals(NOW.plusMonths(1), result.getPlanExpiresAt());
    }

    /** {@code planExpiresAt} null (đang gói Free) → cộng từ now, không NPE. */
    @Test
    void activatePaidPlan_nullExpiry_startsFromNow() {
        User user = user(UserPlan.FREE);
        subscription(user, freePlan, PlanSource.FREE, null);

        Subscription result = service.activatePaidPlan(user, freePlan, NOW);

        assertEquals(NOW.plusMonths(1), result.getPlanExpiresAt());
        assertEquals(NOW, result.getPlanStartedAt());
    }

    /** Nâng gói → THAY THẾ: bỏ phần dư gói cũ, tính lại từ now. */
    @Test
    void activatePaidPlan_upgrade_replacesInsteadOfAccumulating() {
        User user = user(UserPlan.PLUS);
        subscription(user, plusPlan, PlanSource.PAYMENT, NOW.plusDays(20));

        Subscription result = service.activatePaidPlan(user, proPlan, NOW);

        assertEquals("PRO", result.getPlan().getCode());
        assertEquals(NOW.plusMonths(1), result.getPlanExpiresAt(), "Nâng gói bỏ phần dư gói cũ");
        assertEquals(NOW, result.getPlanStartedAt());
    }

    /** Chu kỳ lấy từ gói, không hardcode 1 tháng. */
    @Test
    void activatePaidPlan_usesPlanBillingInterval() {
        User user = user(UserPlan.FREE);
        subscription(user, freePlan, PlanSource.FREE, null);
        Plan yearly = plan("PRO", 2_990_000L, 2_000_000L);
        yearly.setBillingIntervalMonths((short) 12);

        Subscription result = service.activatePaidPlan(user, yearly, NOW);

        assertEquals(NOW.plusMonths(12), result.getPlanExpiresAt());
    }

    // ------------------------------------------------------ Q4: nhãn cache một chiều

    /** Sau kích hoạt, nhãn {@code User.plan} phải khớp gói thật — cache một chiều rất dễ lệch. */
    @Test
    void activatePaidPlan_keepsUserPlanLabelInSyncWithSubscription() {
        User user = user(UserPlan.FREE);
        subscription(user, freePlan, PlanSource.FREE, null);

        Subscription result = service.activatePaidPlan(user, proPlan, NOW);

        assertEquals(UserPlan.PRO, user.getPlan());
        assertEquals(result.getPlan().getCode(), user.getPlan().name());
    }

    @Test
    void expireToFreePlan_keepsUserPlanLabelInSyncWithSubscription() {
        User user = user(UserPlan.PRO);
        Subscription sub = subscription(user, proPlan, PlanSource.PAYMENT, NOW.minusMinutes(1));

        assertTrue(service.expireToFreePlan(sub, NOW));

        assertEquals("FREE", sub.getPlan().getCode());
        assertEquals(UserPlan.FREE, user.getPlan());
        assertNull(sub.getPlanExpiresAt());
        assertEquals(PlanSource.FREE, sub.getPlanSource());
    }

    /** Gói admin tự tạo không có nhãn enum → giữ nguyên nhãn cũ, không ném lỗi (Q4). */
    @Test
    void activatePaidPlan_planWithoutEnumLabel_keepsPreviousLabel() {
        User user = user(UserPlan.PRO);
        subscription(user, proPlan, PlanSource.PAYMENT, NOW.plusDays(5));
        Plan custom = plan("ENTERPRISE", 999_000L, null);

        Subscription result = service.activatePaidPlan(user, custom, NOW);

        assertEquals("ENTERPRISE", result.getPlan().getCode());
        assertEquals(UserPlan.PRO, user.getPlan(), "Nhãn cũ được giữ nguyên");
    }

    @Test
    void expireToFreePlan_doesNothingWhenPlanStillValid() {
        User user = user(UserPlan.PRO);
        Subscription sub = subscription(user, proPlan, PlanSource.PAYMENT, NOW.plusDays(5));

        assertFalse(service.expireToFreePlan(sub, NOW));
        assertEquals("PRO", sub.getPlan().getCode());
    }

    // ------------------------------------------------------------------ BẪY §6

    /**
     * ⚠️ Bẫy §6. Trước khi sửa, {@code getOrCreate} thấy nhãn {@code User.plan = PRO} lệch với
     * {@code subscription.plan = FREE}, và vì FREE → PRO không phải "hạ gói" nên nó KHÔI PHỤC
     * lại PRO — user hết hạn vẫn dùng gói trả tiền vĩnh viễn.
     *
     * <p>Nay nhánh đồng bộ chỉ chạy khi {@code planSource = FREE}, nên subscription do thanh
     * toán/admin quyết định là nguồn sự thật.</p>
     */
    @Test
    void getOrCreate_doesNotResurrectPaidPlanFromStaleUserLabel() {
        User user = user(UserPlan.PRO);
        Subscription sub = subscription(user, freePlan, PlanSource.PAYMENT, null);

        Subscription result = service.getOrCreate(user);

        assertEquals("FREE", result.getPlan().getCode(),
                "Subscription là nguồn sự thật — nhãn cũ không được kéo gói PRO sống lại");
        verify(planRepository, never()).findByCodeAndDeletedAtIsNull("PRO");
    }

    /** Đường admin cũ (PATCH /users ghi User.plan) vẫn hoạt động khi gói chưa có nguồn gốc. */
    @Test
    void getOrCreate_stillFollowsUserLabelForFreeSourcedSubscription() {
        User user = user(UserPlan.PRO);
        Subscription sub = subscription(user, freePlan, PlanSource.FREE, null);
        when(planRepository.findByCodeAndDeletedAtIsNull("PRO")).thenReturn(Optional.of(proPlan));

        Subscription result = service.getOrCreate(user);

        assertEquals("PRO", result.getPlan().getCode());
        assertSame(sub, result);
    }

    /**
     * Kịch bản bắt buộc của §6, đầu-cuối: PRO hết hạn giữa tháng → hạ Free → lần đọc kế tiếp
     * KHÔNG được khôi phục PRO, tức hạn mức token thực sự giảm ngay.
     */
    @Test
    void expiredProPlan_staysDowngraded_soQuotaActuallyDrops() {
        User user = user(UserPlan.PRO);
        Subscription sub = subscription(user, proPlan, PlanSource.PAYMENT, NOW.minusMinutes(1));

        assertTrue(service.expireToFreePlan(sub, NOW));
        Subscription afterNextRequest = service.getOrCreate(user);

        assertEquals("FREE", afterNextRequest.getPlan().getCode());
        assertEquals(100_000L, afterNextRequest.getPlan().getMonthlyTokenLimit(),
                "Hạn mức phải là của gói FREE — đây là thứ checkQuota đọc live");
    }

    // ------------------------------------------------------------ hết hạn: cron + lazy

    /**
     * Đường của {@code SubscriptionExpiryJob}: job chỉ cầm id, mọi thứ còn lại nằm trong một
     * transaction ngắn của service (bean khác nên proxy {@code @Transactional} mới có tác dụng).
     */
    @Test
    void expireToFreePlanById_downgradesAndNotifiesTheUser() {
        User user = user(UserPlan.PRO);
        Subscription sub = subscription(user, proPlan, PlanSource.PAYMENT, NOW.minusMinutes(1));
        when(subscriptionRepository.findDetailById(sub.getId())).thenReturn(Optional.of(sub));

        assertTrue(service.expireToFreePlan(sub.getId(), NOW));

        assertEquals("FREE", sub.getPlan().getCode());
        assertEquals(PlanSource.FREE, sub.getPlanSource());
        assertNull(sub.getPlanExpiresAt());
        assertEquals(UserPlan.FREE, user.getPlan(), "nhãn cache phải ghi CÙNG transaction");
        verify(notificationService).notify(eq(user), eq(NotificationType.PLAN_EXPIRED),
                anyString(), anyString(), any());
        verify(activityLogService).record(any());
    }

    /** Id không còn (bản ghi đã xoá giữa lúc job quét) → im lặng trả false, không ném. */
    @Test
    void expireToFreePlanById_missingSubscription_isANoOp() {
        UUID id = UUID.randomUUID();
        when(subscriptionRepository.findDetailById(id)).thenReturn(Optional.empty());

        assertFalse(service.expireToFreePlan(id, NOW));
    }

    /**
     * Kiểm hết hạn LAZY: không cần cron chạy, chỉ cần user đụng vào hệ thống. Đây là thứ giữ
     * cho hạn mức đúng khi scheduler lỡ một nhịp (restart/deploy).
     */
    @Test
    void getOrCreate_expiredPaidPlan_isDowngradedWithoutTheCron() {
        User user = user(UserPlan.PRO);
        subscription(user, proPlan, PlanSource.PAYMENT, LocalDateTime.now().minusMinutes(1));

        Subscription result = service.getOrCreate(user);

        assertEquals("FREE", result.getPlan().getCode());
        assertEquals(UserPlan.FREE, user.getPlan());
    }

    /** {@code planExpiresAt} null = KHÔNG hết hạn (gói admin cấp) — đừng hạ nhầm. */
    @Test
    void getOrCreate_planWithoutExpiry_isNeverDowngraded() {
        User user = user(UserPlan.PRO);
        subscription(user, proPlan, PlanSource.ADMIN, null);

        Subscription result = service.getOrCreate(user);

        assertEquals("PRO", result.getPlan().getCode());
        verify(notificationService, never()).notify(any(), any(), anyString(), anyString(), any());
    }

    /**
     * Ca mà test đầu-cuối bắt được: caller truyền vào một {@code User} entity ĐÃ DETACH (session
     * khác), nên {@code syncPlanLabel} bên trong {@code expireToFreePlan} sửa nhãn trên một
     * instance khác — nhãn mà {@code getOrCreate} đọc vẫn là PRO.
     *
     * <p>Nếu nhánh đồng bộ theo nhãn không bị chặn bằng {@code justExpired}, gói vừa hết hạn sẽ
     * được khôi phục NGAY trong cùng lời gọi và việc hạ gói không bao giờ có tác dụng.</p>
     */
    @Test
    void getOrCreate_staleUserLabel_stillDoesNotResurrectTheExpiredPlan() {
        User sessionUser = user(UserPlan.PRO);
        Subscription sub = subscription(sessionUser, proPlan, PlanSource.PAYMENT, NOW.minusMinutes(1));
        when(planRepository.findByCodeAndDeletedAtIsNull("PRO")).thenReturn(Optional.of(proPlan));

        // Bản sao "đã detach": cùng id nhưng syncPlanLabel sẽ KHÔNG chạm tới nhãn của nó.
        User detached = User.builder().email(sessionUser.getEmail()).plan(UserPlan.PRO).build();
        detached.setId(sessionUser.getId());

        Subscription result = service.getOrCreate(detached);

        assertEquals("FREE", result.getPlan().getCode(),
                "Gói hết hạn KHÔNG được sống lại chỉ vì nhãn User.plan của caller còn cũ");
        assertNull(result.getPlanExpiresAt());
    }
}
