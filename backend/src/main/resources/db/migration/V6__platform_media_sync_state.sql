-- Analytics dữ liệu thật — Giai đoạn 0 (docs/analytics-real-data-plan.md, mục D.1).
-- platform_media: một dòng cho một bài trên nền tảng (AIMA hoặc, từ giai đoạn 2, bài đăng ngoài AIMA).
-- Giai đoạn 0 chỉ dùng phần trạng thái đồng bộ để job thu số liệu NGỪNG gọi lại vô hạn bài đã xoá /
-- thiếu quyền / bị rate limit. Không đụng tới dữ liệu cũ: chỉ tạo bảng mới + backfill từ posts.
CREATE TABLE platform_media (
    id uuid PRIMARY KEY,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6),
    deleted_at timestamp(6),
    platform_account_id uuid NOT NULL REFERENCES platform_accounts(id),
    platform_name varchar(20) NOT NULL CHECK (platform_name IN ('FACEBOOK','INSTAGRAM','THREADS')),
    platform_media_id varchar(255) NOT NULL,
    post_id uuid REFERENCES posts(id),
    origin varchar(10) NOT NULL CHECK (origin IN ('AIMA','EXTERNAL')),
    published_at timestamptz,
    platform_status varchar(20) NOT NULL CHECK (platform_status IN ('ACTIVE','UNAVAILABLE','DELETED')),
    sync_status varchar(20) NOT NULL CHECK (sync_status IN ('ACTIVE','STOPPED')),
    next_sync_at timestamptz,
    last_synced_at timestamptz,
    consecutive_failures integer NOT NULL DEFAULT 0,
    last_error_code varchar(50),
    last_error_at timestamptz
);

CREATE UNIQUE INDEX uk_platform_media_account_media ON platform_media (platform_account_id, platform_media_id)
    WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uk_platform_media_post ON platform_media (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_platform_media_next_sync ON platform_media (next_sync_at)
    WHERE sync_status = 'ACTIVE' AND deleted_at IS NULL;

-- Backfill: mọi bài AIMA đã đăng thành công. Bài trùng (cùng tài khoản + id nền tảng) chỉ giữ một dòng.
INSERT INTO platform_media (id, created_at, platform_account_id, platform_name, platform_media_id, post_id,
                            origin, published_at, platform_status, sync_status, consecutive_failures)
SELECT gen_random_uuid(), now(), s.platform_account_id, p.platform_name, p.platform_post_id, p.id,
       'AIMA', p.published_at, 'ACTIVE', 'ACTIVE', 0
FROM posts p
JOIN post_schedules s ON s.id = p.schedule_id
WHERE p.status = 'POSTED' AND p.platform_post_id IS NOT NULL AND p.deleted_at IS NULL
ON CONFLICT DO NOTHING;
