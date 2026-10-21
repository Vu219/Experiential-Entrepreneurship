package com.aima.service.Impl;

import com.aima.config.init.PlanDataInitializer;
import com.aima.entity.Plan;
import com.aima.entity.PlanFeatureLimits;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.Platform;
import com.aima.enums.PlanLimitKey;
import com.aima.enums.UserPlan;
import com.aima.repository.PlanRepository;
import com.aima.service.PlanLimitService;
import com.aima.service.SubscriptionService;
import com.aima.util.PlatformCsv;
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
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class PlanLimitServiceImpl implements PlanLimitService {

    /** Biến env cũ theo TÊN gói (trước V15) — chỉ còn đọc để tương thích ngược, sẽ bỏ ở bản sau. */
    static final String LEGACY_POLICY_CHECK_ENV_PREFIX = "AIMA_POLICY_CHECK_AI_LIMIT_";

    /** Mặc định hệ thống của giới hạn tính năng (V18/V20) — một thuộc tính mỗi {@link PlanLimitKey}. */
    static final String DEFAULTS_PREFIX = "aima.plan-limits.defaults.";

    /** Mặc định nền tảng khi không cấu hình: chỉ Facebook (V20) — không mở nền tảng mới ngoài ý muốn. */
    static final String DEFAULT_ALLOWED_PLATFORMS = "FACEBOOK";

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
    public FeatureLimits features(User user) {
        return featuresOf(currentPlan(user));
    }

    @Override
    public FeatureLimits featuresOf(Plan plan) {
        // Fail-closed: không tra được gói → giới hạn gói FREE lõi, không bao giờ "toàn mặc định = không giới hạn".
        PlanFeatureLimits columns = plan == null
                ? PlanDataInitializer.coreFeatureLimits(UserPlan.FREE.name())
                : plan.getFeatureLimits();
        String planCode = plan == null ? UserPlan.FREE.name() : plan.getCode();
        Map<PlanLimitKey, Long> values = new EnumMap<>(PlanLimitKey.class);
        Set<Platform> platforms = Set.of();
        for (PlanLimitKey key : PlanLimitKey.values()) {
            Object raw = key.rawValue(columns);
            if (raw == null) {
                raw = defaultValue(key, planCode);
            }
            if (key.type() == PlanLimitKey.Type.SET) {
                platforms = PlatformCsv.parse((String) raw);
                values.put(key, (long) platforms.size());
            } else {
                values.put(key, effectiveFeature(raw));
            }
        }
        return new FeatureLimits(planCode, Collections.unmodifiableMap(values), platforms);
    }

    @Override
    public PlanFeatureLimits defaultFeatureLimits() {
        PlanFeatureLimits defaults = new PlanFeatureLimits();
        for (PlanLimitKey key : PlanLimitKey.values()) {
            key.write(defaults, defaultValue(key, null));
        }
        return defaults;
    }

    /**
     * Mặc định hệ thống của một khoá. Giới hạn tính năng: {@code aima.plan-limits.defaults.<khoá>} — không đặt thì KHÔNG
     * giới hạn / BẬT (hành vi trước V18), riêng nền tảng mặc định chỉ FACEBOOK. Hai khoá AI giữ nguồn V15
     * ({@code aima.ai-assist.*}, env cũ theo mã gói cho lượt kiểm tra chính sách).
     */
    private Object defaultValue(PlanLimitKey key, String planCode) {
        return switch (key) {
            case POLICY_CHECK_AI_PER_PERIOD -> planCode != null && legacyPolicyCheckLimits.containsKey(planCode)
                    ? legacyPolicyCheckLimits.get(planCode) : policyCheckDefault;
            case AI_FIX_PER_VERSION -> aiFixDefault;
            default -> switch (key.type()) {
                case FLAG -> environment.getProperty(DEFAULTS_PREFIX + key.propertyName(), Boolean.class, Boolean.TRUE);
                case SET -> PlatformCsv.format(PlatformCsv.parse(environment.getProperty(
                        DEFAULTS_PREFIX + key.propertyName(), DEFAULT_ALLOWED_PLATFORMS)));
                default -> environment.getProperty(DEFAULTS_PREFIX + key.propertyName(), Integer.class, UNLIMITED);
            };
        };
    }

    /** FLAG: false → 0 (tắt), true → null; số: -1 → null (không giới hạn), âm khác (cấu hình sai) → 0 = tắt. */
    private static Long effectiveFeature(Object raw) {
        if (raw instanceof Boolean flag) {
            return flag ? null : 0L;
        }
        int value = (Integer) raw;
        return value == UNLIMITED ? null : (long) Math.max(0, value);
    }

    /**
     * Gói của subscription hiện hành. Chưa có subscription (getOrCreate không tạo được) → gói theo nhãn, rồi gói FREE;
     * vẫn không có → null = fail-closed giới hạn FREE lõi ({@link #featuresOf}).
     */
    private Plan currentPlan(User user) {
        Subscription subscription = subscriptionService.getOrCreate(user);
        if (subscription != null) {
            return subscription.getPlan();
        }
        String code = user.getPlan() == null ? UserPlan.FREE.name() : user.getPlan().name();
        return planRepository.findByCodeAndDeletedAtIsNull(code)
                .or(() -> planRepository.findByCodeAndDeletedAtIsNull(UserPlan.FREE.name()))
                .orElse(null);
    }
}
