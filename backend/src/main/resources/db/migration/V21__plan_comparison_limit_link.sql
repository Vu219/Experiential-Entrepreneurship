-- Bảng so sánh gói: một dòng có thể LIÊN KẾT một giới hạn thật (PlanLimitKey) — giá trị từng cột tự lấy từ giới hạn
-- hiệu lực của gói (+ trạng thái khoá nền tảng), không nhập tay nên không còn lệch giới hạn thật. CHỈ THÊM cột; ô nhập
-- tay cũ được GIỮ (không xoá dữ liệu) — gỡ liên kết thì dòng hiển thị lại giá trị tay như trước.
-- Rollback: docs/sql/rollback/V21__plan_comparison_limit_link_down.sql

ALTER TABLE plan_features ADD COLUMN limit_key varchar(50)
    CONSTRAINT plan_features_limit_key_check CHECK (limit_key IN (
        'BRAND_PROFILES','STRATEGIES_PER_BRAND','CONNECTED_CHANNELS','ALLOWED_PLATFORMS','TREND_RESEARCH_PER_PERIOD',
        'AUTO_TREND_RESEARCH','IDEAS_PER_RESEARCH','SCHEDULING','SCHEDULED_POSTS_PER_PERIOD','ACTIVE_SCHEDULES',
        'SCHEDULE_HORIZON_DAYS','GOLDEN_HOURS','ANALYTICS_HISTORY_DAYS','ANALYTICS_ADVANCED','ANALYTICS_EXPORT',
        'STRATEGY_OPTIMIZATION_PER_PERIOD','POLICY_CHECK_AI_PER_PERIOD','AI_FIX_PER_VERSION'));

-- Liên kết các dòng seed tương ứng (PlanDataInitializer.LINKED_COMPARISON_ROWS) — chỉ dòng còn hiệu lực, chưa liên kết,
-- khớp đúng tên tiếng Việt. Dòng admin đã đổi tên thì giữ nguyên nhập tay (admin tự liên kết trong "Bảng so sánh").
-- "Bài viết AI mỗi tháng" KHÔNG liên kết: hệ thống chỉ giới hạn token, không giới hạn số bài.
UPDATE plan_features SET limit_key = 'BRAND_PROFILES'
    WHERE deleted_at IS NULL AND limit_key IS NULL AND name_vi = 'Hồ sơ thương hiệu';
UPDATE plan_features SET limit_key = 'ALLOWED_PLATFORMS'
    WHERE deleted_at IS NULL AND limit_key IS NULL AND name_vi = 'Nền tảng kết nối';
UPDATE plan_features SET limit_key = 'SCHEDULING'
    WHERE deleted_at IS NULL AND limit_key IS NULL AND name_vi = 'Lên lịch & tự động đăng bài';
UPDATE plan_features SET limit_key = 'GOLDEN_HOURS'
    WHERE deleted_at IS NULL AND limit_key IS NULL AND name_vi = 'Gợi ý khung giờ vàng';
UPDATE plan_features SET limit_key = 'ANALYTICS_HISTORY_DAYS'
    WHERE deleted_at IS NULL AND limit_key IS NULL AND name_vi = 'Phân tích hiệu quả sau đăng';
UPDATE plan_features SET limit_key = 'STRATEGY_OPTIMIZATION_PER_PERIOD'
    WHERE deleted_at IS NULL AND limit_key IS NULL AND name_vi = 'AI tối ưu chiến lược từ dữ liệu';
UPDATE plan_features SET limit_key = 'ANALYTICS_EXPORT'
    WHERE deleted_at IS NULL AND limit_key IS NULL AND name_vi = 'Báo cáo hiệu quả chuyên sâu';
