package com.aima.service.Impl;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PlanLimitViolationResponse;
import com.aima.dto.response.PlanFeatureUsageItemResponse;
import com.aima.dto.response.PlanFeatureUsageResponse;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PlanLimitKey;
import com.aima.enums.ResearchTrigger;
import com.aima.enums.ScheduleStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.exception.PlanLimitException;
import com.aima.mapper.PlanMapper;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.StrategyOptimizationJobRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.TrendResearchSessionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.PlanLimitService;
import com.aima.service.PlanLimitService.FeatureLimits;
import com.aima.service.PlanUsageService;
import com.aima.service.SubscriptionService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class PlanUsageServiceImpl implements PlanUsageService {

    /** Lịch "đang chờ" tính vào ACTIVE_SCHEDULES. */
    static final Set<ScheduleStatus> ACTIVE_SCHEDULE_STATUSES = EnumSet.of(ScheduleStatus.SCHEDULED, ScheduleStatus.ON_HOLD);

    PlanLimitService planLimitService;
    SubscriptionService subscriptionService;
    SubscriptionRepository subscriptionRepository;
    BrandProfileRepository brandProfileRepository;
    ContentStrategyRepository contentStrategyRepository;
    PlatformAccountRepository platformAccountRepository;
    TrendResearchSessionRepository trendResearchSessionRepository;
    PostScheduleRepository postScheduleRepository;
    StrategyOptimizationJobRepository strategyOptimizationJobRepository;
    UserRepository userRepository;
    PlanMapper planMapper;

    @Override
    @Transactional
    public void requireIncluded(User user, PlanLimitKey key) {
        FeatureLimits limits = planLimitService.features(user);
        if (!limits.included(key)) {
            throw violation(ErrorCode.PLAN_FEATURE_NOT_INCLUDED, key, limits, null);
        }
    }

    @Override
    @Transactional
    public void requireQuota(User user, PlanLimitKey key, UUID scopeId) {
        if (key.type() != PlanLimitKey.Type.QUOTA) {
            throw new IllegalArgumentException(key + " không phải giới hạn đếm lượt");
        }
        FeatureLimits limits = planLimitService.features(user);
        Long limit = limits.limit(key);
        if (limit == null) {
            return;
        }
        if (limit == 0L) {
            throw violation(ErrorCode.PLAN_FEATURE_NOT_INCLUDED, key, limits, null);
        }
        // Khoá dòng subscription: request song song của cùng user xếp hàng ở đây nên cùng lắm một request lọt qua lượt cuối.
        subscriptionRepository.findForUpdateByUserId(user.getId());
        long used = countUsed(user, key, scopeId, period(user));
        if (used >= limit) {
            log.info("[PlanLimit] User {} chạm giới hạn {} ({}/{}) — gói {}", user.getId(), key, used, limit,
                    limits.planCode());
            throw violation(ErrorCode.PLAN_LIMIT_REACHED, key, limits, used);
        }
    }

    @Override
    @Transactional
    public void requireCap(User user, PlanLimitKey key, long requested) {
        FeatureLimits limits = planLimitService.features(user);
        Long cap = limits.limit(key);
        if (cap == null) {
            return;
        }
        if (cap == 0L) {
            throw violation(ErrorCode.PLAN_FEATURE_NOT_INCLUDED, key, limits, null);
        }
        if (requested > cap) {
            throw violation(ErrorCode.PLAN_LIMIT_REACHED, key, limits, requested);
        }
    }

    @Override
    @Transactional
    public Long cap(User user, PlanLimitKey key) {
        return planLimitService.features(user).limit(key);
    }

    @Override
    @Transactional
    public void requireScheduleHorizon(User user, Instant scheduledTime) {
        if (scheduledTime == null) {
            return;
        }
        long days = Math.max(0, Duration.between(Instant.now(), scheduledTime).toDays());
        // Ngày thứ N "chạm" trần khi đã trọn N ngày — làm tròn xuống nên đặt đúng N ngày sau vẫn hợp lệ.
        requireCap(user, PlanLimitKey.SCHEDULE_HORIZON_DAYS, days);
    }

    @Override
    @Transactional
    public LocalDate analyticsEarliestDate(User user, LocalDate today) {
        Long days = planLimitService.features(user).limit(PlanLimitKey.ANALYTICS_HISTORY_DAYS);
        // 0 = "tắt" vẫn cho xem hôm nay — trang Phân tích là tính năng lõi (BR-09), không khoá trắng.
        return days == null ? null : today.minusDays(Math.max(0, days - 1));
    }

    @Override
    @Transactional
    public Long remainingChannels(User user) {
        Long limit = planLimitService.features(user).limit(PlanLimitKey.CONNECTED_CHANNELS);
        if (limit == null) {
            return null;
        }
        long used = platformAccountRepository.countByUser_IdAndAccountTypeNotAndDeletedAtIsNull(
                user.getId(), PlatformAccountType.USER);
        return Math.max(0, limit - used);
    }

    @Override
    @Transactional
    public ApiResponse<PlanFeatureUsageResponse> getMyUsage(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        FeatureLimits limits = planLimitService.features(user);
        Period period = period(user);
        List<PlanFeatureUsageItemResponse> items = new ArrayList<>();
        for (PlanLimitKey key : PlanLimitKey.values()) {
            Long limit = limits.limit(key);
            // Theo từng thương hiệu thì không có một con số "đã dùng" cho cả tài khoản.
            Long used = key.type() == PlanLimitKey.Type.QUOTA && key != PlanLimitKey.STRATEGIES_PER_BRAND
                    ? countUsed(user, key, null, period) : null;
            items.add(planMapper.toUsageItem(key, key.type(), limit, used, limits.included(key)));
        }
        PlanFeatureUsageResponse response = planMapper.toUsageResponse(limits.planCode(), period.start(), period.end(), items);
        return ApiResponse.success("Mức sử dụng gói hiện tại", response);
    }

    // ------------------------------------------------------------------ helpers

    private long countUsed(User user, PlanLimitKey key, UUID scopeId, Period period) {
        UUID userId = user.getId();
        return switch (key) {
            case BRAND_PROFILES -> brandProfileRepository.countByUser_IdAndDeletedAtIsNull(userId);
            case STRATEGIES_PER_BRAND -> scopeId == null ? 0L
                    : contentStrategyRepository.countByBrandProfile_IdAndDeletedAtIsNull(scopeId);
            case CONNECTED_CHANNELS -> platformAccountRepository.countByUser_IdAndAccountTypeNotAndDeletedAtIsNull(
                    userId, PlatformAccountType.USER);
            case TREND_RESEARCH_PER_PERIOD -> trendResearchSessionRepository.countInPeriod(
                    userId, ResearchTrigger.MANUAL, period.start(), period.end());
            case SCHEDULED_POSTS_PER_PERIOD -> postScheduleRepository.countCreatedInPeriod(
                    userId, period.start(), period.end());
            case ACTIVE_SCHEDULES -> postScheduleRepository.countByPlatformAccount_User_IdAndStatusInAndDeletedAtIsNull(
                    userId, ACTIVE_SCHEDULE_STATUSES);
            case STRATEGY_OPTIMIZATION_PER_PERIOD -> strategyOptimizationJobRepository.countInPeriod(
                    userId, period.start(), period.end());
            default -> throw new IllegalArgumentException(key + " không đếm lượt");
        };
    }

    /** Kỳ tính lượt = kỳ của subscription (tháng lịch); chưa có subscription → tháng hiện tại. */
    private Period period(User user) {
        Subscription subscription = subscriptionService.getOrCreate(user);
        if (subscription != null) {
            return new Period(subscription.getCurrentPeriodStart(), subscription.getCurrentPeriodEnd());
        }
        LocalDateTime start = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        return new Period(start, start.plusMonths(1));
    }

    private PlanLimitException violation(ErrorCode code, PlanLimitKey key, FeatureLimits limits, Long used) {
        PlanLimitViolationResponse detail = planMapper.toViolation(key, limits.limit(key), used, limits.planCode());
        return new PlanLimitException(code, detail);
    }

    private record Period(LocalDateTime start, LocalDateTime end) {
    }
}
