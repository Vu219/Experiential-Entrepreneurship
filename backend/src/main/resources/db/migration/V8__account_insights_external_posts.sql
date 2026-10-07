-- Analytics dữ liệu thật — Giai đoạn 2 (docs/analytics-real-data-plan.md mục 3.1/3.3/3.5 + D.6).
-- CHỈ THÊM (bảng mới + cột nullable), không sửa/xoá dữ liệu cũ.

-- Bài đăng ngoài AIMA (origin = EXTERNAL) không có content_versions → loại nội dung / đường dẫn / trích caption
-- lấy từ nền tảng. Bài AIMA cũng được điền permalink khi quét danh sách bài của Trang.
ALTER TABLE platform_media ADD COLUMN media_type varchar(20);
ALTER TABLE platform_media ADD COLUMN permalink varchar(2048);
ALTER TABLE platform_media ADD COLUMN caption_excerpt varchar(300);
CREATE INDEX idx_platform_media_account_published ON platform_media (platform_account_id, published_at);

-- Trạng thái đồng bộ CẤP TÀI KHOẢN (1 dòng / kênh đăng): quét danh sách bài của Trang (import bài ngoài AIMA)
-- + insights theo ngày của Trang + Trang có liên kết Instagram Business/Creator hay không.
-- next_sync_at NULL = không tự đồng bộ (vd. kết nối mẫu của dev-seed); chưa có dòng = đến hạn ngay.
CREATE TABLE account_sync_state (
    id uuid PRIMARY KEY,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6),
    deleted_at timestamp(6),
    platform_account_id uuid NOT NULL REFERENCES platform_accounts(id),
    next_sync_at timestamptz,
    last_synced_at timestamptz,
    consecutive_failures integer NOT NULL DEFAULT 0,
    posts_error_code varchar(50),
    insights_error_code varchar(50),
    last_error_at timestamptz,
    instagram_link_status varchar(20) CHECK (instagram_link_status IN ('LINKED','NOT_LINKED'))
);
CREATE UNIQUE INDEX uk_account_sync_state_account ON account_sync_state (platform_account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_account_sync_state_next_sync ON account_sync_state (next_sync_at) WHERE deleted_at IS NULL;

-- Số liệu cấp tài khoản theo ngày (ngày theo nền tảng báo — Facebook tính theo giờ Thái Bình Dương). Cột dùng
-- chung, đều nullable (null = nền tảng không trả / chưa có quyền / Trang dưới ngưỡng, KHÁC 0). Giữ vĩnh viễn.
CREATE TABLE account_insights_daily (
    id uuid PRIMARY KEY,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6),
    deleted_at timestamp(6),
    platform_account_id uuid NOT NULL REFERENCES platform_accounts(id),
    metric_date date NOT NULL,
    followers_count bigint,
    follows bigint,
    unfollows bigint,
    views bigint,
    reach bigint,
    interactions bigint,
    raw jsonb,
    collected_at timestamptz NOT NULL,
    CONSTRAINT uk_account_insights_daily_account_date UNIQUE (platform_account_id, metric_date)
);
CREATE INDEX idx_account_insights_daily_date ON account_insights_daily (metric_date);
