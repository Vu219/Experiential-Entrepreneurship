# Bàn giao: wizard tạo nội dung → lịch đăng

Cập nhật: 2026-09-30. Repo: `D:\SU26\EXE`. Commit gốc: `87c6a61`. **Phase 0–6 đã làm xong trong working tree, CHƯA commit** — người dùng tự commit. Đừng chạy `git reset`, `git clean` hay checkout mới rồi bỏ sót file untracked (migration V1–V5, cấu hình isolated, test, tài liệu, `AGENTS.md`).

## Đọc theo thứ tự

1. `AGENTS.md`, `backend/CLAUDE.md` (§4 Content Generation → Trạng thái, Post Scheduling, Auto-Posting, "Wizard ↔ lịch đăng"), `frontend/CLAUDE.md`, `frontend/rule.md`.
2. `docs/WORKFLOWS.md` → "Post State Machine (D2)": ba chiều trạng thái, lý do tạm giữ, snapshot, luồng wizard.
3. `docs/CREATE_SCHEDULE_IMPLEMENTATION_PLAN.md`: quyết định thiết kế và tiêu chí từng phase.
4. `docs/SCHEDULING_PHASE0_RUNBOOK.md` (stack cô lập, V1/V2, contract thời gian) và `docs/SCHEDULING_PRODUCTION_RUNBOOK.md` (V3–V5 + job sửa trạng thái trên production — người dùng thực hiện).
5. `docs/PLAN.md` mục "Wizard → lịch đăng" — chi tiết đã làm/kiểm chứng của từng phase.

## Trạng thái

| Phase | Nội dung | Kiểm chứng chính |
|---|---|---|
| 0 | Flyway V1/V2, Instant/timestamptz, timezone đăng theo user | `PublishingMigrationTest` (PG), smoke :8092 |
| 1 | D2 (V3): `review_status`, trạng thái tổng suy ra, `ContentItemStatusResolver` là writer duy nhất | `ContentItemStatusResolverTest`, `ContentItemServiceImplTest`, worker 2 bản song song |
| 2 | V4: holds nhiều lý do, policy duyệt/brand voice, sửa bài đã lên lịch, snapshot khi dispatch, chặn IG, nhắc quá giờ | `SchedulePolicyIntegrationTest`, `ContentFormattingLateResultTest`, worker/dispatcher |
| 3 | V5: batch theo dòng + idempotency, publish-now, suggested slots, đổi tài khoản | `ScheduleApiIntegrationTest` |
| 4 | FE `SchedulePlanner` dùng chung (wizard bước 4 + Calendar) | `tests/schedulePlanner.test.ts`, headless Chrome :3100 |
| 5 | Wizard `/create/:id?step=N`, `ReadinessChecklist`, danh sách/Calendar deep link | headless Chrome :3100 (12 bước) |
| 6 | Job sửa trạng thái (dry-run/apply, ADMIN) + tài liệu + runbook production | `ContentStatusRepairIntegrationTest`, smoke :8092 dry-run → apply → dry-run rỗng |

Quyết định đã chốt khi làm (ghi lại để không làm ngược): khôi phục tài khoản/kết nối lại chỉ gỡ lý do của mình, không tự đăng lại; lựa chọn planner chưa gửi không được lưu (không có V6); lịch IG cũ chỉ bị giữ bởi job sửa dữ liệu và chốt chặn dispatcher (không migration); PARTIALLY_POSTED/FAILED vẫn sửa được, chỉ bản đang POSTING bị khóa; job sửa dữ liệu không tự duyệt và không đoán lý do cho hold cũ.

## Chưa xác minh / rủi ro

- **Chưa đối chiếu schema/dữ liệu Supabase thật.** V1 là baseline theo repository; V3 dừng nếu gặp giá trị trạng thái lạ. Mọi thứ trên production theo `SCHEDULING_PRODUCTION_RUNBOOK.md`, sau diễn tập trên bản sao đã làm sạch.
- Chrome extension không kết nối được trong phiên → kiểm thử UI bằng headless Chrome (CDP) trên :3100, không có ảnh chụp cho người duyệt.
- Full backend suite còn 14 failure có sẵn ngoài phạm vi (8 AccountManagementTest + 5 BrandProfileTest gọi route auth cũ → 401; 1 SubscriptionLifecycleTest dùng ngày cố định đã hết hạn).
- Không chạy đăng bài thật; Meta/AI chỉ tới stub :58080.

## Stack cô lập

PostgreSQL :55432, Redis :56379, stub :58080 (`backend/isolated/mock-services.mjs`, có `/golden-hours`), BE :8092 (`backend/isolated/start-backend.ps1`), FE :3100. Scheduler tắt. Smoke: `node backend/isolated/smoke.mjs` từ repo root (admin seed của stack). Kiểm tra port trước khi dùng lại — không giả định process còn chạy ở phiên sau. **Không chạy backend với cấu hình mặc định: `.env` trỏ Supabase thật.**
