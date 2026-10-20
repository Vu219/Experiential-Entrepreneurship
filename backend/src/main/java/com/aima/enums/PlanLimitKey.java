package com.aima.enums;

import com.aima.entity.PlanFeatureLimits;

import java.util.function.Function;

/**
 * Danh mục giới hạn tính năng theo gói — tên khoá dùng chung BE/FE ({@code limitKey} trong lỗi
 * {@code PLAN_LIMIT_REACHED}/{@code PLAN_FEATURE_NOT_INCLUDED} và trong {@code GET /users/me/plan-usage}).
 * Thêm giới hạn = thêm cột vào {@link PlanFeatureLimits} (migration mới) + một dòng ở đây.
 */
public enum PlanLimitKey {

    BRAND_PROFILES(Type.QUOTA, PlanFeatureLimits::getBrandProfiles),
    STRATEGIES_PER_BRAND(Type.QUOTA, PlanFeatureLimits::getStrategiesPerBrand),
    CONNECTED_CHANNELS(Type.QUOTA, PlanFeatureLimits::getConnectedChannels),
    TREND_RESEARCH_PER_PERIOD(Type.QUOTA, PlanFeatureLimits::getTrendResearchPerPeriod),
    AUTO_TREND_RESEARCH(Type.FLAG, PlanFeatureLimits::getAutoTrendResearch),
    IDEAS_PER_RESEARCH(Type.CAP, PlanFeatureLimits::getIdeasPerResearch),
    SCHEDULING(Type.FLAG, PlanFeatureLimits::getScheduling),
    SCHEDULED_POSTS_PER_PERIOD(Type.QUOTA, PlanFeatureLimits::getScheduledPostsPerPeriod),
    ACTIVE_SCHEDULES(Type.QUOTA, PlanFeatureLimits::getActiveSchedules),
    SCHEDULE_HORIZON_DAYS(Type.CAP, PlanFeatureLimits::getScheduleHorizonDays),
    GOLDEN_HOURS(Type.FLAG, PlanFeatureLimits::getGoldenHours),
    ANALYTICS_HISTORY_DAYS(Type.CAP, PlanFeatureLimits::getAnalyticsHistoryDays),
    ANALYTICS_ADVANCED(Type.FLAG, PlanFeatureLimits::getAnalyticsAdvanced),
    ANALYTICS_EXPORT(Type.FLAG, PlanFeatureLimits::getAnalyticsExport),
    STRATEGY_OPTIMIZATION_PER_PERIOD(Type.QUOTA, PlanFeatureLimits::getStrategyOptimizationPerPeriod);

    /**
     * QUOTA = đếm số đã dùng rồi so hạn mức; CAP = trần của một giá trị (số ngày, số ý tưởng) — không đếm;
     * FLAG = bật/tắt.
     */
    public enum Type { QUOTA, CAP, FLAG }

    private final Type type;
    private final Function<PlanFeatureLimits, Object> column;

    PlanLimitKey(Type type, Function<PlanFeatureLimits, Object> column) {
        this.type = type;
        this.column = column;
    }

    public Type type() {
        return type;
    }

    /** Giá trị THÔ trên gói (Integer/Boolean, null = mặc định hệ thống). */
    public Object rawValue(PlanFeatureLimits limits) {
        return limits == null ? null : column.apply(limits);
    }

    /** Tên thuộc tính trong {@code aima.plan-limits.defaults.*} (kebab-case). */
    public String propertyName() {
        return name().toLowerCase().replace('_', '-');
    }
}
