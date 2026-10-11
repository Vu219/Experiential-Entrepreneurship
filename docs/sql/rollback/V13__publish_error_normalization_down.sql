-- ROLLBACK TAY cho Flyway V13__publish_error_normalization.sql (Flyway Community không có undo).
--
-- Chỉ chạy khi thật sự cần gỡ V13 (thường KHÔNG cần: V13 chỉ thêm cột/bảng nên binary cũ vẫn chạy được).
-- Trình tự: backup → dừng mọi instance backend (APP_SCHEDULING_ENABLED=false trước) → chạy file này trong
-- MỘT transaction → deploy binary trước V13. Mất dữ liệu: mã lỗi chuẩn hoá, chi tiết lỗi đã redact, trạng thái
-- "đã bỏ qua"/"đã thử lại" của bài lỗi và các ánh xạ admin đã tạo. Dòng activity_logs dùng action mới bị XOÁ
-- (CHECK cũ không chấp nhận chúng) — export trước nếu cần giữ vết.

BEGIN;

DELETE FROM activity_logs WHERE action IN ('POST_RETRIED', 'POST_FAILURE_DISMISSED', 'PUBLISH_ERROR_MAPPING_UPDATED');
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_action_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_action_check
    CHECK (action IN ('LOGIN','LOGIN_FAILED','LOGOUT','PASSWORD_CHANGED','PASSWORD_RESET','ACCOUNT_REGISTERED',
                      'PROFILE_UPDATED','ACCOUNT_DELETE_REQUESTED','ACCOUNT_RESTORED','SOCIAL_CONNECTED',
                      'SOCIAL_DISCONNECTED','CONTENT_CREATED','CONTENT_UPDATED','CONTENT_DELETED',
                      'CONTENT_STATUS_CHANGED','SCHEDULE_CREATED','SCHEDULE_UPDATED','SCHEDULE_CANCELLED',
                      'POST_PUBLISHED','POST_FAILED','PLAN_CHANGED','PAYMENT_SUCCEEDED','PAYMENT_FAILED',
                      'PAYMENT_WEBHOOK_REJECTED','PAYMENT_CANCELLED','PAYMENT_MARKED_PAID','SUBSCRIPTION_ADJUSTED',
                      'USER_CREATED','USER_UPDATED','USER_STATUS_CHANGED','USER_DELETED','USER_PASSWORD_RESET',
                      'PLAN_CONFIG_UPDATED','LANDING_CONTENT_UPDATED','LANDING_CONTENT_PUBLISHED','AI_CONFIG_UPDATED',
                      'API_VERSION_UPDATED','TOKENS_GRANTED','USAGE_RESET','BILLING_RATE_CREATED','ALERT_ACKED',
                      'ALERT_CONFIG_UPDATED','USAGE_META_VIEWED','USER_SESSIONS_VIEWED','DEV_CREDIT_GRANTED',
                      'DATA_EXPORTED'));

DROP TABLE IF EXISTS publish_error_mappings;

DROP INDEX IF EXISTS idx_posting_jobs_failed_error_code;
ALTER TABLE posting_jobs
    DROP CONSTRAINT IF EXISTS posting_jobs_error_code_check,
    DROP CONSTRAINT IF EXISTS posting_jobs_resolution_check,
    DROP COLUMN IF EXISTS error_code,
    DROP COLUMN IF EXISTS platform_error_code,
    DROP COLUMN IF EXISTS platform_error_subcode,
    DROP COLUMN IF EXISTS error_detail,
    DROP COLUMN IF EXISTS resolution,
    DROP COLUMN IF EXISTS resolved_at,
    DROP COLUMN IF EXISTS resolved_by;

DELETE FROM flyway_schema_history WHERE version = '13';

COMMIT;
