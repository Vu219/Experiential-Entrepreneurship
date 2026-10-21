-- Rollback V21 (chạy tay, sau khi đã deploy lại binary trước V21). Mất: liên kết dòng so sánh ↔ giới hạn (ô nhập tay
-- cũ vẫn còn nên bảng so sánh hiển thị lại giá trị tay).
ALTER TABLE plan_features DROP COLUMN IF EXISTS limit_key;
DELETE FROM flyway_schema_history WHERE version = '21';
