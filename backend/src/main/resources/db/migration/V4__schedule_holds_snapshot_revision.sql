-- Phase 2: lý do tạm giữ nhiều-một theo lịch, snapshot nội dung Post lúc dispatch, revision bản nền tảng,
-- khóa chống gửi lặp cho thông báo.

CREATE TABLE post_schedule_holds (
    id uuid PRIMARY KEY,
    schedule_id uuid NOT NULL REFERENCES post_schedules(id),
    reason varchar(30) NOT NULL CHECK (reason IN ('ACCOUNT_ISSUE','PENDING_REVIEW','ACCOUNT_REMOVED',
                                                  'USER_PENDING_DELETE','UNSUPPORTED_MEDIA')),
    created_at timestamptz NOT NULL,
    CONSTRAINT uk_post_schedule_holds_schedule_reason UNIQUE (schedule_id, reason)
);

-- Lịch ON_HOLD cũ không lưu lý do. Chỉ suy ra khi còn bằng chứng rõ trên dữ liệu; phần còn lại để
-- không lý do (báo cáo "hold chưa phân loại" ở job sửa dữ liệu) — user kích hoạt lại như trước.
INSERT INTO post_schedule_holds(id, schedule_id, reason, created_at)
SELECT gen_random_uuid(), s.id, 'ACCOUNT_REMOVED', now()
FROM post_schedules s JOIN platform_accounts pa ON pa.id = s.platform_account_id
WHERE s.status = 'ON_HOLD' AND s.deleted_at IS NULL AND pa.deleted_at IS NOT NULL;

INSERT INTO post_schedule_holds(id, schedule_id, reason, created_at)
SELECT gen_random_uuid(), s.id, 'ACCOUNT_ISSUE', now()
FROM post_schedules s JOIN platform_accounts pa ON pa.id = s.platform_account_id
WHERE s.status = 'ON_HOLD' AND s.deleted_at IS NULL AND pa.deleted_at IS NULL AND pa.connection_status <> 'ACTIVE';

INSERT INTO post_schedule_holds(id, schedule_id, reason, created_at)
SELECT gen_random_uuid(), s.id, 'USER_PENDING_DELETE', now()
FROM post_schedules s
JOIN platform_accounts pa ON pa.id = s.platform_account_id
JOIN users u ON u.id = pa.user_id
WHERE s.status = 'ON_HOLD' AND s.deleted_at IS NULL AND u.status = 'PENDING_DELETE';

-- Post cũ không có nội dung lúc đăng → UNKNOWN_LEGACY, KHÔNG điền từ version hiện tại.
ALTER TABLE posts
    ADD COLUMN snapshot_state varchar(20) NOT NULL DEFAULT 'UNKNOWN_LEGACY'
        CHECK (snapshot_state IN ('CAPTURED','UNKNOWN_LEGACY')),
    ADD COLUMN snapshot_version_id uuid,
    ADD COLUMN snapshot_revision integer,
    ADD COLUMN snapshot_caption text,
    ADD COLUMN snapshot_hashtag text,
    ADD COLUMN snapshot_cta varchar(255),
    ADD COLUMN snapshot_media_format varchar(20),
    ADD COLUMN snapshot_captured_at timestamptz;

ALTER TABLE content_versions ADD COLUMN revision integer NOT NULL DEFAULT 0;

ALTER TABLE notifications ADD COLUMN dedupe_key varchar(200);
CREATE UNIQUE INDEX uk_notifications_dedupe_key ON notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

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
    CHECK (type IN ('POST_PUBLISHED','POST_FAILED','REVIEW_NEEDED','RECONNECT_NEEDED','NEW_INSIGHT','SCHEDULE_OVERDUE',
                    'PAYMENT_SUCCEEDED','PLAN_EXPIRED','PAYMENT_WEBHOOK_ALERT'));
