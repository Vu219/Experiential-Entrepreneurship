# Runbook production — Flyway V3–V5 và job sửa trạng thái (Phase 1–6)

> **Người dùng thực hiện.** Tài liệu này không được chạy tự động và chưa từng được chạy trên Supabase/production.
> Mọi bước đã diễn tập chỉ trên stack cô lập PostgreSQL :55432 / BE :8092 / FE :3100
> (xem [`SCHEDULING_PHASE0_RUNBOOK.md`](SCHEDULING_PHASE0_RUNBOOK.md)).

## 0. Điều kiện trước

- Đã hoàn tất Phase 0 runbook trên production: đối chiếu schema với V1, baseline tường minh V1, V2 đã migrate/validate.
  Chưa xong → dừng, **không** chạy V3–V5 lên DB chưa baseline.
- Binary backend mới (chứa V3–V5 + resolver) và frontend mới được build từ cùng commit.
- Backend cũ không tương thích schema V3 (CHECK constraint mới trên `content_items.status`, `content_versions.status`,
  cột `review_status`). **Không rollback riêng binary**; rollback = restore DB + binary cũ (mục 6).

## 1. Thay đổi schema

| Migration | Nội dung | Rủi ro dữ liệu |
|---|---|---|
| V3 `content_review_and_aggregate_status` | Thêm `content_items.review_status`; ánh xạ giá trị cũ (NEED_REVIEW/APPROVED → cột duyệt + bài GENERATED; ANALYZING/OPTIMIZED → POSTED; trạng thái pipeline của bản → FORMATTED); CHECK constraint mới. **Preflight ném lỗi khi gặp giá trị lạ** — cả dòng đã xóa mềm | Bài NEED_REVIEW/APPROVED cũ tạm thành GENERATED dù đã định dạng → job mục 4 sửa |
| V4 `schedule_holds_snapshot_revision` | Bảng `post_schedule_holds`; điền lý do cho lịch ON_HOLD cũ chỉ khi có bằng chứng (tài khoản xóa/không ACTIVE, user chờ xóa); cột `posts.snapshot_*` (Post cũ = UNKNOWN_LEGACY); `content_versions.revision`; `notifications.dedupe_key` + SCHEDULE_OVERDUE | Lịch ON_HOLD không có bằng chứng = "chưa phân loại" (báo cáo, không tự đoán) |
| V5 `schedule_idempotency` | Bảng `idempotency_records` (FK user ON DELETE CASCADE) | Không đụng dữ liệu cũ |

## 2. Diễn tập trên bản sao (bắt buộc)

1. Restore backup production mới nhất vào DB cô lập :55432 (bản sao đã **làm sạch credential**: xóa/ghi đè
   `platform_accounts.access_token/refresh_token`, khóa payOS, email thật nếu cần). Không bật kết nối mạng ra Meta.
2. Chạy preflight thủ công để biết trước V3 có dừng không:
   ```sql
   select status, count(*) from content_items group by status;
   select status, count(*) from content_versions group by status;
   select status, count(*) from post_schedules group by status;
   ```
   Giá trị V3 chấp nhận (cả `content_items.status` lẫn `content_versions.status`, gồm dòng xóa mềm): `DRAFT,
   GENERATED, NEED_REVIEW, APPROVED, FORMATTED, SCHEDULED, POSTING, POSTED, FAILED, ANALYZING, OPTIMIZED`. Có giá trị
   khác → V3 dừng và rollback; lập migration điều hòa riêng, không sửa V3.
3. Khởi động BE bản mới trên stack cô lập (`backend/isolated/start-backend.ps1`, trỏ bản sao) → Flyway chạy V3–V5,
   Hibernate `validate` phải qua.
4. Chạy job sửa trạng thái (mục 4) — dry-run, xem báo cáo, apply, dry-run lần hai phải rỗng.
5. Đối chiếu tổng hợp trước/sau (mục 5). Chạy `node backend/isolated/smoke.mjs` và test PostgreSQL
   (`./mvnw.cmd "-Disolated.postgres=true" test -Dtest=PublishingMigrationTest`).
6. Ghi lại: thời gian migrate, số dòng mỗi nhóm trong báo cáo, danh sách lịch IG bị giữ, hold chưa phân loại,
   bài duyệt không xác định. Chuyển danh sách IG cho người phụ trách nội dung kiểm tra **trước** production.

## 3. Maintenance production

1. Thông báo bảo trì; tắt FE ghi (hoặc để trang bảo trì).
2. **Dừng mọi writer/worker**: dừng tất cả instance backend. Đợi job đang chạy kết thúc — kiểm tra:
   ```sql
   select id, status, start_time from posting_jobs where status in ('RUNNING','PENDING','RETRYING');
   select id, status from post_schedules where status = 'POSTING';
   select name, lock_until, locked_by from shedlock where lock_until > now();
   ```
   Ghi nhận job POSTING/RUNNING và kết quả trên Meta (bài đã lên chưa) để tránh đăng trùng khi mở lại.
