-- Rollback V23__user_feedback.sql (mất toàn bộ góp ý đã thu — backup trước khi chạy).
DROP TABLE IF EXISTS user_feedback;
DELETE FROM flyway_schema_history WHERE version = '23';
