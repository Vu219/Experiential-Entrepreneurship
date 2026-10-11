-- Đợt 2 nâng cấp "Bài lỗi" (docs/failed-posts-error-handling-plan.md §8): AI sửa bài vi phạm, AI kiểm tra
-- chính sách trước khi đăng, email lỗi đăng bài theo đồng ý của người dùng. CHỈ THÊM bảng/cột/giá trị CHECK —
-- binary cũ vẫn chạy trên schema mới. Rollback: docs/sql/rollback/V14__ai_policy_assist_and_email_consent_down.sql

-- 1) Đồng ý nhận email lỗi đăng bài (opt-in). Mặc định KHÔNG nhận; hỏi một lần ở trang Bài lỗi.
CREATE TABLE user_notification_preferences (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_publish_errors boolean NOT NULL DEFAULT false,
    email_prompt_status varchar(20) NOT NULL DEFAULT 'NOT_ASKED'
        CONSTRAINT user_notification_preferences_email_prompt_status_check
        CHECK (email_prompt_status IN ('NOT_ASKED','ACCEPTED','DECLINED')),
    consent_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO user_notification_preferences(user_id) SELECT id FROM users ON CONFLICT DO NOTHING;

-- 2) Bật/tắt kiểm tra chính sách trước khi đăng (tầng luật miễn phí + tầng AI theo gói).
ALTER TABLE user_publishing_settings ADD COLUMN policy_check_enabled boolean NOT NULL DEFAULT true;

-- 3) Tác vụ AI hỗ trợ chính sách (async, NFR-04): sửa bài (POLICY_FIX) và kiểm tra (POLICY_CHECK).
CREATE TABLE ai_assist_jobs (
    id uuid PRIMARY KEY,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6),
    deleted_at timestamp(6),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_version_id uuid NOT NULL REFERENCES content_versions(id) ON DELETE CASCADE,
    post_id uuid REFERENCES posts(id) ON DELETE SET NULL,
    kind varchar(20) NOT NULL CONSTRAINT ai_assist_jobs_kind_check CHECK (kind IN ('POLICY_FIX','POLICY_CHECK')),
    status varchar(20) NOT NULL
        CONSTRAINT ai_assist_jobs_status_check CHECK (status IN ('PENDING','RUNNING','SUCCESS','FAILED')),
    platform varchar(20) NOT NULL
        CONSTRAINT ai_assist_jobs_platform_check CHECK (platform IN ('FACEBOOK','INSTAGRAM','THREADS')),
    error_code varchar(40) CONSTRAINT ai_assist_jobs_error_code_check CHECK (error_code IN (
        'POLICY_VIOLATION','POLICY_TEMPORARY_BLOCK','AUTH_TOKEN_EXPIRED','AUTH_PASSWORD_CHANGED','AUTH_APP_REMOVED',
        'AUTH_PERMISSION_MISSING','AUTH_PAGE_ROLE_MISSING','ACCOUNT_CHECKPOINT','ACCOUNT_RESTRICTED',
        'ACCOUNT_DISCONNECTED','ACCOUNT_TYPE_UNSUPPORTED','RATE_LIMITED','QUOTA_EXCEEDED','CONTENT_TOO_LONG',
        'CONTENT_DUPLICATE','CONTENT_INVALID','MEDIA_REQUIRED','MEDIA_INVALID','PLATFORM_TEMPORARY','PLATFORM_OUTAGE',
        'NETWORK_TIMEOUT','PUBLISH_INTERRUPTED','PLATFORM_UNSUPPORTED','INTERNAL_ERROR','UNKNOWN')),
    content_hash varchar(64) NOT NULL,
    input_caption text,
    result text,
    error_message text,
    applied_at timestamptz,
    client_ip varchar(45),
    user_agent varchar(300)
);
CREATE INDEX idx_ai_assist_jobs_user_kind_created ON ai_assist_jobs (user_id, kind, created_at);
CREATE INDEX idx_ai_assist_jobs_kind_hash ON ai_assist_jobs (kind, content_hash);
CREATE INDEX idx_ai_assist_jobs_version_kind ON ai_assist_jobs (content_version_id, kind);

-- 4) Hai task AI mới (định tuyến model + event usage + tổng hợp usage + đơn giá).
DO $$
DECLARE
    t text;
    c record;
BEGIN
    FOREACH t IN ARRAY ARRAY['ai_task_routing','ai_usage','billing_rates','usage_daily','usage_hourly']
    LOOP
        FOR c IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
            WHERE con.contype = 'c' AND att.attname = 'task_code' AND con.conrelid = t::regclass
        LOOP
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, c.conname);
        END LOOP;
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (task_code IN (''CONTENT_GENERATION'','
            || '''PLATFORM_FORMATTING'',''TREND_RESEARCH'',''GOLDEN_HOURS'',''STRATEGY_OPTIMIZATION'','
            || '''CONTENT_REGENERATION'',''POLICY_FIX'',''POLICY_CHECK''))', t, t || '_task_code_check');
    END LOOP;
END $$;
