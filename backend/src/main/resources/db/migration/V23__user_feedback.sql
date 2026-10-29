-- G1.3 — kênh đánh giá & góp ý trong sản phẩm: người dùng chấm 1–5 sao + nhận xét tuỳ chọn, admin xem ở /admin/feedback.
-- CHỈ THÊM bảng mới, không sửa dữ liệu cũ. Xoá cứng tài khoản → AccountPurgeService xoá góp ý của user đó trước.
-- Rollback: docs/sql/rollback/V23__user_feedback_down.sql

CREATE TABLE user_feedback (
    id uuid PRIMARY KEY,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6),
    deleted_at timestamp(6),
    user_id uuid NOT NULL REFERENCES users (id),
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment varchar(1000),
    page varchar(120),
    -- true = dữ liệu MÔ PHỎNG do dev-seed sinh (POST /admin/feedback/dev-seed) — không phải đánh giá thật.
    sample boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_user_feedback_created ON user_feedback (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_feedback_user ON user_feedback (user_id);
