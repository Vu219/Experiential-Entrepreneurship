package com.aima.config.init;

import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.SubscriptionStatus;
import com.aima.enums.UserPlan;
import com.aima.mapper.UsageMapper;
import com.aima.repository.PlanRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Seed subscription cho các user CHƯA có (theo nhãn User.plan, kỳ = tháng lịch hiện tại) —
 * để dữ liệu per-plan/per-user của admin đầy đủ ngay, không đợi user hoạt động
 * (getOrCreate vẫn lazy-create cho user mới về sau). Idempotent: chỉ tạo cho user thiếu,
 * không ghi đè. Chạy sau PlanDataInitializer (@Order(4)) vì cần row plans.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Order(6)
public class SubscriptionDataInitializer implements CommandLineRunner {

    SubscriptionRepository subscriptionRepository;
    UserRepository userRepository;
    PlanRepository planRepository;
    UsageMapper usageMapper;

    @Override
    public void run(String... args) {
        Set<UUID> existing = new HashSet<>(subscriptionRepository.findActiveUserIds());
        Map<String, Plan> planCache = new HashMap<>();
        YearMonth month = YearMonth.now();
        LocalDateTime periodStart = month.atDay(1).atStartOfDay();
        LocalDateTime periodEnd = month.plusMonths(1).atDay(1).atStartOfDay();

        int created = 0;
        for (User user : userRepository.findAll()) {
            if (user.getDeletedAt() != null || existing.contains(user.getId())) {
                continue;
            }
            String code = user.getPlan() == null ? UserPlan.FREE.name() : user.getPlan().name();
            Plan plan = planCache.computeIfAbsent(code,
                    c -> planRepository.findByCodeAndDeletedAtIsNull(c).orElse(null));
            if (plan == null) {
                log.warn("[SubscriptionInit] Không tìm thấy gói {} — bỏ qua user {}", code, user.getId());
                continue;
            }
            Subscription subscription = usageMapper.toSubscription(user, plan, SubscriptionStatus.ACTIVE,
                    periodStart, periodEnd);
            subscriptionRepository.save(subscription);
            created++;
        }
        if (created > 0) {
            log.info("[SubscriptionInit] Seeded {} subscription(s) từ User.plan", created);
        }
    }
}
