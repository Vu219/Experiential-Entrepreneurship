-- Rollback V18 (chạy tay, sau khi đã deploy lại binary trước V18). Mất: giới hạn tính năng admin đã đặt cho từng gói.
ALTER TABLE plans
    DROP COLUMN IF EXISTS limit_brand_profiles,
    DROP COLUMN IF EXISTS limit_strategies_per_brand,
    DROP COLUMN IF EXISTS limit_connected_channels,
    DROP COLUMN IF EXISTS limit_trend_research_per_period,
    DROP COLUMN IF EXISTS limit_auto_trend_research,
    DROP COLUMN IF EXISTS limit_ideas_per_research,
    DROP COLUMN IF EXISTS limit_scheduling,
    DROP COLUMN IF EXISTS limit_scheduled_posts_per_period,
    DROP COLUMN IF EXISTS limit_active_schedules,
    DROP COLUMN IF EXISTS limit_schedule_horizon_days,
    DROP COLUMN IF EXISTS limit_golden_hours,
    DROP COLUMN IF EXISTS limit_analytics_history_days,
    DROP COLUMN IF EXISTS limit_analytics_advanced,
    DROP COLUMN IF EXISTS limit_analytics_export,
    DROP COLUMN IF EXISTS limit_strategy_optimization_per_period;
DELETE FROM flyway_schema_history WHERE version = '18';
