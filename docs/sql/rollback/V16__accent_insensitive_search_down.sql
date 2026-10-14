-- Rollback V16__accent_insensitive_search (chạy tay, SAU KHI đã chuyển binary về bản trước V16 —
-- binary mới gọi aima_unaccent/aima_script_hook trong GET /search và GET /content-items?q=).
-- Không mất dữ liệu. KHÔNG gỡ extension unaccent: trên Supabase nó có thể đã được bật từ trước / dùng chỗ khác.
BEGIN;

DROP FUNCTION IF EXISTS aima_script_hook(text);
DROP FUNCTION IF EXISTS aima_unaccent(text);
DELETE FROM flyway_schema_history WHERE version = '16';

COMMIT;
