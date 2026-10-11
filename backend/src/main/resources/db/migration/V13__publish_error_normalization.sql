-- Chuẩn hoá lỗi đăng bài + vòng đời bài lỗi (docs/failed-posts-error-handling-plan.md §3.2).
--
-- CHỈ THÊM (cột nullable, bảng mới, CHECK mở rộng): binary cũ vẫn chạy trên schema này (Hibernate validate chỉ
-- kiểm cột đã map) → rollback ứng dụng không bắt buộc rollback DB. Rollback DB tay:
-- docs/sql/rollback/V13__publish_error_normalization_down.sql.
--
-- Dữ liệu lỗi cũ KHÔNG bị sửa: job trước V13 để error_code NULL và được chuẩn hoá LÚC ĐỌC
-- (PublishErrorRules.classifyLegacy) — không có backfill nào ở đây.

-- 1) posting_jobs: mã chuẩn AIMA + mã gốc nền tảng + chi tiết đã redact (admin) + cách đã xử lý lần lỗi.
ALTER TABLE posting_jobs
    ADD COLUMN error_code varchar(40),
    ADD COLUMN platform_error_code varchar(50),
    ADD COLUMN platform_error_subcode varchar(50),
    ADD COLUMN error_detail text,
    ADD COLUMN resolution varchar(20),
    ADD COLUMN resolved_at timestamptz,
    ADD COLUMN resolved_by uuid;

ALTER TABLE posting_jobs ADD CONSTRAINT posting_jobs_error_code_check
    CHECK (error_code IN ('POLICY_VIOLATION','POLICY_TEMPORARY_BLOCK','AUTH_TOKEN_EXPIRED','AUTH_PASSWORD_CHANGED',
                          'AUTH_APP_REMOVED','AUTH_PERMISSION_MISSING','AUTH_PAGE_ROLE_MISSING','ACCOUNT_CHECKPOINT',
                          'ACCOUNT_RESTRICTED','ACCOUNT_DISCONNECTED','ACCOUNT_TYPE_UNSUPPORTED','RATE_LIMITED',
                          'QUOTA_EXCEEDED','CONTENT_TOO_LONG','CONTENT_DUPLICATE','CONTENT_INVALID','MEDIA_REQUIRED',
                          'MEDIA_INVALID','PLATFORM_TEMPORARY','PLATFORM_OUTAGE','NETWORK_TIMEOUT',
                          'PUBLISH_INTERRUPTED','PLATFORM_UNSUPPORTED','INTERNAL_ERROR','UNKNOWN'));

ALTER TABLE posting_jobs ADD CONSTRAINT posting_jobs_resolution_check
    CHECK (resolution IN ('DISMISSED','RETRIED','CANCELLED'));

-- Thống kê admin (top mã lỗi, hàng đợi chưa phân loại, phát hiện sự cố nền tảng) quét job FAILED theo mã + thời gian.
CREATE INDEX idx_posting_jobs_failed_error_code ON posting_jobs (error_code, end_time DESC) WHERE status = 'FAILED';

-- 2) Ánh xạ của admin: chữ ký lỗi nền tảng → mã AIMA có sẵn.
CREATE TABLE publish_error_mappings (
    id uuid NOT NULL,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6),
    deleted_at timestamp(6),
    platform varchar(20) NOT NULL CHECK (platform IN ('FACEBOOK','INSTAGRAM','THREADS')),
    platform_code varchar(50) NOT NULL,
    platform_subcode varchar(50),
    message_pattern varchar(200),
    error_code varchar(40) NOT NULL
        CHECK (error_code IN ('POLICY_VIOLATION','POLICY_TEMPORARY_BLOCK','AUTH_TOKEN_EXPIRED','AUTH_PASSWORD_CHANGED',
                              'AUTH_APP_REMOVED','AUTH_PERMISSION_MISSING','AUTH_PAGE_ROLE_MISSING','ACCOUNT_CHECKPOINT',
                              'ACCOUNT_RESTRICTED','ACCOUNT_DISCONNECTED','ACCOUNT_TYPE_UNSUPPORTED','RATE_LIMITED',
                              'QUOTA_EXCEEDED','CONTENT_TOO_LONG','CONTENT_DUPLICATE','CONTENT_INVALID','MEDIA_REQUIRED',
                              'MEDIA_INVALID','PLATFORM_TEMPORARY','PLATFORM_OUTAGE','NETWORK_TIMEOUT',
                              'PUBLISH_INTERRUPTED','PLATFORM_UNSUPPORTED','INTERNAL_ERROR','UNKNOWN')),
    note varchar(500),
    updated_by_email varchar(255),
    PRIMARY KEY (id)
);

-- Một chữ ký chỉ có MỘT ánh xạ còn hiệu lực (subcode/mẫu null coi như "mọi").
CREATE UNIQUE INDEX uk_publish_error_mappings_signature
    ON publish_error_mappings (platform, platform_code, coalesce(platform_subcode, ''), coalesce(lower(message_pattern), ''))
    WHERE deleted_at IS NULL;

-- 3) activity_logs.action: thêm POST_RETRIED, POST_FAILURE_DISMISSED, PUBLISH_ERROR_MAPPING_UPDATED (tập cha của cũ).
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
        WHERE con.contype = 'c' AND att.attname = 'action' AND con.conrelid = 'activity_logs'::regclass
    LOOP
        EXECUTE format('ALTER TABLE activity_logs DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;
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
