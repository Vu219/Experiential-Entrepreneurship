package com.aima.service.Impl;

import com.aima.dto.event.SubscriptionPlanChangedEvent;
import com.aima.entity.Plan;
import com.aima.entity.PostSchedule;
import com.aima.entity.User;
import com.aima.enums.HoldReason;
import com.aima.enums.Platform;
import com.aima.enums.PlanLimitKey;
import com.aima.enums.ScheduleStatus;
import com.aima.repository.PlanRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ContentItemStatusResolver;
import com.aima.service.EntitlementHoldService;
import com.aima.service.PlanLimitService;
import com.aima.service.ScheduleHeldNotifier;
import com.aima.service.ScheduleHoldService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class EntitlementHoldServiceImpl implements EntitlementHoldService {

    static final List<ScheduleStatus> PENDING = List.of(ScheduleStatus.SCHEDULED, ScheduleStatus.ON_HOLD);

    PostScheduleRepository scheduleRepository;
    PlanRepository planRepository;
    SubscriptionRepository subscriptionRepository;
    UserRepository userRepository;
    PlanLimitService planLimitService;
    ScheduleHoldService holdService;
    ContentItemStatusResolver statusResolver;
    ScheduleHeldNotifier heldNotifier;

    @Override
    @EventListener
    public void onPlanChanged(SubscriptionPlanChangedEvent event) {
        Plan plan = planRepository.findById(event.planId()).orElse(null);
        User user = userRepository.findById(event.userId()).orElse(null);
        if (plan == null || user == null) {
            return;
        }
        int held = sync(user, planLimitService.featuresOf(plan));
        if (held > 0) {
            log.info("[Entitlement] User {} đổi sang gói {} — {} lịch chưa đăng chuyển Tạm giữ", user.getId(),
                    plan.getCode(), held);
        }
    }

    @Override
    public int syncPlanSubscribers(UUID planId) {
        Plan plan = planRepository.findById(planId).orElse(null);
        if (plan == null) {
            return 0;
        }
        PlanLimitService.FeatureLimits limits = planLimitService.featuresOf(plan);
        int held = 0;
        for (UUID userId : subscriptionRepository.findUserIdsByPlanId(planId)) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                held += sync(user, limits);
            }
        }
        return held;
    }

    /**
     * Giữ lịch chưa đăng ngoài quyền của {@code limits}. Đọc giới hạn của GÓI truyền vào (không gọi lại
     * {@code SubscriptionService.getOrCreate} — listener chạy giữa lúc đổi gói, gọi lại có thể khôi phục gói cũ).
     */
    private int sync(User user, PlanLimitService.FeatureLimits limits) {
        boolean scheduling = limits.included(PlanLimitKey.SCHEDULING);
        List<PostSchedule> pending = scheduleRepository.findByPlatformAccount_User_IdAndStatusInAndDeletedAtIsNull(
                user.getId(), PENDING);
        Map<PostSchedule, HoldReason> toHold = new LinkedHashMap<>();
        for (PostSchedule schedule : pending) {
            Platform platform = schedule.getPlatformAccount().getPlatformName();
            if (!limits.allows(platform)) {
                toHold.put(schedule, HoldReason.PLAN_PLATFORM_EXCLUDED);
            } else if (!scheduling) {
                toHold.put(schedule, HoldReason.PLAN_SCHEDULING_DISABLED);
            }
        }
        if (toHold.isEmpty()) {
            return 0;
        }
        Set<UUID> itemIds = new HashSet<>();
        toHold.keySet().forEach(schedule -> itemIds.add(schedule.getContentVersion().getContentItem().getId()));
        statusResolver.lockAll(itemIds);
        Map<String, Integer> counts = new LinkedHashMap<>();
        int held = 0;
        for (Map.Entry<PostSchedule, HoldReason> entry : toHold.entrySet()) {
            if (holdService.hold(entry.getKey(), entry.getValue())) {
                held++;
                counts.merge(entry.getValue().name() + "|" + entry.getKey().getPlatformAccount().getPlatformName().name(),
                        1, Integer::sum);
            }
        }
        statusResolver.refreshAll(itemIds);
        long stamp = Instant.now().getEpochSecond() / 60;
        counts.forEach((key, count) -> {
            String[] parts = key.split("\\|");
            HoldReason reason = HoldReason.valueOf(parts[0]);
            Platform platform = Platform.valueOf(parts[1]);
            heldNotifier.notifyBatch(user, reason, platform, count,
                    "schedule-held:" + reason + ":" + platform + ":" + user.getId() + ":plan:" + limits.planCode() + ":" + stamp);
        });
        return held;
    }
}
