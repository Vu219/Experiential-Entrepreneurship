-- Phase 3: idempotency theo dòng cho API lịch dùng chung (tạo lịch / batch / đăng ngay).
-- Cùng (chủ, thao tác, key) + cùng payload → trả lại kết quả; khác payload → conflict. Chỉ lưu dòng
-- thành công (dòng lỗi được thử lại với cùng key mà không tạo lại dòng đã thành công).
CREATE TABLE idempotency_records (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation varchar(30) NOT NULL CHECK (operation IN ('SCHEDULE_CREATE','PUBLISH_NOW')),
    idempotency_key varchar(64) NOT NULL,
    request_hash varchar(64) NOT NULL,
    schedule_id uuid,
    job_id uuid,
    created_at timestamptz NOT NULL,
    CONSTRAINT uk_idempotency_records_owner_operation_key UNIQUE (owner_id, operation, idempotency_key)
);
