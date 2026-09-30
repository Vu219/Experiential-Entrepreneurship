# WORKFLOWS.md — Use Cases & Business Flows (AIMA)

---

## Main Use Cases

| UC | Name | Actor | Result |
|----|-----|-------|---------|
| UC-01 | Configure Brand Persona | User | Brand profile saved |
| UC-02 | Define Content Strategy | User | Strategy saved, usable by the AI |
| UC-03 | Connect Social Account | User | Social account linked |
| UC-04 | Research Trends | Agent AI | List of trends + content ideas |
| UC-05 | Generate Content | Agent AI | Draft content |
| UC-06 | Review Generated Content | User | Approve / regenerate |
| UC-07 | Format Content by Platform | Agent AI | ContentVersion per platform |
| UC-08 | Schedule Post | Agent AI + User | Post added to the calendar |
| UC-09 | Auto Publish Post | Agent AI + Platforms | Posted or Failed |
| UC-10 | Analyze Performance | Analytics + Agent AI | Insights |
| UC-11 | Optimize Future Strategy | Agent AI | Improved strategy |
| UC-12 | Manage Failed Posts | User + Admin | Edit / repost / cancel |

---

## Business Flows (BF)

### BF01 — Brand Persona Setup
User opens the configuration → enters brand information → selects platforms → sets frequency/schedule → system validates → saves → AI creates the internal brand profile.

### BF02 — Strategy Configuration
Choose goals → content types → platforms → frequency → time slots → save the strategy.

### BF03 — Content Generation
AI receives brand profile + strategy + trend/idea → writes script → caption → hashtags → CTA → media prompt → checks brand voice → saves draft.

### BF04 — Platform Formatting
Check connected platforms → fetch the original content → adapt caption/hashtags/media per platform → create ContentVersion → save.

### BF05 — Schedule & Posting
Check the calendar → select a post → determine the golden hour → enqueue → at the scheduled time call the platform API → receive the result → save the status. Success → track analytics. Failure → log the error + notify.

### BF06 — Trend Research
At the scheduled time (or manually) → collect trends from the platforms → filter by industry → rate relevance → select promising trends → create content ideas → save.

### BF07 — Performance Analysis
After publishing, wait a period → fetch engagement data → store analytics → AI compares posts → identifies the best performers → analyzes the success factors → produces insights.

### BF08 — Strategy Optimization
AI takes analytics + insights → identifies what to improve → proposes adjustments → user accepts/rejects → if accepted, the strategy is updated.

### BF09 — Error Handling
Detect the error → log it → move the post to `Failed` → if temporary, retry → if user action is needed, notify → user edits / reconnects / reposts.

---

## Exception Flows

| EX | Situation | Handling |
|----|-----------|-------|
| EX-01 | Social account not connected | Block posting, show a connection prompt, resume after connecting |
| EX-02 | Content violates platform policy (HTTP 400/403) | `Failed`, **no retry**, store the error code + message, notify the user, allow edit/regenerate then repost |
| EX-03 | Publishing failed (token/API/media/account limit) | `Failed`, store the error; temporary → retry; not self-resolvable → notify the user |
| EX-04 | Content doesn't match the brand | User regenerates (with notes), a new version is saved |
| EX-05 | Analytics unavailable | Log the error, retry later; still failing → report "not yet available"; the post stays `Posted` |

---

## Post State Machine (D2 — 2026-09-30)

Trạng thái được tách thành **ba chiều độc lập** (thay cho một chuỗi Draft → … → Optimized). Không thêm giá trị ngoài các enum dưới đây.

**1. Trạng thái tổng của bài — `ContentItemStatus` (suy ra, không set tay).** `ContentItemStatusResolver` là writer duy nhất; mọi luồng đổi bản/lịch/job khóa bài trước (thứ tự item → version → schedule → job) rồi tính lại:

```
có lịch POSTING                         → POSTING
có lịch POSTED  → mọi bản đã đăng       → POSTED
                → còn bản chưa đăng     → PARTIALLY_POSTED
chưa đăng bản nào: FAILED > ON_HOLD > SCHEDULED (theo lịch hiệu lực)
không có lịch hiệu lực: mọi bản FORMATTED → FORMATTED; có nội dung → GENERATED; còn lại → DRAFT
```

Bản xóa mềm và lịch CANCELLED không tính. Hủy lịch đưa bài về FORMATTED (hoặc GENERATED/DRAFT). Analytics **không** đổi trạng thái — `Analyzing`/`Optimized` cũ được V3 chuyển thành POSTED; việc tối ưu chiến lược là dữ liệu riêng (insight), không phải trạng thái bài.

**2. Duyệt — `ReviewStatus` trên bài.**

```
NONE / CHANGES_REQUESTED → NEED_REVIEW → APPROVED
                                       → CHANGES_REQUESTED
APPROVED --(sửa nội dung thật)--> NEED_REVIEW      (sửa no-op giữ nguyên duyệt)
```

Gửi lại đúng trạng thái hiện tại là no-op. Khi user bật "Bắt buộc duyệt" (`user_publishing_settings.require_approval`), lịch của bài chưa APPROVED bị giữ với lý do `PENDING_REVIEW`.

