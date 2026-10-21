-- Rollback V22 (chạy tay, sau khi đã deploy lại binary trước V22). Mất: kết quả "Kiểm tra model" gần nhất (dữ liệu
-- chẩn đoán — lần kiểm tra sau sẽ ghi lại).
ALTER TABLE ai_models DROP COLUMN IF EXISTS last_probed_at;
ALTER TABLE ai_models DROP COLUMN IF EXISTS last_probe_status;
DELETE FROM flyway_schema_history WHERE version = '22';
