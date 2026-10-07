-- Analytics dữ liệu thật — Giai đoạn 1 (docs/analytics-real-data-plan.md mục 3.1 + D).
-- CHỈ THÊM bảng mới, không sửa/xoá dữ liệu cũ. Snapshot cũ từ post_analytics được job chép sang
-- (source = BACKFILL) ở lần chạy đầu — bảng post_analytics giữ nguyên.

-- Số TÍCH LUỸ tại mỗi lần đồng bộ. Cột metric dùng chung cho mọi nền tảng, đều cho phép NULL
-- (null = nền tảng không cung cấp / chưa có quyền, KHÁC 0); metric riêng của nền tảng nằm trong raw.
CREATE TABLE post_metric_snapshots (
    id uuid PRIMARY KEY,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6),
    deleted_at timestamp(6),
    platform_media_id uuid NOT NULL REFERENCES platform_media(id),
    collected_at timestamptz NOT NULL,
    views bigint,
    reach bigint,
    reactions bigint,
    comments bigint,
    shares bigint,
    saves bigint,
    raw jsonb,
    source varchar(10) NOT NULL CHECK (source IN ('POLL','BACKFILL'))
);
CREATE INDEX idx_post_metric_snapshots_media_collected ON post_metric_snapshots (platform_media_id, collected_at DESC);

-- Số PHÁT SINH theo ngày (giờ Việt Nam), tính lại từ chuỗi snapshot của bài. reach không cộng được
-- giữa các ngày (người xem duy nhất) nên không có cột delta.
CREATE TABLE post_metrics_daily (
    id uuid PRIMARY KEY,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6),
    deleted_at timestamp(6),
    platform_media_id uuid NOT NULL REFERENCES platform_media(id),
    metric_date date NOT NULL,
    views_delta bigint NOT NULL DEFAULT 0,
    reactions_delta bigint NOT NULL DEFAULT 0,
    comments_delta bigint NOT NULL DEFAULT 0,
    shares_delta bigint NOT NULL DEFAULT 0,
    saves_delta bigint NOT NULL DEFAULT 0,
    is_estimated boolean NOT NULL DEFAULT false,
    CONSTRAINT uk_post_metrics_daily_media_date UNIQUE (platform_media_id, metric_date)
);
CREATE INDEX idx_post_metrics_daily_date ON post_metrics_daily (metric_date);

