# PLAN.md — Implementation Checklist (AIMA)

> **This file is the single source of truth for implementation progress.**
>
> **Rules:**
> 1. Whenever any function below is completed (implemented **and** verified), update this file **in the same commit/PR**: change `[ ]` to `[x]` and append the completion date, e.g. `[x] FR-01 Register — done 2026-06-12`.
> 2. Items do **not** need to be done in order — pick any item, in any group.
> 3. If the scope changes (item added/removed/redefined), update this checklist and the related doc (REQUIREMENTS.md, etc.) together.
>
> References: [REQUIREMENTS.md](./REQUIREMENTS.md) (FR details) • [Implementation_Strategy.md](./Implementation_Strategy.md) (how to build) • [WORKFLOWS.md](./WORKFLOWS.md) (flows & state machine) • [DATA_MODEL.md](./DATA_MODEL.md) (entities) • [UI_API.md](./UI_API.md) (UI/API/security)
>
> Tags: `[FE]` frontend (React) • `[BE]` backend (Spring Boot) • `[AI]` AI service (Python)

---

## 1. Account Management
- [x] FR-01 Register (full name, email, password, confirmation) `[BE][FE]` — done 2026-06-12
- [x] FR-02 Login (email + password, error on invalid) `[BE][FE]` — done 2026-06-12
- [x] FR-03 Logout `[BE][FE]` — done 2026-06-12
- [x] FR-04 Profile — view/update personal information `[BE][FE]` — done 2026-06-12
- [x] Cookie-based session wired to UI (login + Google + /me, FE no longer handles tokens) `[BE][FE]` — done 2026-06-18
- [x] Google sign-in (first login → complete-profile: fullName/phone/dateOfBirth; random hashed password) `[BE][FE]` — done 2026-06-18
- [x] Forgot password flow (forgot-password → verify-otp → reset-password) `[BE][FE]` — done 2026-06-18