**3. Trạng thái sản xuất của bản nền tảng — `ContentVersionStatus`:** `DRAFT → GENERATED → FORMATTED`. Lịch không đổi trạng thái này. Mỗi lần sửa thật tăng `revision`; job định dạng về muộn so với bản đã sửa/đang đăng bị bỏ.

**Lịch — `ScheduleStatus`:**

```
SCHEDULED → POSTING → POSTED
                    → FAILED  (lỗi vĩnh viễn / vi phạm chính sách / hết 3 lần retry — lịch giữ POSTING trong chu kỳ retry 5/15/30 phút)
SCHEDULED ⇄ ON_HOLD         (theo tập lý do giữ, xem dưới)
SCHEDULED / ON_HOLD / FAILED → CANCELLED (bản ghi được tái sử dụng khi lên lịch lại)
```

**Lý do tạm giữ — `post_schedule_holds` (nhiều lý do cùng lúc):** `ACCOUNT_ISSUE` (token hết hạn/bị thu hồi/lỗi), `ACCOUNT_REMOVED` (ngắt kết nối, Meta deauthorize/data deletion), `PENDING_REVIEW`, `USER_PENDING_DELETE`, `UNSUPPORTED_MEDIA` (Instagram cần ảnh/video — MVP không tạo media). `ScheduleHoldService` là nơi duy nhất thêm/gỡ lý do; mỗi luồng chỉ gỡ lý do của mình (kết nối lại chỉ gỡ `ACCOUNT_ISSUE`). Lịch về SCHEDULED **chỉ khi hết lý do và giờ đăng còn ở tương lai**; quá giờ thì giữ ON_HOLD + nhắc một lần (`SCHEDULE_OVERDUE`) và user chọn giờ mới. Khôi phục tài khoản gỡ `USER_PENDING_DELETE` nhưng không tự đăng lại.

**Snapshot khi đăng:** nội dung được chụp vào `posts.snapshot_*` trong cùng transaction claim lịch; retry dùng snapshot, không đọc bản đang sửa. Post cũ trước V4 = `UNKNOWN_LEGACY`.

| Trạng thái tổng | Ý nghĩa |
|---|---|
| DRAFT | Chưa có nội dung |
| GENERATED | Đã có nội dung, chưa định dạng đủ các nền tảng |
| FORMATTED | Mọi bản nền tảng đã định dạng, chưa có lịch |
| SCHEDULED | Có lịch chờ đăng |
| ON_HOLD | Có lịch bị tạm giữ (xem lý do) |
| POSTING | Đang đăng (kể cả trong chu kỳ retry) |
| POSTED | Mọi bản đã đăng |
| PARTIALLY_POSTED | Một phần nền tảng đã đăng, phần còn lại lỗi/chưa đăng |
| FAILED | Đăng thất bại chung cuộc, chưa bản nào đăng |

Sửa nội dung được khi bài không ở POSTING (bản đang POSTING bị khóa — 2131); PARTIALLY_POSTED/FAILED vẫn sửa được để đăng lại phần lỗi.

### BF — Tạo nội dung → lên lịch (wizard, 2026-09-30)

Wizard `/create/:id?step=N`: (1) nguồn/chiến lược → (2) nội dung → (3) định dạng + `ReadinessChecklist` theo nền tảng (định dạng, tài khoản ACTIVE, IG, brand voice, bắt buộc duyệt) → (4) `SchedulePlanner` — mỗi nền tảng một dòng, chế độ Đăng ngay / Chọn giờ / Gợi ý giờ / Không đăng, gửi `POST /schedules/batch` (mỗi dòng một transaction, idempotency theo dòng). Dòng lỗi được thử lại với cùng key. Trùng lịch trong cửa sổ `conflict_window_minutes` chỉ cảnh báo. Bài đã gửi duyệt/lên lịch mở lại ở chế độ chỉ lên lịch (bước 1–3 chỉ đọc). Modal tạo lịch của Calendar dùng cùng planner.

### Sửa dữ liệu cũ (một lần, admin)

`GET /admin/maintenance/content-status-repair` (dry-run, không ghi) → xem kế hoạch → `POST` cùng endpoint với `planToken` (dữ liệu đổi từ lúc dry-run → 409/2144). Job tính lại trạng thái tổng bằng chính resolver và giữ lịch Instagram chưa đăng bằng `UNSUPPORTED_MEDIA`; hold cũ chưa phân loại và bài duyệt không xác định chỉ được báo cáo. Quy trình production: `SCHEDULING_PRODUCTION_RUNBOOK.md`.

## Publishing time contract — Phase 0 (2026-09-30)

Lịch đăng và thời điểm đăng/thu thập analytics được lưu dưới dạng instant UTC (`timestamptz`). Người dùng nhập ngày giờ theo `user_publishing_settings.timezone`, mặc định `Asia/Ho_Chi_Minh`; frontend gửi ISO-8601 có offset, backend từ chối thời gian quá khứ hoặc chuỗi thiếu offset. Các báo cáo theo ngày Việt Nam giữ timezone tường minh. State machine D2/duyệt/tạm giữ ở mục trên (Phase 1–2 của `CREATE_SCHEDULE_IMPLEMENTATION_PLAN.md`). Quy trình baseline dữ liệu cũ, kiểm chứng và rollback: `SCHEDULING_PHASE0_RUNBOOK.md`.
