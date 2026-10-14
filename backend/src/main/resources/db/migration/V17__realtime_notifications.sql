-- Realtime SSE & hệ thống thông báo (docs/REALTIME_SSE_NOTIFICATIONS_PROPOSAL.md mục 2.1). CHỈ THÊM cột / index / giá trị
-- CHECK — binary cũ vẫn chạy trên schema mới. Rollback: docs/sql/rollback/V17__realtime_notifications_down.sql

-- 1) Thông báo đa ngôn ngữ: lưu khoá + tham số (FE dựng câu theo i18n), title/message tiếng Việt giữ làm dự phòng.
--    ref_type cho biết ref_id trỏ tới đối tượng nào (deep link khi bấm thông báo).
ALTER TABLE notifications
    ADD COLUMN params jsonb,
    ADD COLUMN ref_type varchar(30)
        CONSTRAINT notifications_ref_type_check CHECK (ref_type IN (
            'POST','SCHEDULE','CONTENT_ITEM','PLATFORM_ACCOUNT','STRATEGY','PAYMENT','SUBSCRIPTION','TREND_SESSION',
            'GENERATION_JOB','PLATFORM'));

-- 2) Loại thông báo mới (mục 2.4). Bỏ mọi CHECK cũ trên cột type (tên tự sinh khác nhau giữa các DB) rồi tạo lại.
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
                    'TOKEN_EXPIRING','NEW_INSIGHT','SCHEDULE_OVERDUE','SCHEDULE_UPCOMING','CONTENT_GENERATION_FAILED',
                    'TREND_RESEARCH_DONE','TREND_RESEARCH_FAILED','PAYMENT_SUCCEEDED','PLAN_EXPIRING','PLAN_EXPIRED',
                    'AI_QUOTA_WARNING','AI_QUOTA_EXHAUSTED','PAYMENT_WEBHOOK_ALERT','ADMIN_USAGE_ALERT','ADMIN_AI_DEGRADED',
                    'ADMIN_API_VERSION'));

-- 3) Index cho danh sách + đếm chưa đọc (trước đây chỉ có unique index dedupe_key).
CREATE INDEX ix_ntf_user_created ON notifications (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_ntf_user_unread ON notifications (user_id) WHERE read_at IS NULL AND deleted_at IS NULL;

-- 4) Cài đặt kênh theo nhóm: {"PUBLISHING":{"inApp":true,"toast":false}, ...}. Khoá thiếu = mặc định trong code
--    (thêm loại/nhóm mới không cần migration). Email vẫn dùng email_publish_errors + consent_at (đồng ý + link huỷ nhận).
ALTER TABLE user_notification_preferences ADD COLUMN channels jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 5) AI streaming (mục 5): huỷ giữa chừng ghi ai_usage.status = CANCELLED (input thật + output ước lượng).
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
        WHERE con.contype = 'c' AND att.attname = 'status' AND con.conrelid = 'ai_usage'::regclass
    LOOP
        EXECUTE format('ALTER TABLE ai_usage DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;
ALTER TABLE ai_usage ADD CONSTRAINT ai_usage_status_check CHECK (status IN ('SUCCESS','ERROR','TIMEOUT','CANCELLED'));