## 2. Brand Profile
- [x] FR-05 Create brand profile (name, industry, description, voice, audience, keywords, do/don't, platforms) `[BE][FE]` — done 2026-06-13 (posting frequency & time slots moved to Content Strategy 2026-06-26)
- [x] FR-06 Update / FR-07 View / FR-08 Delete `[BE][FE]` — done 2026-06-13; FR-08 xóa hồ sơ dọn luôn file logo trong Supabase Storage (afterCommit, bỏ qua placeholder/URL ngoài, log rõ) 2026-07-03; FR-07 list phân trang server-side (`PageResponse` + q/industry filter + `strategyCount` + endpoint `/industries`) 2026-07-03; toàn bộ I/O Supabase (upload/sign/xóa logo) chuyển ra NGOÀI transaction DB (`TransactionTemplate`, rule #24) 2026-07-03
- [x] FR-09 Validation (required fields, ≥1 platform, valid frequency) `[BE]` — done 2026-06-13

## 3. Content Strategy
- [x] FR-10 Create strategy (goals, content types, frequency, platforms, slots, audience, style, CTA) `[BE][FE]` — done 2026-06-26 (goals/types/styles/ctas = free-text List<String>, combobox chọn+tự nhập; FE nối API thật)
- [x] FR-11 Update / FR-12 List `[BE][FE]` — done 2026-06-26 (list ±brandId; CRUD theo pattern BrandProfile); list phân trang server-side (`PageResponse` + brandId/status/q filter, 4/trang mặc định) 2026-07-03
- [x] FR-13 Activate/Pause (paused → no new content, no auto-scheduling) `[BE]` — done 2026-06-26 (PATCH /content-strategies/{id}/status)

## 4. Social Media Connection
- [x] FR-14 OAuth connect — Facebook `[BE][FE]` — done 2026-06-27 (Meta OAuth dialog, AES-256 token encryption, page token exchange); avatar fetched at connect via `getMe?fields=...,picture` and stored as stable `{graph}/{id}/picture?type=large` URL (null on `is_silhouette`) — done 2026-06-28
- [x] FR-14 OAuth connect — Instagram `[BE][FE]` — done 2026-06-27 (FB Page → IG Business Account discovery & linking)
- [x] FR-14 OAuth connect — Threads `[BE][FE]` — done 2026-06-27 (Threads OAuth dialog & long-lived user token exchange)
- [x] FR-15 List connected accounts (platform, account, status, dates, token status) `[BE][FE]` — done 2026-06-27 (PlatformConnectionController & Settings.tsx UI)
- [x] FR-16 Disconnect `[BE][FE]` — done 2026-06-27 (Revoke token & soft delete connection)
- [x] FR-17 Connection check before posting `[BE]` — done 2026-06-27 (TokenValidationJob & validateConnection endpoint)
- [x] FR-18a Auto token refresh (< 24h remaining) `[BE]` — done 2026-06-27 (TokenHealthCheckJob & refreshConnection endpoint)
- [x] FR-18b Expired token → account `Expired`, scheduled posts → `On Hold` `[BE]` — done 2026-06-27 (TokenHealthCheckJob safe status migration); phần "scheduled posts → On Hold" hoàn tất 2026-07-05 khi có PostSchedule (job + luồng đăng mã 190 đều chuyển lịch sang ON_HOLD, kèm notification RECONNECT_NEEDED)

## 5. Trend Research (Agent AI)
- [x] FR-19 Scheduled research (2:00 AM daily) + "Research now" button; requires active Brand Profile & Strategy; no overlapping sessions `[BE][AI][FE]` — AI analysis (`POST /research`) done 2026-06-13; BE "Research now" + session guard (async worker, `POST /trend-research/sessions`) + FE nút Research ngay (modal chọn hồ sơ thương hiệu + nền tảng → poll; cảnh báo khi thiếu hồ sơ / chiến lược ACTIVE) done 2026-07-02; hồ sơ thương hiệu đầu tiên của user tự động `isActive` (BE); BE 2:00 AM scheduler (`DailyTrendResearchJob`: quét hồ sơ `isActive` có chiến lược ACTIVE, bỏ qua user đang có phiên PENDING/RUNNING, dispatch cùng worker nền) done 2026-07-03
- [x] FR-20 Filter trends by industry `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-21 Relevance rating (High / Medium / Low) `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-22 Create content ideas from trends `[AI]` — done 2026-06-13 (AI svc)
- [x] Cross-platform trend signal (YouTube / TikTok / Instagram Reels) via Trends-MCP integration `[AI]` — done 2026-07-02 (connector `ai/src/platform/trends_mcp.py`, wired into `POST /research`; research data source only, publishing scope unchanged)
- [x] FR-23 Save research sessions `[BE]` — done 2026-07-02 (`TrendResearchSession` + `Trend` + `ContentIdea` persisted; API `GET /trend-research/sessions[/{id}]`)

## 6. Content Generation (Agent AI)
- [x] FR-24 Generate from brand profile + strategy + trend + idea + platform `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-25 Video script (hook, main content, shot suggestions, CTA) `[AI]` — done 2026-06-13 (AI svc); nâng cấp 2026-07-10: script CÓ CẤU TRÚC xuyên suốt (AI `VideoScript{hook, steps[], cta}` — hook/CTA có timing, mỗi phần tách riêng nội dung + gợi ý cảnh quay; BE lưu chuỗi JSON vào cột text `script` thay vì làm phẳng dạng dòng, DTO API là object `VideoScriptDto`, bài cũ parse fallback tự "lành" khi PUT; FE bỏ splitScript đoán dòng)
- [x] FR-26 Caption / FR-27 Hashtags / FR-28 CTA `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-29 Media prompt (text only — no media generation in MVP) `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-30 Brand voice check `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-31 Save drafts (`Draft`/`Generated`) `[BE]` — done 2026-07-01 (`ContentGenerationWorker` persists a `ContentItem` with status `GENERATED` after each AI call)
- [x] FR-32 Regenerate / FR-33 Manual edit / FR-34 Review before posting `[BE][FE]` — FR-32 regenerate done end-to-end 2026-07-01 (Create.tsx → `POST /content-items/generate` with `regenerateFrom` → AI `/generate`); FR-33/FR-34 done 2026-07-03: BE `ContentItemController` (`GET/PUT /content-items/{id}`, `PATCH /{id}/status`), thêm `NEED_REVIEW`/`APPROVED` vào `ContentLifecycle` theo state machine, sửa nội dung APPROVED tự quay về NEED_REVIEW; FE Create.tsx panel preview có nút Chỉnh sửa (script/caption/hashtag/media prompt) + badge trạng thái + nút Gửi duyệt → Phê duyệt; nâng cấp 2026-07-10: màn Xem chi tiết tái cấu trúc 3 sub-tab (Script video / Nội dung gộp caption+hashtag+CTA / Media prompt kèm copy), sửa tại chỗ từng tab (PUT version), đổi trạng thái theo state machine ngay trên panel (Gửi duyệt / Duyệt / Trả về sửa — BE thêm transition NEED_REVIEW→GENERATED), skeleton chi tiết bám đúng layout thay spinner; nâng cấp 2026-07-11 (FR-32): TẠO LẠI TỪNG PHẦN kịch bản `[BE][AI][FE]` — chọn phần (Mở đầu/Nội dung chính/Kết bài) × nhánh (nội dung nói / gợi ý cảnh quay), chỉ phần được chọn đổi, phần khác giữ nguyên; AI agent `content_regenerator` (`POST /regenerate-part`), BE job async (`POST /content-items/{itemId}/versions/{versionId}/regenerate-part` → poll `GET /content-items/regen-jobs/{jobId}`, entity `ContentRegenerationJob`, worker patch in-place; item phải DRAFT/GENERATED/NEED_REVIEW/APPROVED), FE nút tạo lại từng phần trong `ScriptSections` (`useScriptRegen` poll + merge patch)

## 7. Policy Violation Handling (no custom filter — SEC-06)
- [x] FR-35 Handle platform 400/403 policy errors: `Failed`, no retry, store original code + message, notify `[BE]` — done 2026-07-05 (`PublishException` giữ code/message gốc → `PublishResult` + `PostingJob.errorType`, POLICY_VIOLATION không retry — BR-07; notify qua `NotificationService` POST_FAILED)
- [x] FR-36 Move violating post to `Failed` + store error `[BE]` — done 2026-07-05 (worker `saveFailure`: post/schedule/version/item → FAILED, lỗi lưu ở `PublishResult` + job)
- [x] FR-37 Classify policy violations vs technical errors `[BE]` — done 2026-07-05 (`MetaApiClientImpl.classifyPublishError`: policy 368/message "policy" > tạm thời 5xx/rate-limit 1,2,4,17,32,341,613 > còn lại vĩnh viễn; enum `PublishErrorType`)
- [x] FR-38 Violation notification (platform, reason, next steps) `[BE][FE]` — BE done 2026-07-05 (notification POST_FAILED riêng cho vi phạm: nền tảng + mã/lý do gốc + bước tiếp theo); FE done 2026-07-11 (hiển thị qua `NotificationBell` — title/message đầy đủ, click điều hướng tới lịch đăng)
- [x] FR-39 Edit/regenerate then reschedule `[BE][FE]` — một phần 2026-07-05: regenerate (FR-32/FR-88) + hủy lịch FAILED → version về FORMATTED → lên lịch lại đã có; done 2026-07-11: BE `EDITABLE_STATUSES` thêm FAILED (sửa bài/bản FAILED được), FE trang Lịch (UI-07) — lịch FAILED có nút Sửa nội dung + Hủy lịch để đăng lại, modal lên lịch mới nhặt lại bản FORMATTED

## 8. Platform Formatting
- [x] FR-40 Create one version per selected platform `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-44 Facebook formatting (longer caption, clear CTA, image/video/link) `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-42 Instagram formatting (vertical/square media, emotive caption, brand hashtags) `[AI]` — done 2026-06-13 (AI svc)
- [x] Threads formatting (short, conversational; per Threads API) `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-46 Save each formatted `ContentVersion` `[BE]` — done 2026-07-03: async job (`POST /content-items/{id}/format` + poll `GET /content-items/format-jobs/{id}`) gọi AI `/format`, lưu một `ContentVersion`/nền tảng (status FORMATTED), format lại xóa mềm bản cũ cùng nền tảng, item → FORMATTED; chỉ format item GENERATED/APPROVED; AI `FormatRequest.content` đổi sang shape BE lưu trữ (`FormatContentInput`, script phẳng)

*(FR-41 TikTok, FR-43 YouTube Shorts, FR-45 LinkedIn — out of current scope, do not implement yet.)*

## 9. Scheduling
- [x] FR-47 Create schedule (content, platform, date, time, status) `[BE][FE]` — BE done 2026-07-05 (`POST /schedules`: ContentVersion FORMATTED + PlatformAccount ACTIVE cùng nền tảng (BR-05), giờ đăng phải ở tương lai, version/item → SCHEDULED; lịch CANCELLED được tái sử dụng khi lên lịch lại — cột content_version_id unique 1-1); FE done 2026-07-11 (UI-07: modal "Lên lịch đăng" — chọn bản FORMATTED (flatten từ thư viện) → tài khoản ACTIVE cùng nền tảng → datetime-local, kèm chip khung giờ vàng FR-48 áp giờ một chạm)
- [x] FR-48 Golden hour suggestions (platform defaults → data-driven after ≥10 analyzed posts) `[BE][AI]` — AI endpoint (`POST /golden-hours`, defaults + data-driven) done 2026-06-13; BE integration done 2026-07-05 (`GET /schedules/golden-hours?platform=` → `AiServiceClient.goldenHours`; chưa gửi analytics — bổ sung `posts` khi FR-59 xong để bật nhánh data-driven)
- [x] FR-49 Posting queue `[BE]` — done 2026-07-05 (`GET /schedules` sắp theo scheduledTime, filter status/platform; `status=SCHEDULED` = hàng đợi sắp đăng)
- [x] FR-50 Update schedule / FR-51 Cancel schedule (unpublished only) `[BE][FE]` — BE done 2026-07-05 (PUT dời giờ khi SCHEDULED/ON_HOLD; DELETE hủy khi SCHEDULED/ON_HOLD/FAILED → CANCELLED, version về FORMATTED, item về FORMATTED nếu không còn bản nào trong pipeline); FE done 2026-07-11 (UI-07: nút Dời giờ (modal), Hủy lịch xác nhận 2 lần bấm; ON_HOLD có nút Kích hoạt lại, FAILED có "Hủy lịch để đăng lại")

## 10. Auto-Posting
- [x] FR-52 Post on time (scheduler) `[BE]` — done 2026-07-05 (`PostingDispatchJob` quét mỗi phút: lịch đến hạn → Post + PostingJob → worker nền `postPublishExecutor`; kèm chạy retry đến hạn + vớt job PENDING mất dispatch)
- [x] FR-53 Call platform API / FR-54 receive result `[BE]` — done 2026-07-05 (adapter `PlatformPublisher` (NFR-09): Facebook Page `POST /{page-id}/feed` + Threads container TEXT→publish qua `MetaApiClient`; Instagram trả lỗi vĩnh viễn rõ ràng — cần media, MVP chỉ có media prompt FR-29; kết quả lưu `Post.platformPostId` + `PublishResult`)
- [x] FR-55 Persist post status (state machine in WORKFLOWS.md) `[BE]` — done 2026-07-05 (Scheduled → Posting → Posted/Failed đồng bộ trên PostSchedule + Post + ContentVersion + ContentItem; retry giữ Posting, thất bại chung cuộc → Failed)
- [x] FR-56 Retry policy (3 attempts at 5/15/30 min, temporary errors only) `[BE]` — done 2026-07-05 (chỉ TEMPORARY; job RETRYING với `nextRetryAt` 5/15/30 phút, tối đa 3 lần; POLICY_VIOLATION/PERMANENT dừng ngay — BR-07)
- [x] FR-57 Failure notification / FR-58 user resolution (edit/reconnect/repost) `[BE][FE]` — FR-57 BE done 2026-07-05 (POST_FAILED khi thất bại chung cuộc, RECONNECT_NEEDED khi token hết hạn), FE done 2026-07-11 (`NotificationBell`); FR-58 done 2026-07-11: BE đủ 3 hướng (SỬA — item FAILED sửa được theo FR-39; KẾT NỐI LẠI — PUT lịch ON_HOLD khi account ACTIVE lại → SCHEDULED; ĐĂNG LẠI — hủy lịch FAILED → version về FORMATTED → lên lịch lại), FE trang Lịch có hint + nút cho từng hướng

## 11. Performance Analysis
- [x] FR-59 Collect metrics (views, likes, comments, shares, saves, CTR, conversion, watch time) at 24h/48h/7d `[BE]` — done 2026-07-05 (`AnalyticsCollectionJob` mỗi giờ, mốc 24/48/168h mỗi bài thu một lần; FB: likes/comments/shares qua fields + views qua insights best-effort (cần read_insights); Threads: views/likes/replies + reposts+quotes→shares; CTR/conversion/watch time = null trong MVP — nền tảng không cung cấp cho bài text; version/item POSTED → ANALYZING khi có số liệu đầu tiên)
- [x] FR-60 Store in DB / FR-61 display to user / FR-62 compare posts `[BE][FE]` — BE done 2026-07-05 (`PostAnalytics` + cột `milestone_hours`; API `GET /analytics/posts` phân trang + `GET /analytics/posts/{id}`, mỗi bài kèm đủ snapshot các mốc để so sánh); FE done 2026-07-11 (UI-08)
- [x] FR-63 Success factor analysis (hook, caption, hashtags, CTA, media, timing, platform) `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-64 Produce optimization insights `[AI]` — done 2026-06-13 (AI svc)

## 12. Strategy Optimization
- [x] FR-65 Propose strategy adjustments from data `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-66 Propose improvements for future posts `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-67 Store adjustment history `[BE]` — done 2026-07-11 (job async `StrategyOptimizationJob`: `POST /content-strategies/{id}/optimize` → worker gom analytics bài POSTED của brand (snapshot mốc muộn nhất, tối đa 50 bài) → AI `/analyze` rồi `/optimize` → lưu `OptimizationInsight` (neo snapshot mới nhất — schema DATA_MODEL buộc FK analytics) + `StrategyAdjustment` PENDING (thêm cột `rationale`/`decided_at`); lịch sử đọc qua `GET /content-strategies/{id}/adjustments`; future improvements lưu trên job; notification NEW_INSIGHT khi xong)
- [x] FR-68 User accepts/rejects proposals `[BE][FE]` — done 2026-07-11 (BE `PATCH /content-strategies/adjustments/{id}` APPLIED/REJECTED — chỉ từ PENDING, ghi `decidedAt`; APPLIED = user đồng ý và tự cập nhật chiến lược theo gợi ý; FE mục "Tối ưu từ dữ liệu" trong chi tiết chiến lược (`StrategyOptimization.tsx`): nút Chạy tối ưu → poll job, card đề xuất kèm rationale + insight, nút Chấp nhận/Từ chối, lịch sử gấp gọn, hiển thị cải tiến tương lai; lỗi 1961 khi chưa có bài thu analytics)

## 13. Error Management
- [x] FR-69 Unconnected account → block posting + notify `[BE]` — done 2026-07-05 (tạo lịch yêu cầu account ACTIVE — `CONNECTION_NOT_ACTIVE`, BR-05; thất bại lúc đăng → notification POST_FAILED)
- [x] FR-70 Expired token handling (align with FR-18b: `On Hold` + reconnect prompt) `[BE]` — done 2026-07-05 (mã 190 khi đăng HOẶC `TokenHealthCheckJob` hết hạn → account EXPIRED + lịch SCHEDULED → ON_HOLD + notification RECONNECT_NEEDED; PUT lịch ON_HOLD khi account ACTIVE lại → về SCHEDULED)
- [x] FR-71 Invalid media format → notify + suggest fix `[BE]` — done 2026-07-11 (worker đăng bài: lỗi `IG_MEDIA_REQUIRED` → notification POST_FAILED riêng, gợi ý dùng media prompt tự tạo ảnh/video đăng thủ công hoặc lên lịch cho Facebook/Threads)
- [x] FR-72 Platform API error → log + retry where appropriate `[BE]` — done 2026-07-05 (mọi lỗi đăng bài được log + lưu `PublishResult`; retry chỉ cho lỗi tạm thời theo FR-56; các call Meta khác log qua `MetaApiClient`)
- [x] FR-73 Restricted account → stop posting + notify `[BE]` — done 2026-07-11 (mã Graph 368 / message "restricted|checkpoint|locked|disabled" khi đăng → account `ERROR`, mọi lịch SCHEDULED của account → ON_HOLD, notification RECONNECT_NEEDED hướng dẫn xử lý trên nền tảng rồi xác thực lại)
- [x] FR-74 System error logging `[BE]` — done 2026-07-11 (entity `SystemLog` (level/module/message/detail) + `SystemLogService` best-effort REQUIRES_NEW; ghi từ catch-all 500 `GlobalExceptionHandler`, thất bại đăng bài chung cuộc, mọi lỗi gọi AI service (`AiServiceClientImpl` gộp về helper `post`); là nguồn dữ liệu cho trang Logs admin FR-84)

## 14. Notifications
- [x] FR-75 Post published / FR-76 post failed `[BE][FE]` — BE done 2026-07-05 (entity `Notification` + `NotificationService.notify` best-effort; API `/notifications` list phân trang + unread-count + đánh dấu đã đọc; phát từ worker đăng bài); FE done 2026-07-11 (`NotificationBell` trên Topbar: badge số chưa đọc poll 60s, dropdown danh sách phân trang + icon/màu theo loại + thời gian tương đối, click = đánh dấu đã đọc (optimistic) + điều hướng theo loại, nút Đọc tất cả)
- [x] FR-77 Review needed / FR-78 reconnection needed / FR-79 new insight `[BE][FE]` — FR-77 BE done 2026-07-05 (phát khi AI tạo nội dung xong); FR-78 BE done 2026-07-05 (phát từ luồng đăng bài mã 190 + `TokenHealthCheckJob`); FE done 2026-07-11 (cùng `NotificationBell`); FR-79 BE done 2026-07-11 (NEW_INSIGHT phát từ worker tối ưu chiến lược khi có đề xuất mới — FR-65..FR-68)

## 15. Admin
- [ ] FR-80 Manage users `[BE][FE]` — FE UI done 2026-06-23 (list + search/filter/pagination, lock/unlock, detail; mock via `api/admin.ts`, BE endpoint pending)
- [ ] FR-81 System status `[BE][FE]` — FE UI done 2026-06-23 (service cards, 24h load chart, alerts; mock, BE pending)
- [ ] FR-82 Rejected content / FR-83 posting errors / FR-84 system logs `[BE][FE]` — FE UI done 2026-06-23 (Posts page rejected/system tabs + error modal; Logs page level/date filter + detail; mock, BE pending)
- [x] Admin extras: Platform API versions connected to real BE API `[BE][FE]` — done 2026-06-27 (PlatformVersionAdminController + ApiVersions.tsx with manual cache eviction, check-now job, history modal, version update); Revenue (period filter, chart, transactions, plan pricing config, export TXT/Excel; PDF stub TODO).
- [ ] Admin UX (FE) done 2026-06-24: Administration split into its own interface (separate `AppShell variant="admin"` + admin sidebar) reached via an admin-only "Quản trị hệ thống" portal button in the app sidebar; role-guarded `/admin/*` (ProtectedRoute → AdminRoute). Sidebar body is vertically scrollable (`.sb-scroll`) on short viewports so items don't get squished.

## 16. Onboarding
- [ ] FR-85 Onboarding wizard (Brand Profile → connect ≥1 account → first Strategy → tour) `[FE][BE]`
- [ ] FR-86 Setup progress bar on dashboard `[FE]`

## 17. Content Library
- [x] FR-87 View/filter/search all ContentItems `[BE][FE]` — BE done 2026-07-05 (`GET /content-items` phân trang, lọc status/platform (theo version đã định dạng)/industry/khoảng ngày + tìm từ khóa trong caption/script); mở rộng 2026-07-08: thêm filter `brandProfileId` + trả `brandProfileId` trong response + sort server-side `newest`/`voice` (điểm brand-voice cao nhất)/`status`; FE done 2026-07-08 (danh sách 1 card/bài mô hình B2, tab theo version thật ở panel Xem, xóa với thông báo chặn FR-89 rõ ràng, dọn bài DRAFT mồ côi khi rời wizard/đổi nguồn mà chưa lưu); 2026-07-10: bỏ dọn orphan khi rời wizard — thay bằng AUTO-SAVE trạng thái wizard xuống DB (cột `wizard_step/wizard_platforms/wizard_note/trend_id` trên `content_items`, `PATCH /content-items/{id}/wizard-state`, debounce ~1s, dọn null khi bài rời DRAFT), card DRAFT hiện "Dừng ở: {bước}" + nút Tiếp tục resume ĐÚNG bước (bước ≥3 nạp lại versions đã sinh, tự xác nhận nguồn); 2026-07-11: UI quản lý nội dung làm lại — danh sách thêm dạng bảng (`ContentTable`, chuyển đổi card/bảng), bộ lọc chuyển vào drawer riêng (`ContentFilterDrawer`), panel Xem chi tiết tách component (`ScriptSections` thay `ScriptBlock`/`ScriptEditor`, `SourceInfoCard` thay `SourceContextChip`)
- [x] FR-88 Reuse (regenerate creates a new item) `[BE][AI]` — AI supports it (`regenerate_from` on `POST /generate`) 2026-06-13; BE new-item creation done 2026-07-01 (`ContentGenerationWorker` always creates a fresh `ContentItem` per job, including regenerate)
- [x] FR-89 Delete rules (`Draft`/`Generated` only; cascades to ContentVersions) `[BE]` — done 2026-07-05 (`DELETE /content-items/{id}`: chỉ DRAFT/GENERATED (`CONTENT_ITEM_NOT_DELETABLE`), xóa mềm item + cascade ContentVersions + MediaAssets)

## UI Pages (UI_API.md)
- [x] UI-01 Landing Page `[FE]` — done 2026-07-03: thêm section Bảng giá `#pricing` (3 gói Free/Pro 499k/Business 1.99M đồng bộ cấu hình admin, card Pro nổi bật nền tím đậm, CTA → đăng ký), band CTA cuối trang, footer newsletter hoạt động (validate email + trạng thái đã đăng ký), nav Pricing trỏ section thật + scroll-spy, reveal khi cuộn (anime.js, tôn trọng reduced-motion)
- [ ] UI-02 Dashboard `[FE]`
- [x] UI-03 Brand Profile page `[FE]` — done 2026-06-25 (list-first: card list + search/industry filter + "đang dùng" active select + slide-over create/edit + read-only "AI đã hiểu" panel + AI Brand Health; uses real /brand-profiles API); nâng cấp 2026-07-03: responsive 4 mốc màn hình (grid 1/2/3 cột, panel AI stack <1024), phân trang server-side 6 card/trang, bỏ icon con mắt trùng nút Xem, lightbox phóng to logo ở màn Xem, skeleton loading thay spinner, ô tìm kiếm có dropdown gợi ý tên hồ sơ — chỉ tìm khi Enter/chọn gợi ý
- [x] UI-04 Content Strategy page `[FE]` — done 2026-06-25 (list-left + detail 01–08 + summary + DRAFT/ACTIVE/PAUSED toggle, gộp vào /brand 2 tab); nối BE thật `api/contentStrategy.ts` 2026-06-26; nâng cấp 2026-07-03: drawer danh sách cho mobile+tablet (<1024), phân trang server-side 4 item/trang, skeleton loading, ô tìm kiếm có dropdown gợi ý tên chiến lược — chỉ tìm khi Enter/chọn gợi ý
- [x] UI-05 Trend Research page `[FE]` — done 2026-07-02 (redesign 3 sub-tab: Trend nổi bật (bảng + sparkline + filter) / Ý tưởng content / Lịch sử research, sidebar phải trạng thái + lịch tự động, section "Cách hoạt động"; mock data ở `src/trendsData.ts`, chờ nối BE); tối ưu 2026-07-02: sidebar theo tab + sticky, bảng→card <1024px, phân trang 3 danh sách, responsive 4 mốc màn hình; nối BE 2026-07-02 (`api/trendResearch.ts` + map `trendsLive.ts`, nút Research ngay poll phiên async; mock chỉ còn là fallback khi BE chưa chạy)
- [x] UI-06 Content Workspace `[FE]` — done 2026-07-01 (Create.tsx wired to real generation: strategy picker + `api/contentGeneration.ts` + job polling, replacing mock data)
- [x] UI-07 Calendar / Schedule `[FE]` — done 2026-07-11 (Calendar.tsx nối API thật `/schedules` qua `api/schedules.ts`: lịch tháng điều hướng ‹› với dot màu theo nền tảng + click ngày lọc; hàng đợi filter theo trạng thái (chip màu theo `statusTokens`) với hành động theo state machine — Dời giờ/Hủy (SCHEDULED), Kích hoạt lại (ON_HOLD), Sửa nội dung + Hủy để đăng lại (FAILED); modal Lên lịch đăng kèm khung giờ vàng FR-48)
- [x] UI-08 Analytics page `[FE]` — done 2026-07-11 (Analytics.tsx nối API thật `/analytics/posts` qua `api/analytics.ts`: 4 thẻ tổng views/likes/comments/shares theo mốc mới nhất, bảng bài đã đăng phân trang server-side, mở rộng từng dòng = bảng so sánh mốc 24h/48h/7 ngày kèm chênh lệch (FR-62); empty state giải thích số liệu thu sau 24h; metric nền tảng không cung cấp hiện "—")
- [x] UI-09 Social Account page `[FE]` — done 2026-06-27, ghi nhận 2026-07-11: sống trong Settings.tsx (không cần trang riêng) — kết nối qua OAuth dialog (`getAuthorizationUrl` → redirect), danh sách kết nối + stats, kiểm tra (validate), làm mới token (refresh), ngắt kết nối (disconnect)
- [x] UI-10 Admin Dashboard `[FE]` — done 2026-06-23 (separated into a role-guarded System Administration module: Overview + Users + Failed/Rejected posts + System status + Logs + Platform API versions + Revenue)

## Cross-Cutting / Infrastructure
- [ ] Database schema per DATA_MODEL.md (soft delete `deleted_at` everywhere) `[BE]`
- [x] Unified API response format + auth on all user-data APIs (API-01, API-02) `[BE]` — done 2026-06-12
- [ ] Authorization: users see only their own data; admin roles (API-03, SEC-04, SEC-05) `[BE]`
- [x] Input validation + clear error responses (API-04, API-05) `[BE]` — done 2026-06-12
- [x] Password hashing (SEC-01) + JWT protection (SEC-02) `[BE]` — done 2026-06-12
- [ ] AES-256 token encryption, never exposed to frontend (SEC-03) `[BE]`
- [x] Async background jobs for all AI/posting tasks (NFR-04) `[BE][AI]` — content generation done 2026-07-01 (`ContentGenerationJob` + `@Async` worker + FE polling); trend research done 2026-07-02; platform formatting done 2026-07-03 (`ContentFormattingJob` + worker); auto-posting done 2026-07-05 (`PostPublishWorkerService` + `postPublishExecutor`); analysis/optimization done 2026-07-11 (`StrategyOptimizationJob` + `strategyOptimizationExecutor`; thu metric chạy nền qua scheduler `AnalyticsCollectionJob` từ 2026-07-05)
- [x] Scheduler (posting calendar trigger + 2:00 AM research run) `[BE]` — 2:00 AM research run done 2026-07-03 (`DailyTrendResearchJob`); posting calendar trigger done 2026-07-05 (`PostingDispatchJob` mỗi phút)
- [ ] Platform adapter/interface layer for future platforms (NFR-09) `[BE]` — publishing adapter done 2026-07-05 (`PlatformPublisher` + bean/nền tảng, worker chọn theo platform — thêm nền tảng = thêm bean); tầng kết nối OAuth vẫn Meta-specific (`MetaOAuthService`)
- [ ] Webhook endpoints for post-publication violation notifications `[BE]`
- [ ] Logging for AI errors, posting, platform API calls (NFR-11) `[BE][AI]` — 2026-07-11: lỗi AI service + lỗi đăng bài chung cuộc lưu DB (`SystemLog`, FR-74); platform API calls đã log console qua `MetaApiClient`; còn thiếu: log phía AI service (Python)
- [ ] AI transparency markers in UI (AI-generated / needs review / auto-posted) `[FE]`
