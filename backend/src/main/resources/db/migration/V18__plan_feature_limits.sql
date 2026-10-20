-- Giới hạn tính năng theo TỪNG GÓI (docs/plan-limits-proposal.md). Cùng quy ước V15: NULL = mặc định hệ thống
-- (aima.plan-limits.defaults.*, mặc định không giới hạn / bật), -1 = không giới hạn, 0 = tắt, > 0 = hạn mức.
-- CHỈ THÊM cột — binary cũ vẫn chạy trên schema mới. Rollback: docs/sql/rollback/V18__plan_feature_limits_down.sql

ALTER TABLE plans
    ADD COLUMN limit_brand_profiles integer
        CONSTRAINT plans_limit_brand_profiles_check CHECK (limit_brand_profiles >= -1),
    ADD COLUMN limit_strategies_per_brand integer
        CONSTRAINT plans_limit_strategies_per_brand_check CHECK (limit_strategies_per_brand >= -1),
    ADD COLUMN limit_connected_channels integer
        CONSTRAINT plans_limit_connected_channels_check CHECK (limit_connected_channels >= -1),
    ADD COLUMN limit_trend_research_per_period integer
        CONSTRAINT plans_limit_trend_research_per_period_check CHECK (limit_trend_research_per_period >= -1),
    ADD COLUMN limit_auto_trend_research boolean,
    ADD COLUMN limit_ideas_per_research integer
        CONSTRAINT plans_limit_ideas_per_research_check CHECK (limit_ideas_per_research >= -1),
    ADD COLUMN limit_scheduling boolean,
    ADD COLUMN limit_scheduled_posts_per_period integer
        CONSTRAINT plans_limit_scheduled_posts_per_period_check CHECK (limit_scheduled_posts_per_period >= -1),
    ADD COLUMN limit_active_schedules integer
        CONSTRAINT plans_limit_active_schedules_check CHECK (limit_active_schedules >= -1),
    ADD COLUMN limit_schedule_horizon_days integer
        CONSTRAINT plans_limit_schedule_horizon_days_check CHECK (limit_schedule_horizon_days >= -1),
    ADD COLUMN limit_golden_hours boolean,
    ADD COLUMN limit_analytics_history_days integer
        CONSTRAINT plans_limit_analytics_history_days_check CHECK (limit_analytics_history_days >= -1),
    ADD COLUMN limit_analytics_advanced boolean,
    ADD COLUMN limit_analytics_export boolean,
    ADD COLUMN limit_strategy_optimization_per_period integer
        CONSTRAINT plans_limit_strategy_optimization_per_period_check CHECK (limit_strategy_optimization_per_period >= -1);

-- Backfill 3 gói lõi theo đề xuất (DB mới: PlanDataInitializer seed cùng giá trị vì V18 chạy trước khi có gói).
-- Gói admin tự tạo để NULL = mặc định hệ thống (không đổi hành vi).
UPDATE plans SET
    limit_brand_profiles = 1, limit_strategies_per_brand = 1, limit_connected_channels = 1,
    limit_trend_research_per_period = 3, limit_auto_trend_research = false, limit_ideas_per_research = 5,
    limit_scheduling = true, limit_scheduled_posts_per_period = 10, limit_active_schedules = 5,
    limit_schedule_horizon_days = 7, limit_golden_hours = false, limit_analytics_history_days = 7,
    limit_analytics_advanced = false, limit_analytics_export = false, limit_strategy_optimization_per_period = 0
WHERE code = 'FREE' AND limit_brand_profiles IS NULL;

UPDATE plans SET
    limit_brand_profiles = 3, limit_strategies_per_brand = 5, limit_connected_channels = 3,
    limit_trend_research_per_period = 30, limit_auto_trend_research = true, limit_ideas_per_research = 10,
    limit_scheduling = true, limit_scheduled_posts_per_period = 100, limit_active_schedules = 50,
    limit_schedule_horizon_days = 30, limit_golden_hours = true, limit_analytics_history_days = 90,
    limit_analytics_advanced = true, limit_analytics_export = false, limit_strategy_optimization_per_period = 5
WHERE code = 'PLUS' AND limit_brand_profiles IS NULL;

UPDATE plans SET
    limit_brand_profiles = -1, limit_strategies_per_brand = -1, limit_connected_channels = 10,
    limit_trend_research_per_period = -1, limit_auto_trend_research = true, limit_ideas_per_research = 20,
    limit_scheduling = true, limit_scheduled_posts_per_period = -1, limit_active_schedules = -1,
    limit_schedule_horizon_days = 90, limit_golden_hours = true, limit_analytics_history_days = 365,
    limit_analytics_advanced = true, limit_analytics_export = true, limit_strategy_optimization_per_period = -1
WHERE code = 'PRO' AND limit_brand_profiles IS NULL;
