-- Rollback V20 (chạy tay, sau khi đã deploy lại binary trước V20 — rollback V21 trước nếu đã chạy).
-- Mất: trạng thái mở/khoá nền tảng (binary cũ đọc lại env AIMA_CONNECTION_ENABLED_PLATFORMS), nền tảng theo gói,
-- mốc tính lượt counted_at / chu kỳ period_anchor_at (binary cũ đếm theo created_at + tháng lịch).
-- Lịch đang ON_HOLD vì lý do mới (PLATFORM_DISABLED / PLAN_*) mất lý do và GIỮ ON_HOLD không lý do — user kích hoạt
-- lại như lịch giữ chưa phân loại. Thông báo SCHEDULE_HELD bị xoá cứng (binary cũ không đọc được loại này).
DELETE FROM post_schedule_holds WHERE reason IN ('PLATFORM_DISABLED','PLAN_PLATFORM_EXCLUDED','PLAN_SCHEDULING_DISABLED');
DELETE FROM notifications WHERE type = 'SCHEDULE_HELD';
DELETE FROM activity_logs WHERE action = 'PLATFORM_AVAILABILITY_UPDATED';

ALTER TABLE post_schedule_holds DROP CONSTRAINT IF EXISTS post_schedule_holds_reason_check;
ALTER TABLE post_schedule_holds ADD CONSTRAINT post_schedule_holds_reason_check
    CHECK (reason IN ('ACCOUNT_ISSUE','PENDING_REVIEW','ACCOUNT_REMOVED','USER_PENDING_DELETE','UNSUPPORTED_MEDIA'));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('POST_PUBLISHED','POST_FAILED','POST_REMOVED_BY_PLATFORM','REVIEW_NEEDED','RECONNECT_NEEDED',
                    'TOKEN_EXPIRING','NEW_INSIGHT','SCHEDULE_OVERDUE','SCHEDULE_UPCOMING','CONTENT_GENERATION_FAILED',
                    'TREND_RESEARCH_DONE','TREND_RESEARCH_FAILED','PAYMENT_SUCCEEDED','PLAN_EXPIRING','PLAN_EXPIRED',
                    'AI_QUOTA_WARNING','AI_QUOTA_EXHAUSTED','PAYMENT_WEBHOOK_ALERT','ADMIN_USAGE_ALERT','ADMIN_AI_DEGRADED',
                    'ADMIN_API_VERSION'));

ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_action_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_action_check
    CHECK (action IN ('LOGIN','LOGIN_FAILED','LOGOUT','PASSWORD_CHANGED','PASSWORD_RESET','ACCOUNT_REGISTERED',
                      'PROFILE_UPDATED','ACCOUNT_DELETE_REQUESTED','ACCOUNT_RESTORED','SOCIAL_CONNECTED',
                      'SOCIAL_DISCONNECTED','CONTENT_CREATED','CONTENT_UPDATED','CONTENT_DELETED',
                      'CONTENT_STATUS_CHANGED','SCHEDULE_CREATED','SCHEDULE_UPDATED','SCHEDULE_CANCELLED',
                      'POST_PUBLISHED','POST_FAILED','POST_RETRIED','POST_FAILURE_DISMISSED','PLAN_CHANGED',
                      'PAYMENT_SUCCEEDED','PAYMENT_FAILED','PAYMENT_WEBHOOK_REJECTED','PAYMENT_CANCELLED',
                      'PAYMENT_MARKED_PAID','SUBSCRIPTION_ADJUSTED','USER_CREATED','USER_UPDATED',
                      'USER_STATUS_CHANGED','USER_DELETED','USER_PASSWORD_RESET','PLAN_CONFIG_UPDATED',
                      'LANDING_CONTENT_UPDATED','LANDING_CONTENT_PUBLISHED','AI_CONFIG_UPDATED','API_VERSION_UPDATED',
                      'TOKENS_GRANTED','USAGE_RESET','BILLING_RATE_CREATED','ALERT_ACKED','ALERT_CONFIG_UPDATED',
                      'USAGE_META_VIEWED','USER_SESSIONS_VIEWED','DEV_CREDIT_GRANTED','DATA_EXPORTED',
                      'PUBLISH_ERROR_MAPPING_UPDATED'));

DROP INDEX IF EXISTS ix_post_schedules_counted_at;
ALTER TABLE post_schedules DROP COLUMN IF EXISTS counted_at;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS period_anchor_at;
ALTER TABLE plans DROP COLUMN IF EXISTS limit_allowed_platforms;
DROP TABLE IF EXISTS platform_availability;
DELETE FROM flyway_schema_history WHERE version = '20';
