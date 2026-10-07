-- Analytics dữ liệu thật — Giai đoạn 3 (docs/analytics-real-data-plan.md mục D.7): webhook Page "feed".
-- CHỈ THÊM (bảng mới + cột nullable), không sửa/xoá dữ liệu cũ.

-- Mỗi thay đổi (entry[].changes[]) của webhook Meta một dòng: nhận → lưu → trả 200 ngay, xử lý bất đồng bộ.
-- dedupe_key = SHA-256(page id | entry.time | nội dung change) → Meta gửi lại cùng payload thì không xử lý lần hai.
CREATE TABLE meta_webhook_events (
    id uuid PRIMARY KEY,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6),
    deleted_at timestamp(6),
    dedupe_key varchar(64) NOT NULL,
    page_id varchar(100),
    field varchar(50),
    item varchar(30),
    verb varchar(20),
    platform_post_id varchar(255),
    payload jsonb,
    event_time timestamptz,
    status varchar(20) NOT NULL CHECK (status IN ('PENDING','PROCESSED','IGNORED','FAILED')),
    attempts integer NOT NULL DEFAULT 0,
    last_error varchar(500),
    processed_at timestamptz
);
CREATE UNIQUE INDEX uk_meta_webhook_events_dedupe ON meta_webhook_events (dedupe_key);
CREATE INDEX idx_meta_webhook_events_pending ON meta_webhook_events (created_at) WHERE status = 'PENDING';

-- Trang đã đăng ký nhận webhook (POST /{page-id}/subscribed_apps) chưa; lỗi gần nhất (thường là thiếu pages_manage_metadata).
ALTER TABLE account_sync_state ADD COLUMN webhook_subscribed_at timestamptz;
ALTER TABLE account_sync_state ADD COLUMN webhook_error_code varchar(50);
