-- Rollback V17__realtime_notifications (chạy tay, SAU KHI đã chuyển binary về bản trước V17).
-- Mất dữ liệu: tham số/ref_type của thông báo (title/message tiếng Việt vẫn còn), cài đặt kênh thông báo của người dùng,
-- thông báo thuộc các loại mới (bị XOÁ để CHECK cũ áp lại được). Event usage CANCELLED đổi thành ERROR (giữ số token đã ghi).
BEGIN;

DELETE FROM notifications WHERE type NOT IN ('POST_PUBLISHED','POST_FAILED','REVIEW_NEEDED','RECONNECT_NEEDED','NEW_INSIGHT',
                                             'SCHEDULE_OVERDUE','PAYMENT_SUCCEEDED','PLAN_EXPIRED','PAYMENT_WEBHOOK_ALERT');
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('POST_PUBLISHED','POST_FAILED','REVIEW_NEEDED','RECONNECT_NEEDED','NEW_INSIGHT','SCHEDULE_OVERDUE',
                    'PAYMENT_SUCCEEDED','PLAN_EXPIRED','PAYMENT_WEBHOOK_ALERT'));
DROP INDEX IF EXISTS ix_ntf_user_created;
DROP INDEX IF EXISTS ix_ntf_user_unread;
ALTER TABLE notifications DROP COLUMN IF EXISTS params, DROP COLUMN IF EXISTS ref_type;

ALTER TABLE user_notification_preferences DROP COLUMN IF EXISTS channels;

UPDATE ai_usage SET status = 'ERROR' WHERE status = 'CANCELLED';
ALTER TABLE ai_usage DROP CONSTRAINT IF EXISTS ai_usage_status_check;
ALTER TABLE ai_usage ADD CONSTRAINT ai_usage_status_check CHECK (status IN ('SUCCESS','ERROR','TIMEOUT'));

DELETE FROM flyway_schema_history WHERE version = '17';

COMMIT;
