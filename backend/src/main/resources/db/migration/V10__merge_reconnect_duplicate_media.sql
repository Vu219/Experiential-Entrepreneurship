-- Gộp bản ghi theo dõi số liệu TRÙNG do ngắt kết nối rồi kết nối lại (docs/analytics-real-data-plan.md mục D.8; bản tham
-- khảo có phần xem trước: docs/sql/analytics_merge_reconnect_duplicates.sql). Người dùng duyệt 2026-10-07.
--
-- Mỗi lần kết nối lại tạo dòng platform_accounts MỚI (dòng cũ xoá mềm) → bài cũ kẹt ở kết nối đã xoá, lượt quét Trang tạo bản
-- "Ngoài AIMA" trùng id. Code từ nay tự chuyển khi kết nối lại (AnalyticsAccountSyncService.adoptPreviousConnections); migration
-- này dọn dữ liệu ĐÃ trùng, cùng thuật toán:
--   nhóm theo (kết nối ĐANG HOẠT ĐỘNG cùng user + nền tảng + id tài khoản nền tảng, id bài) → giữ 1 bản (gắn bài AIMA trước, rồi
--   bản tạo sớm nhất); snapshot của bản bị gộp chuyển sang bản giữ; số theo ngày của bản bị gộp và chính nó bị XOÁ MỀM; bản giữ
--   chuyển sang kết nối đang hoạt động và được đồng bộ lại ngay (job tính lại số theo ngày từ chuỗi snapshot đã gộp).
--
-- An toàn khi chạy lại: chỉ xử lý nhóm còn trùng hoặc còn nằm ở kết nối đã xoá → lần hai không có gì để làm.
-- KHÔNG đụng: posts, post_analytics (mốc 24h/48h/7 ngày), account_insights_daily (số cấp Trang), account_sync_state. Không xoá cứng.

CREATE TEMP TABLE merge_plan ON COMMIT DROP AS
WITH target AS (
    SELECT a.id AS target_id, a.user_id, a.platform_name, a.platform_account_id
    FROM platform_accounts a
    WHERE a.deleted_at IS NULL AND a.account_type <> 'USER'
),
cand AS (
    SELECT m.id AS media_id, t.target_id,
           row_number() OVER (PARTITION BY t.target_id, m.platform_media_id
                              ORDER BY (m.post_id IS NOT NULL) DESC, m.created_at ASC, m.id) AS rn,
           first_value(m.id) OVER (PARTITION BY t.target_id, m.platform_media_id
                                   ORDER BY (m.post_id IS NOT NULL) DESC, m.created_at ASC, m.id) AS keeper_id,
           count(*) OVER (PARTITION BY t.target_id, m.platform_media_id) AS copies,
           bool_or(a.deleted_at IS NOT NULL) OVER (PARTITION BY t.target_id, m.platform_media_id) AS any_on_deleted
    FROM platform_media m
    JOIN platform_accounts a ON a.id = m.platform_account_id
    JOIN target t ON t.user_id = a.user_id AND t.platform_name = a.platform_name
                 AND t.platform_account_id = a.platform_account_id
    WHERE m.deleted_at IS NULL
)
SELECT media_id, target_id, rn, keeper_id FROM cand WHERE copies > 1 OR any_on_deleted;

-- 1) Snapshot của bản bị gộp → bản giữ lại.
UPDATE post_metric_snapshots s SET platform_media_id = p.keeper_id, updated_at = now()
FROM merge_plan p WHERE s.platform_media_id = p.media_id AND p.rn > 1;

-- 2) Số theo ngày của bản bị gộp → xoá mềm (bản giữ lại tính lại khi đồng bộ).
UPDATE post_metrics_daily d SET deleted_at = now(), updated_at = now()
FROM merge_plan p WHERE d.platform_media_id = p.media_id AND p.rn > 1 AND d.deleted_at IS NULL;

-- 3) Bản bị gộp → xoá mềm (giải phóng unique (kết nối, id bài) trước bước 4).
UPDATE platform_media m SET deleted_at = now(), updated_at = now()
FROM merge_plan p WHERE m.id = p.media_id AND p.rn > 1;

-- 4) Bản giữ lại → kết nối đang hoạt động; đang theo dõi thì đồng bộ lại ngay.
UPDATE platform_media m SET platform_account_id = p.target_id, updated_at = now(),
       next_sync_at = CASE WHEN m.sync_status = 'ACTIVE' THEN now() ELSE m.next_sync_at END
FROM merge_plan p WHERE m.id = p.media_id AND p.rn = 1;
