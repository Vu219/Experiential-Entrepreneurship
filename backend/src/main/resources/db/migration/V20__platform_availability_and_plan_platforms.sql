-- Khoá/mở nền tảng toàn hệ thống do admin điều khiển + nền tảng theo gói + vá giới hạn gói (docs/PLAN.md mục giới hạn gói,
-- đợt A–C 2026-10-21). CHỈ THÊM bảng / cột / giá trị CHECK — không xoá dữ liệu.
-- Rollback: docs/sql/rollback/V20__platform_availability_and_plan_platforms_down.sql

-- 1) Trạng thái mở/khoá liên kết của từng nền tảng (một dòng / nền tảng). Dòng do PlatformDataInitializer seed lần đầu
--    theo env AIMA_CONNECTION_ENABLED_PLATFORMS (mặc định chỉ FACEBOOK mở) — env chỉ còn là giá trị seed.
--    Người sửa lưu id + email KHÔNG FK (xoá cứng tài khoản admin không vướng khoá ngoại).
CREATE TABLE platform_availability (
    id uuid PRIMARY KEY,
    platform varchar(20) NOT NULL
        CONSTRAINT platform_availability_platform_check CHECK (platform IN ('FACEBOOK','INSTAGRAM','THREADS')),
    connection_enabled boolean NOT NULL,
    reason_vi varchar(300),
    reason_en varchar(300),
    status_changed_at timestamp,
    updated_by_id uuid,
    updated_by_email varchar(255),
    created_at timestamp NOT NULL,
    updated_at timestamp,
    deleted_at timestamp,
    CONSTRAINT uk_platform_availability_platform UNIQUE (platform)
);

-- 2) Nền tảng gói cho phép (CSV tên enum Platform). Cả 3 gói lõi và gói tự tạo đang có → chỉ FACEBOOK
--    (giữ đúng hành vi hiện tại: Instagram/Threads chưa mở cho ai). Các cột giới hạn null của gói TỰ TẠO được
--    ghi cứng giá trị hiệu lực lúc khởi động (PlanDataInitializer — cần đọc aima.plan-limits.defaults.* từ env).
ALTER TABLE plans ADD COLUMN limit_allowed_platforms varchar(100);
UPDATE plans SET limit_allowed_platforms = 'FACEBOOK' WHERE limit_allowed_platforms IS NULL;

-- 3) Lý do tạm giữ mới: nền tảng khoá toàn hệ thống / không thuộc gói / gói tắt lên lịch. Bỏ mọi CHECK cũ trên cột
--    reason (V4 tạo inline, tên tự sinh) rồi tạo lại tập cha.
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
        WHERE con.contype = 'c' AND att.attname = 'reason' AND con.conrelid = 'post_schedule_holds'::regclass
    LOOP
        EXECUTE format('ALTER TABLE post_schedule_holds DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;
ALTER TABLE post_schedule_holds ADD CONSTRAINT post_schedule_holds_reason_check
    CHECK (reason IN ('ACCOUNT_ISSUE','PENDING_REVIEW','ACCOUNT_REMOVED','USER_PENDING_DELETE','UNSUPPORTED_MEDIA',
                      'PLATFORM_DISABLED','PLAN_PLATFORM_EXCLUDED','PLAN_SCHEDULING_DISABLED'));

-- 4) Thông báo SCHEDULE_HELD (lịch bị giữ vì quyền dùng nền tảng / gói).
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
        WHERE con.contype = 'c' AND att.attname = 'type' AND con.conrelid = 'notifications'::regclass
    LOOP
        EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('POST_PUBLISHED','POST_FAILED','POST_REMOVED_BY_PLATFORM','REVIEW_NEEDED','RECONNECT_NEEDED',
                    'TOKEN_EXPIRING','NEW_INSIGHT','SCHEDULE_OVERDUE','SCHEDULE_HELD','SCHEDULE_UPCOMING',
                    'CONTENT_GENERATION_FAILED','TREND_RESEARCH_DONE','TREND_RESEARCH_FAILED','PAYMENT_SUCCEEDED',
                    'PLAN_EXPIRING','PLAN_EXPIRED','AI_QUOTA_WARNING','AI_QUOTA_EXHAUSTED','PAYMENT_WEBHOOK_ALERT',
                    'ADMIN_USAGE_ALERT','ADMIN_AI_DEGRADED','ADMIN_API_VERSION'));

-- 5) Activity log: admin mở/khoá nền tảng.
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
                      'PUBLISH_ERROR_MAPPING_UPDATED','PLATFORM_AVAILABILITY_UPDATED'));

-- 6) Lượt SCHEDULED_POSTS_PER_PERIOD đếm theo counted_at: lúc tạo, và lại khi một lịch CANCELLED được tái sử dụng
--    (lịch cũ backfill = created_at — số lượt kỳ đang chạy không đổi).
ALTER TABLE post_schedules ADD COLUMN counted_at timestamp;
UPDATE post_schedules SET counted_at = created_at WHERE counted_at IS NULL;
ALTER TABLE post_schedules ALTER COLUMN counted_at SET NOT NULL;
CREATE INDEX ix_post_schedules_counted_at ON post_schedules (counted_at) WHERE deleted_at IS NULL;

-- 7) Kỳ tính lượt theo chu kỳ thanh toán: mốc neo của chu kỳ tháng. Gói trả tiền/admin cấp neo theo lúc bắt đầu gói,
--    Free neo theo ngày tạo subscription. KỲ ĐANG CHẠY KHÔNG ĐỔI (current_period_* giữ nguyên): khi hết kỳ, kỳ mới bắt đầu
--    = max(cuối kỳ cũ, mốc neo gần nhất) — không bao giờ chồng lên kỳ cũ (không tính lại lượt đã dùng).
ALTER TABLE subscriptions ADD COLUMN period_anchor_at timestamp;
UPDATE subscriptions SET period_anchor_at = COALESCE(CASE WHEN plan_source <> 'FREE' THEN plan_started_at END,
                                                     created_at, current_period_start)
WHERE period_anchor_at IS NULL;
