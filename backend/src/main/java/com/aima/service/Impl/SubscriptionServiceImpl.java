package com.aima.service.Impl;

import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.SubscriptionHistory;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.DurationUnit;
import com.aima.enums.NotificationType;
import com.aima.enums.PlanSource;
import com.aima.enums.SubscriptionHistoryAction;
import com.aima.enums.SubscriptionStatus;
import com.aima.enums.UserPlan;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UsageMapper;
import com.aima.repository.PlanRepository;
import com.aima.repository.SubscriptionHistoryRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.NotificationService;
import com.aima.service.SubscriptionService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SubscriptionServiceImpl implements SubscriptionService {

    SubscriptionRepository subscriptionRepository;
    PlanRepository planRepository;
    UserRepository userRepository;
    UsageMapper usageMapper;
    NotificationService notificationService;
    ActivityLogService activityLogService;
    SubscriptionHistoryRepository subscriptionHistoryRepository;

    @Override
    @Transactional
    public Subscription getOrCreate(User user) {
        Subscription subscription = subscriptionRepository.findWithPlanByUserId(user.getId()).orElse(null);

        // Hạ gói hết hạn NGAY TẠI ĐÂY — đường bắt hết hạn KHÔNG phụ thuộc cron.
        boolean justExpired = expireToFreePlan(subscription, LocalDateTime.now());

        String planCode = user.getPlan() == null ? UserPlan.FREE.name() : user.getPlan().name();

        if (subscription == null) {
            Plan plan = planRepository.findByCodeAndDeletedAtIsNull(planCode).orElse(null);
            if (plan == null) {
                log.warn("[Subscription] Không tìm thấy gói {} — chưa tạo được subscription cho user {}",
                        planCode, user.getId());
                return null;
            }
            YearMonth month = YearMonth.now();
            subscription = usageMapper.toSubscription(user, plan, SubscriptionStatus.ACTIVE,
                    periodStart(month), periodEnd(month));
            return subscriptionRepository.save(subscription);
        }

        // Lăn kỳ TRƯỚC khi đồng bộ gói: hết currentPeriodEnd thì kỳ mới = tháng lịch hiện tại
        // (mở cho chu kỳ khác pha sau) — thứ tự này để gói hạ chờ được áp ngay khi sang kỳ mới.
        boolean periodRolled = false;
        if (!LocalDateTime.now().isBefore(subscription.getCurrentPeriodEnd())) {
            YearMonth month = YearMonth.now();
            subscription.setCurrentPeriodStart(periodStart(month));
            subscription.setCurrentPeriodEnd(periodEnd(month));
            periodRolled = true;
        }

        // Đồng bộ gói khi admin/user đã đổi User.plan (nhãn cache) mà subscription còn trỏ gói cũ.
        // NÂNG gói áp ngay giữa kỳ; HẠ gói chỉ áp từ kỳ sau — tránh mức đã dùng (vd 900K của PRO)
        // vượt ngay hạn mức gói thấp hơn và bị chặn cứng oan giữa kỳ.
        // Q4: chỉ nghe theo nhãn User.plan khi subscription CHƯA có nguồn gốc rõ ràng. Gói do
        // thanh toán/admin cấp thì subscription là nguồn sự thật — không có điều kiện này thì
        // nhánh dưới sẽ KHÔI PHỤC lại gói vừa bị job hết hạn hạ xuống (bẫy §6).
        // `!justExpired` là điều kiện BẮT BUỘC, không phải tối ưu. expireToFreePlan vừa đặt
        // planSource về FREE nên nhánh này mở lại ngay trong CÙNG lời gọi; mà nhãn User.plan
        // lúc đó theo định nghĩa là cũ (PRO) → FREE→PRO không phải "hạ gói" → gói vừa hết hạn
        // được khôi phục và việc hạ gói không bao giờ có tác dụng. Bẫy §6 quay lại bằng một
        // cửa khác. Trong cùng một transaction thì syncPlanLabel đã kịp sửa nhãn nên hiếm khi
        // lộ, nhưng chỉ cần caller truyền vào một User entity đã detach (session khác) là vỡ —
        // test đầu-cuối bắt được đúng ca đó.
        if (!justExpired
                && subscription.getPlanSource() == PlanSource.FREE
                && !planCode.equals(subscription.getPlan().getCode())) {
            Plan newPlan = planRepository.findByCodeAndDeletedAtIsNull(planCode).orElse(null);
            if (newPlan == null) {
                log.warn("[Subscription] User.plan = {} nhưng không có row plans tương ứng — giữ gói cũ {}",
                        planCode, subscription.getPlan().getCode());
            } else if (periodRolled || !isDowngrade(subscription.getPlan(), newPlan)) {
                subscription.setPlan(newPlan);
            } else {
                log.info("[Subscription] User {} hạ gói {} → {} giữa kỳ — giữ gói cũ tới hết kỳ {}",
                        user.getId(), subscription.getPlan().getCode(), planCode,
                        subscription.getCurrentPeriodEnd());
            }
        }
        return subscriptionRepository.save(subscription);
    }

    @Override
    @Transactional
    public Subscription activatePaidPlan(User user, Plan plan, LocalDateTime now) {
        Subscription subscription = getOrCreate(user);
        if (subscription == null) {
            log.error("[Subscription] Không tạo được subscription cho user {} — KHÔNG kích hoạt được gói {}",
                    user.getId(), plan.getCode());
            return null;
        }

        PlanSnapshot before = snapshot(subscription);
        boolean samePlan = plan.getCode().equals(subscription.getPlan().getCode());
        LocalDateTime currentExpiry = subscription.getPlanExpiresAt();
        // Q1 — trùng gói thì CỘNG DỒN từ hạn cũ nếu còn hạn; nâng gói thì thay thế từ now.
        // planExpiresAt null ở đây nghĩa là "không có hạn đang chạy" (gói Free) → cộng từ now.
        LocalDateTime base = samePlan && currentExpiry != null && currentExpiry.isAfter(now)
                ? currentExpiry
                : now;

        subscription.setPlan(plan);
        subscription.setPlanSource(PlanSource.PAYMENT);
        subscription.setPlanExpiresAt(base.plusMonths(billingMonths(plan)));
        if (!samePlan || subscription.getPlanStartedAt() == null) {
            subscription.setPlanStartedAt(now);
        }

        syncPlanLabel(user, plan.getCode());
        log.info("[Subscription] User {} kích hoạt gói {} ({}) — hạn tới {}",
                user.getId(), plan.getCode(), samePlan ? "cộng dồn" : "thay thế",
                subscription.getPlanExpiresAt());
        subscriptionRepository.save(subscription);
        recordHistory(SubscriptionHistoryAction.PAYMENT_ACTIVATED, before, subscription, null, null, null);
        return subscription;
    }

    @Override
    @Transactional
    public Subscription extendPlan(User user, int amount, DurationUnit unit, LocalDateTime now,
                                   AdminChange change) {
        if (!unit.allows(amount)) {
            throw new AppException(ErrorCode.SUBSCRIPTION_DURATION_INVALID);
        }
        Subscription subscription = requireSubscription(user);
        LocalDateTime currentExpiry = subscription.getPlanExpiresAt();
        // Free hoặc gói không hết hạn: không có mốc nào để cộng dồn — admin phải dùng Đổi gói.
        if (currentExpiry == null || UserPlan.FREE.name().equals(subscription.getPlan().getCode())) {
            throw new AppException(ErrorCode.SUBSCRIPTION_NOT_EXTENDABLE);
        }
        PlanSnapshot before = snapshot(subscription);

        // getOrCreate vừa hạ gói đã hết hạn nên currentExpiry gần như luôn ở tương lai; nhánh
        // `now` chỉ phòng lệch giữa hai lần đọc đồng hồ.
        LocalDateTime base = currentExpiry.isAfter(now) ? currentExpiry : now;
        // Giữ nguyên plan, planSource (gói tự mua vẫn là PAYMENT) và planStartedAt — gia hạn là
        // tặng thêm thời gian, không phải một vòng đời gói mới.
        subscription.setPlanExpiresAt(unit.addTo(base, amount));

        subscriptionRepository.save(subscription);
        recordHistory(SubscriptionHistoryAction.ADMIN_EXTENDED, before, subscription, change, amount, unit);
        log.info("[Subscription] Admin {} gia hạn gói {} của user {} thêm {} {}: {} → {}",
                change.actorEmail(), before.planCode(), user.getId(), amount, unit,
                currentExpiry, subscription.getPlanExpiresAt());
        return subscription;
    }

    @Override
    @Transactional
    public Subscription changePlan(User user, Plan plan, Integer amount, DurationUnit unit, LocalDateTime now,
                                   AdminChange change) {
        if (UserPlan.FREE.name().equals(plan.getCode())) {
            throw new AppException(ErrorCode.SUBSCRIPTION_CHANGE_TO_FREE);
        }
        if (unit != null && !unit.allows(amount)) {
            throw new AppException(ErrorCode.SUBSCRIPTION_DURATION_INVALID);
        }
        Subscription subscription = requireSubscription(user);
        // Trùng gói đang có hạn → đó là gia hạn, không phải đổi gói (đổi sẽ ghi đè hạn cũ).
        // Trùng gói không hết hạn vẫn cho đổi khi admin muốn đặt một thời hạn cụ thể.
        boolean samePlan = plan.getCode().equals(subscription.getPlan().getCode());
        if (samePlan && (subscription.getPlanExpiresAt() != null || unit == null)) {
            throw new AppException(ErrorCode.SUBSCRIPTION_SAME_PLAN);
        }
        PlanSnapshot before = snapshot(subscription);

        subscription.setPlan(plan);
        // ADMIN, không phải PAYMENT: trang doanh thu và mọi báo cáo sau này phải phân biệt được
        // gói bán được với gói tặng/đền bù, nếu không con số doanh thu sẽ nói dối.
        subscription.setPlanSource(PlanSource.ADMIN);
        subscription.setPlanStartedAt(now);
        subscription.setPlanExpiresAt(unit == null ? null : unit.addTo(now, amount));

        syncPlanLabel(user, plan.getCode());
        subscriptionRepository.save(subscription);
        recordHistory(SubscriptionHistoryAction.ADMIN_CHANGED, before, subscription, change,
                unit == null ? null : amount, unit);
        log.info("[Subscription] Admin {} đổi gói user {}: {} → {} (hạn {})", change.actorEmail(),
                user.getId(), before.planCode(), plan.getCode(),
                subscription.getPlanExpiresAt() == null ? "vô hạn" : subscription.getPlanExpiresAt());
        return subscription;
    }

    @Override
    @Transactional
    public Subscription revokeToFree(User user, LocalDateTime now, AdminChange change) {
        Subscription subscription = requireSubscription(user);
        if (UserPlan.FREE.name().equals(subscription.getPlan().getCode())) {
            throw new AppException(ErrorCode.SUBSCRIPTION_ALREADY_FREE);
        }
        Plan freePlan = planRepository.findByCodeAndDeletedAtIsNull(UserPlan.FREE.name())
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_FOUND));
        PlanSnapshot before = snapshot(subscription);

        // Cùng trạng thái cuối với expireToFreePlan: Free không có vòng đời, và planSource FREE
        // để nhánh đồng bộ nhãn trong getOrCreate hoạt động lại như với mọi user Free khác.
        subscription.setPlan(freePlan);
        subscription.setPlanSource(PlanSource.FREE);
        subscription.setPlanStartedAt(null);
        subscription.setPlanExpiresAt(null);

        syncPlanLabel(user, freePlan.getCode());
        subscriptionRepository.save(subscription);
        recordHistory(SubscriptionHistoryAction.ADMIN_REVOKED, before, subscription, change, null, null);
        log.info("[Subscription] Admin {} thu hồi gói {} của user {} — đã hạ về FREE",
                change.actorEmail(), before.planCode(), user.getId());
        return subscription;
    }

    @Override
    @Transactional
    public boolean expireToFreePlan(UUID subscriptionId, LocalDateTime now) {
        Subscription subscription = subscriptionRepository.findDetailById(subscriptionId).orElse(null);
        if (subscription == null) {
            return false;
        }
        return expireToFreePlan(subscription, now);
    }

    @Override
    @Transactional
    public boolean expireToFreePlan(Subscription subscription, LocalDateTime now) {
        if (subscription == null || subscription.getPlanExpiresAt() == null
                || subscription.getPlanExpiresAt().isAfter(now)) {
            return false;
        }
        Plan freePlan = planRepository.findByCodeAndDeletedAtIsNull(UserPlan.FREE.name()).orElse(null);
        if (freePlan == null) {
            log.error("[Subscription] Thiếu gói FREE trong bảng plans — không hạ gói được cho user {}",
                    subscription.getUser().getId());
            return false;
        }

        PlanSnapshot before = snapshot(subscription);
        String previous = before.planCode();
        subscription.setPlan(freePlan);
        subscription.setPlanSource(PlanSource.FREE);
        subscription.setPlanStartedAt(null);
        subscription.setPlanExpiresAt(null);

        syncPlanLabel(subscription.getUser(), freePlan.getCode());
        subscriptionRepository.save(subscription);
        recordHistory(SubscriptionHistoryAction.EXPIRED, before, subscription,
                null, null, null);
        log.info("[Subscription] User {} hết hạn gói {} — đã hạ về FREE",
                subscription.getUser().getId(), previous);
        announceDowngrade(subscription.getUser(), previous);
        return true;
    }

    /** Subscription hiện hành (đã qua lazy-expiry của getOrCreate) — thao tác admin bắt buộc phải có. */
    private Subscription requireSubscription(User user) {
        Subscription subscription = getOrCreate(user);
        if (subscription == null) {
            throw new AppException(ErrorCode.SUBSCRIPTION_NOT_FOUND);
        }
        return subscription;
    }

    private static PlanSnapshot snapshot(Subscription subscription) {
        return new PlanSnapshot(subscription.getPlan().getCode(), subscription.getPlanExpiresAt(),
                subscription.getPlanSource());
    }

    /**
     * Một dòng {@code subscription_history} — CÙNG transaction với việc đổi gói: đổi gói rollback
     * thì lịch sử cũng rollback, và không có thay đổi gói nào thiếu vết. {@code change} null =
     * sự kiện hệ thống (thanh toán, hết hạn).
     */
    private void recordHistory(SubscriptionHistoryAction action, PlanSnapshot before,
                               Subscription after, AdminChange change, Integer extendAmount,
                               DurationUnit extendUnit) {
        SubscriptionHistory history = usageMapper.toSubscriptionHistory(action, before, after, change,
                extendAmount, extendUnit);
        subscriptionHistoryRepository.save(history);
    }

    /**
     * Báo cho user + để lại vết audit khi gói bị hạ. Cả hai đều best-effort (notification tự
     * nuốt lỗi, activity log chạy async) — hạ gói đã commit rồi thì không được phép rollback
     * chỉ vì gửi thông báo hỏng.
     */
    private void announceDowngrade(User user, String previousPlanCode) {
        notificationService.notify(user, NotificationType.PLAN_EXPIRED,
                "Gói " + previousPlanCode + " đã hết hạn",
                "Tài khoản của bạn đã chuyển về gói Free. Hạn mức token áp dụng ngay từ bây giờ —"
                        + " gia hạn để tiếp tục dùng hạn mức cũ.",
                null);
        activityLogService.record(new ActivityLogService.Entry(
                ActivityAction.PLAN_CHANGED, user.getId(), user.getEmail(),
                "SUBSCRIPTION", user.getId().toString(), null,
                Map.of("from", previousPlanCode, "to", UserPlan.FREE.name(), "reason", "PLAN_EXPIRED")));
    }

    /**
     * Cập nhật nhãn cache {@code User.plan} theo gói thật — CÙNG transaction với việc ghi
     * subscription, nếu không {@link #getOrCreate} sẽ thấy lệch và cố "sửa" ngược lại.
     *
     * <p>Gói admin tự tạo (code ngoài FREE/PLUS/PRO) không có giá trị enum tương ứng →
     * <b>giữ nguyên nhãn cũ</b> (Q4). Lúc đó nhãn và subscription lệch nhau là CHẤP NHẬN ĐƯỢC
     * vì nhánh sync trong {@code getOrCreate} đã bị khoá theo {@code planSource}.</p>
     */
    private void syncPlanLabel(User user, String planCode) {
        UserPlan label;
        try {
            label = UserPlan.valueOf(planCode);
        } catch (IllegalArgumentException e) {
            log.debug("[Subscription] Gói {} không có nhãn UserPlan tương ứng — giữ nhãn cũ {}",
                    planCode, user.getPlan());
            return;
        }
        if (label != user.getPlan()) {
            user.setPlan(label);
            userRepository.save(user);
        }
    }

    /** Chu kỳ tính hạn dùng, lấy từ gói (CHECK > 0 do PlanDataInitializer tạo). */
    private static int billingMonths(Plan plan) {
        Short months = plan.getBillingIntervalMonths();
        return months == null || months <= 0 ? 1 : months;
    }

    /** Hạ gói = hạn mức token nhỏ hơn hạn mức hiện tại (null = không giới hạn, coi là cao nhất). */
    private static boolean isDowngrade(Plan current, Plan target) {
        Long currentLimit = current.getMonthlyTokenLimit();
        Long targetLimit = target.getMonthlyTokenLimit();
        if (targetLimit == null) {
            return false;
        }
        return currentLimit == null || targetLimit < currentLimit;
    }

    private static LocalDateTime periodStart(YearMonth month) {
        return month.atDay(1).atStartOfDay();
    }

    private static LocalDateTime periodEnd(YearMonth month) {
        return month.plusMonths(1).atDay(1).atStartOfDay();
    }
}
