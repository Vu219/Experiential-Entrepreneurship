-- Rollback V15__plan_ai_assist_limits (chạy tay, SAU KHI đã chuyển binary về bản trước V15).
-- Mất dữ liệu: giới hạn AI kiểm tra chính sách / AI sửa bài admin đã đặt cho từng gói. Binary cũ đọc lại env
-- AIMA_POLICY_CHECK_AI_LIMIT_FREE/PLUS/PRO — đặt lại 3 biến này (0/30/200) trước khi khởi động bản cũ.
BEGIN;

ALTER TABLE plans DROP COLUMN IF EXISTS ai_fix_max_per_version;
ALTER TABLE plans DROP COLUMN IF EXISTS policy_check_ai_monthly_limit;
DELETE FROM flyway_schema_history WHERE version = '15';

COMMIT;
