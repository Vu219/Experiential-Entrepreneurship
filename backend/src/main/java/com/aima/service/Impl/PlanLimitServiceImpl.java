package com.aima.service.Impl;

import com.aima.entity.Plan;
import com.aima.entity.PlanFeatureLimits;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.PlanLimitKey;
import com.aima.enums.UserPlan;
import com.aima.repository.PlanRepository;
import com.aima.service.PlanLimitService;
import com.aima.service.SubscriptionService;
import jakarta.annotation.PostConstruct;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class PlanLimitServiceImpl implements PlanLimitService {

    /** Biến env cũ theo TÊN gói (trước V15) — chỉ còn đọc để tương thích ngược, sẽ bỏ ở bản sau. */
    static final String LEGACY_POLICY_CHECK_ENV_PREFIX = "AIMA_POLICY_CHECK_AI_LIMIT_";

    /** Mặc định hệ thống của giới hạn tính năng (V18) — một thuộc tính mỗi {@link PlanLimitKey}. */
    static final String DEFAULTS_PREFIX = "aima.plan-limits.defaults.";

    SubscriptionService subscriptionService;
    PlanRepository planRepository;
    Environment environment;

    @NonFinal
    @Value("${aima.ai-assist.policy-check.ai-monthly-limit-default:0}")
    int policyCheckDefault;

    @NonFinal
    @Value("${aima.ai-assist.fix-max-per-version:3}")
    int aiFixDefault;

    /** Mã gói → giá trị env cũ còn được đặt (deprecated). */
    @NonFinal
    Map<String, Integer> legacyPolicyCheckLimits = Map.of();

    @PostConstruct
    void readLegacyEnv() {
        Map<String, Integer> legacy = new HashMap<>();
        for (UserPlan code : UserPlan.values()) {
            String name = LEGACY_POLICY_CHECK_ENV_PREFIX + code.name();
            String raw = environment.getProperty(name);
            if (raw == null || raw.isBlank()) {
                continue;
            }
            try {
                legacy.put(code.name(), Integer.parseInt(raw.strip()));
                log.warn("[PlanLimit] {} đã DEPRECATED — giới hạn AI kiểm tra chính sách nay cấu hình theo từng gói "
                        + "(admin → Quản lý gói). Giá trị {} chỉ còn dùng cho gói {} khi gói để \"Mặc định\"; "
                        + "hãy xoá biến này và dùng AIMA_POLICY_CHECK_AI_LIMIT_DEFAULT.", name, raw.strip(), code);
            } catch (NumberFormatException e) {
                log.warn("[PlanLimit] Bỏ qua {}={} (không phải số) — biến này đã DEPRECATED", name, raw);
            }
        }
        legacyPolicyCheckLimits = Map.copyOf(legacy);
    }

    @Override
    public PlanLimits resolve(User user) {
        Plan plan = currentPlan(user);
        if (plan == null) {
            return defaults();
        }
        Integer policyCheck = plan.getPolicyCheckAiMonthlyLimit() != null
                ? plan.getPolicyCheckAiMonthlyLimit()
                : legacyPolicyCheckLimits.getOrDefault(plan.getCode(), policyCheckDefault);
        Integer aiFix = plan.getAiFixMaxPerVersion() != null ? plan.getAiFixMaxPerVersion() : aiFixDefault;
        return new PlanLimits(plan.getCode(), effective(policyCheck), effective(aiFix));
    }

    @Override
    public PlanLimits defaults() {
        return new PlanLimits(null, effective(policyCheckDefault), effective(aiFixDefault));
    }

    @Override
    public FeatureLimits features(User user) {
        Plan plan = currentPlan(user);
        PlanFeatureLimits columns = plan == null ? null : plan.getFeatureLimits();
        Map<PlanLimitKey, Long> values = new EnumMap<>(PlanLimitKey.class);
        for (PlanLimitKey key : PlanLimitKey.values()) {
            Object raw = key.rawValue(columns);
            values.put(key, effectiveFeature(key, raw != null ? raw : defaultValue(key)));
        }
        return new FeatureLimits(plan == null ? null : plan.getCode(), Collections.unmodifiableMap(values));
    }

    @Override
    public PlanFeatureLimits defaultFeatureLimits() {
        return PlanFeatureLimits.builder()
                .brandProfiles((Integer) defaultValue(PlanLimitKey.BRAND_PROFILES))
                .strategiesPerBrand((Integer) defaultValue(PlanLimitKey.STRATEGIES_PER_BRAND))
                .connectedChannels((Integer) defaultValue(PlanLimitKey.CONNECTED_CHANNELS))
                .trendResearchPerPeriod((Integer) defaultValue(PlanLimitKey.TREND_RESEARCH_PER_PERIOD))
                .autoTrendResearch((Boolean) defaultValue(PlanLimitKey.AUTO_TREND_RESEARCH))
                .ideasPerResearch((Integer) defaultValue(PlanLimitKey.IDEAS_PER_RESEARCH))
                .scheduling((Boolean) defaultValue(PlanLimitKey.SCHEDULING))
                .scheduledPostsPerPeriod((Integer) defaultValue(PlanLimitKey.SCHEDULED_POSTS_PER_PERIOD))
                .activeSchedules((Integer) defaultValue(PlanLimitKey.ACTIVE_SCHEDULES))
                .scheduleHorizonDays((Integer) defaultValue(PlanLimitKey.SCHEDULE_HORIZON_DAYS))
                .goldenHours((Boolean) defaultValue(PlanLimitKey.GOLDEN_HOURS))
                .analyticsHistoryDays((Integer) defaultValue(PlanLimitKey.ANALYTICS_HISTORY_DAYS))
                .analyticsAdvanced((Boolean) defaultValue(PlanLimitKey.ANALYTICS_ADVANCED))
                .analyticsExport((Boolean) defaultValue(PlanLimitKey.ANALYTICS_EXPORT))
                .strategyOptimizationPerPeriod((Integer) defaultValue(PlanLimitKey.STRATEGY_OPTIMIZATION_PER_PERIOD))
                .build();
    }

    /**
     * Mặc định hệ thống của một khoá: {@code aima.plan-limits.defaults.<khoá>} — không đặt thì KHÔNG giới hạn / BẬT,
     * để gói admin tự tạo (cột null) giữ đúng hành vi trước V18.
     */
    private Object defaultValue(PlanLimitKey key) {
        String property = DEFAULTS_PREFIX + key.propertyName();
        if (key.type() == PlanLimitKey.Type.FLAG) {
            return environment.getProperty(property, Boolean.class, Boolean.TRUE);
        }
        return environment.getProperty(property, Integer.class, UNLIMITED);
    }

    /** FLAG: false → 0 (tắt), true → null; số: cùng quy đổi với {@link #effective(int)}. */
    private static Long effectiveFeature(PlanLimitKey key, Object raw) {
        if (raw instanceof Boolean flag) {
            return flag ? null : 0L;
        }
        return effective((Integer) raw);
    }

    /** Gói của subscription hiện hành; chưa có subscription (DB chưa seed) → gói theo nhãn, như TokenUsageService. */
    private Plan currentPlan(User user) {
        Subscription subscription = subscriptionService.getOrCreate(user);
        if (subscription != null) {
            return subscription.getPlan();
        }
        String code = user.getPlan() == null ? UserPlan.FREE.name() : user.getPlan().name();
        return planRepository.findByCodeAndDeletedAtIsNull(code).orElse(null);
    }

    /** -1 → null (không giới hạn); số âm khác (cấu hình sai) → 0 = tắt, không bao giờ thành "vô hạn" ngoài ý muốn. */
    private static Long effective(int value) {
        return value == UNLIMITED ? null : (long) Math.max(0, value);
    }
}
