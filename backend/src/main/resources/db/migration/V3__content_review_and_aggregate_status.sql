-- Phase 1 (D2): tách trạng thái duyệt (review_status) khỏi trạng thái tổng của bài; bản nền tảng chỉ
-- còn trạng thái sản xuất (DRAFT/GENERATED/FORMATTED), vòng đời đăng nằm ở post_schedules.
-- Ánh xạ legacy có kiểm tra, gồm cả dòng đã xóa mềm. Giá trị lạ → dừng migration (transaction
-- rollback), không xóa/sửa dữ liệu để qua constraint. Trạng thái duyệt đã bị lịch ghi đè không khôi
-- phục được → NONE, không tự duyệt. Trạng thái tổng của bài NEED_REVIEW/APPROVED cũ tạm về
-- GENERATED; ContentItemStatusResolver tính lại khi bài được chạm tới (job sửa dữ liệu ở Phase 6).
DO $$
DECLARE
    unknown text;
BEGIN
    SELECT string_agg(DISTINCT status, ', ') INTO unknown FROM content_items
    WHERE status NOT IN ('DRAFT','GENERATED','NEED_REVIEW','APPROVED','FORMATTED','SCHEDULED',
                         'POSTING','POSTED','FAILED','ANALYZING','OPTIMIZED');
    IF unknown IS NOT NULL THEN
        RAISE EXCEPTION 'content_items.status has unmapped legacy values: %', unknown;
    END IF;
    SELECT string_agg(DISTINCT status, ', ') INTO unknown FROM content_versions
    WHERE status NOT IN ('DRAFT','GENERATED','NEED_REVIEW','APPROVED','FORMATTED','SCHEDULED',
                         'POSTING','POSTED','FAILED','ANALYZING','OPTIMIZED');
    IF unknown IS NOT NULL THEN
        RAISE EXCEPTION 'content_versions.status has unmapped legacy values: %', unknown;
    END IF;
END $$;

-- Tên CHECK do Hibernate/Postgres tự đặt có thể khác giữa các DB → gỡ mọi CHECK trên đúng cột status.
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT con.conrelid::regclass AS tbl, con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
        WHERE con.contype = 'c' AND att.attname = 'status'
          AND con.conrelid IN ('content_items'::regclass, 'content_versions'::regclass)
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    END LOOP;
END $$;

ALTER TABLE content_items ADD COLUMN review_status varchar(20) NOT NULL DEFAULT 'NONE'
    CHECK (review_status IN ('NONE','NEED_REVIEW','APPROVED','CHANGES_REQUESTED'));

UPDATE content_items SET review_status = status WHERE status IN ('NEED_REVIEW','APPROVED');

UPDATE content_items SET status = CASE status
    WHEN 'NEED_REVIEW' THEN 'GENERATED'
    WHEN 'APPROVED' THEN 'GENERATED'
    WHEN 'ANALYZING' THEN 'POSTED'
    WHEN 'OPTIMIZED' THEN 'POSTED'
    ELSE status END
WHERE status IN ('NEED_REVIEW','APPROVED','ANALYZING','OPTIMIZED');

-- Chỉ bản FORMATTED mới lên lịch được, nên mọi trạng thái pipeline cũ của bản đều là bản đã định dạng.
UPDATE content_versions SET status = CASE
    WHEN status IN ('NEED_REVIEW','APPROVED') THEN 'GENERATED'
    ELSE 'FORMATTED' END
WHERE status IN ('NEED_REVIEW','APPROVED','SCHEDULED','POSTING','POSTED','FAILED','ANALYZING','OPTIMIZED');

ALTER TABLE content_items ADD CONSTRAINT content_items_status_check
    CHECK (status IN ('DRAFT','GENERATED','FORMATTED','SCHEDULED','ON_HOLD','POSTING','POSTED',
                      'PARTIALLY_POSTED','FAILED'));
ALTER TABLE content_versions ADD CONSTRAINT content_versions_status_check
    CHECK (status IN ('DRAFT','GENERATED','FORMATTED'));

COMMENT ON COLUMN content_items.status IS 'Derived aggregate; written only by ContentItemStatusResolver.';
COMMENT ON COLUMN content_items.review_status IS 'FR-34 review state, independent of the aggregate status.';
COMMENT ON COLUMN content_versions.status IS 'Production status only; publishing lifecycle lives in post_schedules.';
