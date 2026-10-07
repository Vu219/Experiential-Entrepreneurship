-- =====================================================================================================================
-- Gộp bản ghi theo dõi số liệu TRÙNG do ngắt kết nối rồi kết nối lại Facebook (analytics, 2026-10-07).
--
-- Nguyên nhân: mỗi lần kết nối lại tạo dòng platform_accounts MỚI (dòng cũ đã xoá mềm). platform_media gắn theo dòng kết
-- nối → bài cũ (kể cả bài AIMA) nằm ở kết nối đã xoá (bị trang Phân tích ẩn), lượt quét Trang của kết nối mới tạo bản
-- "Ngoài AIMA" trùng ID. Code đã sửa cho các lần kết nối lại SAU này (AnalyticsAccountSyncService.adoptPreviousConnections);
-- script này dọn dữ liệu ĐÃ trùng, cùng thuật toán:
--   - nhóm theo (kết nối ĐANG HOẠT ĐỘNG của cùng user + cùng nền tảng + cùng id tài khoản nền tảng, id bài);
--   - giữ 1 bản: gắn bài AIMA trước, rồi bản tạo sớm nhất (lịch sử dài nhất);
--   - snapshot của bản bị gộp → chuyển sang bản giữ lại; số theo ngày của bản bị gộp → xoá mềm; bản bị gộp → xoá mềm;
--   - bản giữ lại → chuyển sang kết nối đang hoạt động, đồng bộ lại ngay (job tính lại số theo ngày từ snapshot đã gộp).
-- Không xoá cứng gì. post_analytics (mốc 24/48/168h), posts, account_insights_daily KHÔNG bị đụng.
--
-- TÀI LIỆU THAM KHẢO: PHẦN B đã được đưa vào Flyway V10__merge_reconnect_duplicate_media.sql (duyệt 2026-10-07) — backend tự
-- chạy khi khởi động, KHÔNG cần chạy tay. PHẦN A (chỉ đọc) vẫn dùng để xem trước / kiểm sau: sau V10 phải trả 0 dòng.
-- =====================================================================================================================

-- ---------------------------------------------- PHẦN A — XEM TRƯỚC (chỉ đọc) ----------------------------------------------
with target as (
    select a.id as target_id, a.user_id, a.platform_name, a.platform_account_id
    from platform_accounts a
    where a.deleted_at is null and a.account_type <> 'USER'
),
cand as (
    select m.id as media_id, m.platform_media_id, m.origin, m.post_id, m.platform_account_id as current_account,
           a.deleted_at is not null as on_deleted_connection, t.target_id, m.created_at,
           row_number() over (partition by t.target_id, m.platform_media_id
                              order by (m.post_id is not null) desc, m.created_at asc) as rn,
           count(*) over (partition by t.target_id, m.platform_media_id) as copies,
           bool_or(a.deleted_at is not null) over (partition by t.target_id, m.platform_media_id) as any_on_deleted
    from platform_media m
    join platform_accounts a on a.id = m.platform_account_id
    join target t on t.user_id = a.user_id and t.platform_name = a.platform_name
                 and t.platform_account_id = a.platform_account_id
    where m.deleted_at is null
)
select platform_media_id, media_id, origin, post_id is not null as is_aima, on_deleted_connection, copies,
       case when rn = 1 then 'GIỮ → chuyển sang kết nối ' || target_id else 'GỘP vào bản giữ (xoá mềm)' end as action
from cand
where copies > 1 or any_on_deleted
order by platform_media_id, rn;

-- ---------------------------------------------- PHẦN B — ÁP DỤNG (sau khi backup) ----------------------------------------
-- begin;
--
-- create temp table merge_plan on commit drop as
-- with target as (
--     select a.id as target_id, a.user_id, a.platform_name, a.platform_account_id
--     from platform_accounts a
--     where a.deleted_at is null and a.account_type <> 'USER'
-- ),
-- cand as (
--     select m.id as media_id, t.target_id,
--            row_number() over (partition by t.target_id, m.platform_media_id
--                               order by (m.post_id is not null) desc, m.created_at asc) as rn,
--            first_value(m.id) over (partition by t.target_id, m.platform_media_id
--                                    order by (m.post_id is not null) desc, m.created_at asc) as keeper_id,
--            count(*) over (partition by t.target_id, m.platform_media_id) as copies,
--            bool_or(a.deleted_at is not null) over (partition by t.target_id, m.platform_media_id) as any_on_deleted
--     from platform_media m
--     join platform_accounts a on a.id = m.platform_account_id
--     join target t on t.user_id = a.user_id and t.platform_name = a.platform_name
--                  and t.platform_account_id = a.platform_account_id
--     where m.deleted_at is null
-- )
-- select * from cand where copies > 1 or any_on_deleted;
--
-- -- 1) snapshot của bản bị gộp → bản giữ lại
-- update post_metric_snapshots s set platform_media_id = p.keeper_id, updated_at = now()
-- from merge_plan p where s.platform_media_id = p.media_id and p.rn > 1;
-- -- 2) số theo ngày của bản bị gộp → xoá mềm (bản giữ lại tính lại khi đồng bộ)
-- update post_metrics_daily d set deleted_at = now(), updated_at = now()
-- from merge_plan p where d.platform_media_id = p.media_id and p.rn > 1 and d.deleted_at is null;
-- -- 3) bản bị gộp → xoá mềm (giải phóng unique (kết nối, id bài) trước bước 4)
-- update platform_media m set deleted_at = now(), updated_at = now()
-- from merge_plan p where m.id = p.media_id and p.rn > 1;
-- -- 4) bản giữ lại → kết nối đang hoạt động + đồng bộ lại ngay
-- update platform_media m set platform_account_id = p.target_id, updated_at = now(),
--        next_sync_at = case when m.sync_status = 'ACTIVE' then now() else m.next_sync_at end
-- from merge_plan p where m.id = p.media_id and p.rn = 1;
--
-- commit;
