-- Tìm kiếm KHÔNG DẤU cho ô tìm kiếm toàn cục (GET /search) và GET /content-items?q=.
-- CHỈ THÊM extension + hàm — không đổi bảng/dữ liệu, binary cũ vẫn chạy trên schema mới.
-- Rollback: docs/sql/rollback/V16__accent_insensitive_search_down.sql
--
-- Supabase: extension thường đã/được bật trong schema "extensions" (Dashboard → Database → Extensions).
-- `if not exists` khi đó là no-op; nếu chưa bật thì extension cài vào schema mặc định của Flyway.
-- Hàm bọc bên dưới tự tra schema thật của extension nên gọi được bất kể search_path của app.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent(text) không IMMUTABLE (phụ thuộc search_path) → bọc bằng bản 2 tham số với dictionary ghi rõ schema.
-- unaccent.rules mặc định đã map đ/Đ → d/D.
DO $migration$
DECLARE
    ext_schema text;
BEGIN
    SELECT n.nspname INTO ext_schema
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'unaccent';

    EXECUTE format($fn$
        CREATE OR REPLACE FUNCTION aima_unaccent(text) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        AS $body$ SELECT %1$I.unaccent(%2$L::regdictionary, $1) $body$
    $fn$, ext_schema, ext_schema || '.unaccent');
END
$migration$;

-- Câu mở đầu (hook) của kịch bản — cùng quy ước util/ScriptJson.parse: JSON {"hook":{"content":…}};
-- bài cũ dạng dòng (không phải JSON hợp lệ) → dòng không rỗng đầu tiên. Không bao giờ ném lỗi.
CREATE OR REPLACE FUNCTION aima_script_hook(script text) RETURNS text
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE STRICT
AS $fn$
DECLARE
    trimmed text := btrim(script);
BEGIN
    IF trimmed = '' THEN
        RETURN NULL;
    END IF;
    IF left(trimmed, 1) = '{' THEN
        BEGIN
            RETURN trimmed::jsonb -> 'hook' ->> 'content';
        EXCEPTION WHEN others THEN
            -- không phải JSON hợp lệ → coi như bài cũ dạng dòng
        END;
    END IF;
    RETURN (SELECT btrim(line)
            FROM regexp_split_to_table(trimmed, E'\\r?\\n') WITH ORDINALITY AS t(line, n)
            WHERE btrim(line) <> ''
            ORDER BY n
            LIMIT 1);
END
$fn$;
