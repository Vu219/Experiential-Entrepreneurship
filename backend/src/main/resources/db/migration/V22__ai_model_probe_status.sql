-- Kết quả lần "Kiểm tra model" gần nhất (generateContent tối thiểu qua AI service /probe-models) — hiện ở trang
-- admin "Model & định tuyến". CHỈ THÊM cột (nullable, không sửa dữ liệu): binary cũ vẫn chạy trên schema mới.
-- last_probe_status = outcome của AI service ("ok" / "model_not_found" / "provider_overloaded" / …) — không CHECK vì
-- tập giá trị do AI service quyết định (giá trị lạ hiển thị nguyên văn).
-- Rollback: docs/sql/rollback/V22__ai_model_probe_status_down.sql

ALTER TABLE ai_models ADD COLUMN last_probe_status varchar(40);
ALTER TABLE ai_models ADD COLUMN last_probed_at timestamp(6);