3. Backup đầy đủ (schema + dữ liệu + quyền/trigger/RLS), **kiểm tra restore được** trên DB khác trước khi đi tiếp.
4. Khởi động **một** instance backend mới với scheduler tắt: biến môi trường `APP_SCHEDULING_ENABLED=false`
   (map vào `app.scheduling.enabled`, `SchedulingConfig` không bật `@EnableScheduling`). Flyway chạy V3–V5 khi boot;
   `baseline-on-migrate` giữ `false`. Boot lỗi → dừng, restore (mục 6).
5. Kiểm tra `select version, success from flyway_schema_history order by installed_rank;` → 1..5 đều `true`.

## 4. Job sửa trạng thái (dry-run → apply)

Chỉ tài khoản ADMIN; endpoint không bao giờ tự chạy khi boot. Response chỉ có id + trạng thái, không nội dung/token.

1. Dry-run — không ghi gì:
   ```
   GET {API}/admin/maintenance/content-status-repair
   ```
   `result` gồm: `planToken`, `flywayVersion` (phải là `5`), `itemChanges[]` (`itemId`, `from`, `to`, `reason` =
   trạng thái sản xuất/lịch của các bản), `instagramSchedules[]` (lịch IG chưa đăng sẽ giữ `UNSUPPORTED_MEDIA`),
   `unclassifiedHolds[]`, `reviewUnknown[]` (bài đã vào pipeline đăng nhưng `review_status = NONE`), `enumUsage`
   (đếm giá trị enum theo cột — dùng làm preflight trước khi dọn giá trị legacy).
2. So số lượng với lần diễn tập. Khác đáng kể → dừng và tìm nguyên nhân.
3. Apply đúng kế hoạch đã xem:
   ```
   POST {API}/admin/maintenance/content-status-repair
   {"planToken": "<planToken của bước 1>"}
   ```
   Dữ liệu đổi sau dry-run → `409` mã `2144` → chạy lại bước 1. Thiếu token → `400` mã `2145`.
   Apply khóa từng bài (batch 200, thứ tự id) và tính lại bằng **chính** `ContentItemStatusResolver` của runtime.
   `result.remainingChanges` phải là `0`.
4. Dry-run lần hai: `itemChanges` và `instagramSchedules` rỗng (idempotent).
5. `unclassifiedHolds` và `reviewUnknown` **không** được job sửa: xử lý thủ công theo quyết định nghiệp vụ
   (hủy/kích hoạt lại lịch; duyệt lại bài). Không tự đặt APPROVED.

## 5. Kiểm chứng sau apply

```sql
-- tổng hợp: số bài theo (trạng thái, duyệt) — so với số trước migration theo bảng ánh xạ V3
select status, review_status, count(*) from content_items where deleted_at is null group by 1, 2 order by 1, 2;
-- lịch theo trạng thái + lý do giữ
select s.status, h.reason, count(*) from post_schedules s left join post_schedule_holds h on h.schedule_id = s.id
 where s.deleted_at is null group by 1, 2 order by 1, 2;
-- analytics không đổi (job không chạm post/post_analytics)
select count(*) from posts; select count(*) from post_analytics; select count(*) from posting_jobs;
```

Số `posts`, `post_analytics`, `posting_jobs` phải bằng trước apply. Trang Phân tích và Dashboard hiển thị đúng
số liệu cũ. Sau đó bật lại scheduler (bỏ `APP_SCHEDULING_ENABLED=false`), khởi động đủ instance, mở FE.
Theo dõi log `[StatusRepair]`, `PostingDispatchJob`, và notification `SCHEDULE_OVERDUE` trong giờ đầu.

## 6. Rollback / restore

- Lỗi trong V3–V5: Flyway chạy mỗi migration trong transaction PostgreSQL — migration lỗi tự rollback, nhưng các
  migration **trước đó** đã commit. Không vá tay `flyway_schema_history`, không `flyway clean`.
- Rollback toàn phần: dừng mọi instance → restore DB từ backup mục 3.3 → deploy lại binary cũ (commit trước Phase 1)
  → kiểm tra Hibernate validate + đăng nhập + danh sách lịch. Job đã ghi nhận ở mục 3.2 phải được đối chiếu với Meta
  trước khi bật scheduler cũ để tránh đăng lặp.
- Apply của job sửa trạng thái chỉ đổi `content_items.status`, và với lịch IG: thêm lý do `UNSUPPORTED_MEDIA` + chuyển
  lịch sang ON_HOLD. Nếu cần hoàn tác riêng phần này mà không restore, dùng danh sách `itemChanges`/`instagramSchedules`
  đã lưu từ dry-run (lịch IG vốn không đăng được trong MVP — FR-29).

## 7. Giới hạn đã biết

- Chưa đối chiếu schema/dữ liệu Supabase thật; V1 là baseline theo repository. Schema drift chỉ được phát hiện qua
  Hibernate validate + đối chiếu thủ công ở Phase 0 runbook — báo cáo job chỉ nêu `flywayVersion` và `enumUsage`.
- `enumUsage` chỉ đếm `content_items.status/review_status`, `content_versions.status`, `post_schedules.status`,
  `posts.snapshot_state`. Dọn giá trị enum legacy khác (vd `ConnectionStatus` CONNECTED/DISCONNECTED) cần truy vấn đếm
  riêng xác nhận không còn dòng dùng, rồi làm bằng migration mới.
