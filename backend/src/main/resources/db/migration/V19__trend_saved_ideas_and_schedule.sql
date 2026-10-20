-- Trang Xu hướng: "Lưu ý tưởng" và "Lịch nghiên cứu tự động" trước đây chỉ nằm ở localStorage trình duyệt (mất khi đổi
-- máy, lịch không ảnh hưởng job 2:00). Nay lưu ở backend. CHỈ THÊM — binary cũ vẫn chạy.
-- Rollback: docs/sql/rollback/V19__trend_saved_ideas_and_schedule_down.sql

-- 1) Ý tưởng đã lưu: mốc lưu, NULL = chưa lưu.
ALTER TABLE content_ideas ADD COLUMN saved_at timestamp(6);
CREATE INDEX idx_content_ideas_saved ON content_ideas (saved_at) WHERE saved_at IS NOT NULL AND deleted_at IS NULL;

-- 2) Lịch nghiên cứu tự động theo user (tối đa một lịch còn hiệu lực / user). User CHƯA có dòng = mặc định cũ
--    (02:00 hằng ngày cho hồ sơ đang hoạt động); có dòng enabled = false = tắt nghiên cứu tự động.
CREATE TABLE trend_research_schedules (
    id uuid NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    enabled boolean NOT NULL,
    brand_profile_id uuid REFERENCES brand_profiles (id) ON DELETE SET NULL,
    content_strategy_id uuid REFERENCES content_strategies (id) ON DELETE SET NULL,
    platforms varchar(100) NOT NULL,
    frequency varchar(10) NOT NULL CONSTRAINT trend_research_schedules_frequency_check CHECK (frequency IN ('DAILY', 'WEEKLY')),
    days varchar(20),
    run_time time NOT NULL,
    last_run_at timestamp(6),
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6),
    deleted_at timestamp(6)
);
CREATE UNIQUE INDEX uk_trend_research_schedules_user ON trend_research_schedules (user_id) WHERE deleted_at IS NULL;
