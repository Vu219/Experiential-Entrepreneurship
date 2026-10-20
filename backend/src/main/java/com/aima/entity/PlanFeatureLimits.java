package com.aima.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Giới hạn tính năng theo gói (Flyway V18) — các cột {@code limit_*} của bảng {@code plans}, gom thành một
 * embeddable để DTO/mapper đi theo một khối. Đọc DUY NHẤT qua {@code PlanLimitService} theo khoá
 * {@link com.aima.enums.PlanLimitKey}.
 *
 * <p>Quy ước giống V15: số {@code null} = mặc định hệ thống ({@code aima.plan-limits.defaults.*}), {@code -1} = không
 * giới hạn, {@code 0} = tắt, {@code > 0} = hạn mức; cờ {@code null} = mặc định, true/false = bật/tắt. Hibernate trả
 * embeddable {@code null} khi mọi cột đều null — nơi đọc phải coi null như "toàn mặc định".</p>
 */
@Embeddable
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PlanFeatureLimits {

    @Column(name = "limit_brand_profiles")
    Integer brandProfiles;

    @Column(name = "limit_strategies_per_brand")
    Integer strategiesPerBrand;

    /** Kênh đăng được (Trang FB / IG Business / Threads) — không tính kết nối USER gốc. */
    @Column(name = "limit_connected_channels")
    Integer connectedChannels;

    /** Phiên nghiên cứu xu hướng THỦ CÔNG mỗi kỳ subscription. */
    @Column(name = "limit_trend_research_per_period")
    Integer trendResearchPerPeriod;

    /** Lượt nghiên cứu tự động 2:00 AM. */
    @Column(name = "limit_auto_trend_research")
    Boolean autoTrendResearch;

    /** Trần {@code articleCount} của một phiên nghiên cứu. */
    @Column(name = "limit_ideas_per_research")
    Integer ideasPerResearch;

    /** Chế độ lên lịch (SCHEDULE); tắt thì chỉ còn "Đăng ngay". */
    @Column(name = "limit_scheduling")
    Boolean scheduling;

    /** Số lịch đăng TẠO trong kỳ (gồm "Đăng ngay"). */
    @Column(name = "limit_scheduled_posts_per_period")
    Integer scheduledPostsPerPeriod;

    /** Số lịch đang chờ (SCHEDULED/ON_HOLD) cùng lúc. */
    @Column(name = "limit_active_schedules")
    Integer activeSchedules;

    /** Đặt lịch xa nhất bao nhiêu ngày kể từ bây giờ. */
    @Column(name = "limit_schedule_horizon_days")
    Integer scheduleHorizonDays;

    /** Gợi ý khung giờ vàng (AI) + slot gợi ý. */
    @Column(name = "limit_golden_hours")
    Boolean goldenHours;

    /** Trang Phân tích chỉ xem được bao nhiêu ngày gần nhất. */
    @Column(name = "limit_analytics_history_days")
    Integer analyticsHistoryDays;

    /** Khối phân tích nâng cao: heatmap, insights, theo loại nội dung. */
    @Column(name = "limit_analytics_advanced")
    Boolean analyticsAdvanced;

    /** Xuất dữ liệu phân tích (CSV). */
    @Column(name = "limit_analytics_export")
    Boolean analyticsExport;

    /** Lượt AI tối ưu chiến lược mỗi kỳ. */
    @Column(name = "limit_strategy_optimization_per_period")
    Integer strategyOptimizationPerPeriod;
}
