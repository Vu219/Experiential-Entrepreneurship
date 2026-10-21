package com.aima.enums;

import com.aima.entity.PlanFeatureLimits;

import java.util.function.BiConsumer;
import java.util.function.Function;

/**
 * Danh mục giới hạn tính năng theo gói — tên khoá dùng chung BE/FE ({@code limitKey} trong lỗi
 * {@code PLAN_LIMIT_REACHED}/{@code PLAN_FEATURE_NOT_INCLUDED}, trong {@code GET /users/me/plan-usage} và trong dòng
 * bảng so sánh liên kết giới hạn). Thêm giới hạn = thêm cột vào {@link PlanFeatureLimits} (migration mới) + một dòng ở
 * đây + mặc định {@code aima.plan-limits.defaults.*}.
 */
public enum PlanLimitKey {

    BRAND_PROFILES(Type.QUOTA, PlanFeatureLimits::getBrandProfiles, (l, v) -> l.setBrandProfiles((Integer) v)),
    STRATEGIES_PER_BRAND(Type.QUOTA, PlanFeatureLimits::getStrategiesPerBrand, (l, v) -> l.setStrategiesPerBrand((Integer) v)),
    CONNECTED_CHANNELS(Type.QUOTA, PlanFeatureLimits::getConnectedChannels, (l, v) -> l.setConnectedChannels((Integer) v)),
    ALLOWED_PLATFORMS(Type.SET, PlanFeatureLimits::getAllowedPlatforms, (l, v) -> l.setAllowedPlatforms((String) v)),
    TREND_RESEARCH_PER_PERIOD(Type.QUOTA, PlanFeatureLimits::getTrendResearchPerPeriod, (l, v) -> l.setTrendResearchPerPeriod((Integer) v)),
    AUTO_TREND_RESEARCH(Type.FLAG, PlanFeatureLimits::getAutoTrendResearch, (l, v) -> l.setAutoTrendResearch((Boolean) v)),
    IDEAS_PER_RESEARCH(Type.CAP, PlanFeatureLimits::getIdeasPerResearch, (l, v) -> l.setIdeasPerResearch((Integer) v)),
    SCHEDULING(Type.FLAG, PlanFeatureLimits::getScheduling, (l, v) -> l.setScheduling((Boolean) v)),
    SCHEDULED_POSTS_PER_PERIOD(Type.QUOTA, PlanFeatureLimits::getScheduledPostsPerPeriod, (l, v) -> l.setScheduledPostsPerPeriod((Integer) v)),
    ACTIVE_SCHEDULES(Type.QUOTA, PlanFeatureLimits::getActiveSchedules, (l, v) -> l.setActiveSchedules((Integer) v)),
    SCHEDULE_HORIZON_DAYS(Type.CAP, PlanFeatureLimits::getScheduleHorizonDays, (l, v) -> l.setScheduleHorizonDays((Integer) v)),
    GOLDEN_HOURS(Type.FLAG, PlanFeatureLimits::getGoldenHours, (l, v) -> l.setGoldenHours((Boolean) v)),
    ANALYTICS_HISTORY_DAYS(Type.CAP, PlanFeatureLimits::getAnalyticsHistoryDays, (l, v) -> l.setAnalyticsHistoryDays((Integer) v)),
    ANALYTICS_ADVANCED(Type.FLAG, PlanFeatureLimits::getAnalyticsAdvanced, (l, v) -> l.setAnalyticsAdvanced((Boolean) v)),
    ANALYTICS_EXPORT(Type.FLAG, PlanFeatureLimits::getAnalyticsExport, (l, v) -> l.setAnalyticsExport((Boolean) v)),
    STRATEGY_OPTIMIZATION_PER_PERIOD(Type.QUOTA, PlanFeatureLimits::getStrategyOptimizationPerPeriod,
            (l, v) -> l.setStrategyOptimizationPerPeriod((Integer) v)),
    /** Lượt AI kiểm tra chính sách mỗi kỳ (V15) — hết lượt không ném lỗi, chỉ bỏ tầng AI. */
    POLICY_CHECK_AI_PER_PERIOD(Type.QUOTA, PlanFeatureLimits::getPolicyCheckAiPerPeriod, (l, v) -> l.setPolicyCheckAiPerPeriod((Integer) v)),
    /** Số lần AI sửa bài mỗi bản nền tảng (V15) — đếm theo bản, không theo kỳ. */
    AI_FIX_PER_VERSION(Type.CAP, PlanFeatureLimits::getAiFixPerVersion, (l, v) -> l.setAiFixPerVersion((Integer) v));

    /**
     * QUOTA = đếm số đã dùng rồi so hạn mức; CAP = trần của một giá trị (số ngày, số ý tưởng) — không đếm;
     * FLAG = bật/tắt; SET = tập nền tảng được phép (CSV).
     */
    public enum Type { QUOTA, CAP, FLAG, SET }

    private final Type type;
    private final Function<PlanFeatureLimits, Object> column;
    private final BiConsumer<PlanFeatureLimits, Object> writer;

    PlanLimitKey(Type type, Function<PlanFeatureLimits, Object> column, BiConsumer<PlanFeatureLimits, Object> writer) {
        this.type = type;
        this.column = column;
        this.writer = writer;
    }

    public Type type() {
        return type;
    }

    /** Giá trị THÔ trên gói (Integer/Boolean/String CSV, null = mặc định hệ thống). */
    public Object rawValue(PlanFeatureLimits limits) {
        return limits == null ? null : column.apply(limits);
    }

    /** Ghi giá trị THÔ (null = về mặc định hệ thống). */
    public void write(PlanFeatureLimits limits, Object value) {
        writer.accept(limits, value);
    }

    /** Tên thuộc tính trong {@code aima.plan-limits.defaults.*} (kebab-case). */
    public String propertyName() {
        return name().toLowerCase().replace('_', '-');
    }
}
