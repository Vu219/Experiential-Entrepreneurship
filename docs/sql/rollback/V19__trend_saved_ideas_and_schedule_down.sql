-- Rollback V19 (chạy tay, sau khi đã deploy lại binary trước V19). Mất: ý tưởng đã lưu + lịch nghiên cứu tự động.
DROP TABLE IF EXISTS trend_research_schedules;
DROP INDEX IF EXISTS idx_content_ideas_saved;
ALTER TABLE content_ideas DROP COLUMN IF EXISTS saved_at;
DELETE FROM flyway_schema_history WHERE version = '19';
