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
- [x] FR-06 Update / FR-07 View / FR-08 Delete `[BE][FE]` — done 2026-06-13
- [x] FR-09 Validation (required fields, ≥1 platform, valid frequency) `[BE]` — done 2026-06-13

## 3. Content Strategy
- [x] FR-10 Create strategy (goals, content types, frequency, platforms, slots, audience, style, CTA) `[BE][FE]` — done 2026-06-26 (goals/types/styles/ctas = free-text List<String>, combobox chọn+tự nhập; FE nối API thật)
- [x] FR-11 Update / FR-12 List `[BE][FE]` — done 2026-06-26 (list ±brandId; CRUD theo pattern BrandProfile)
- [x] FR-13 Activate/Pause (paused → no new content, no auto-scheduling) `[BE]` — done 2026-06-26 (PATCH /content-strategies/{id}/status)

## 4. Social Media Connection
- [x] FR-14 OAuth connect — Facebook `[BE][FE]` — done 2026-06-27 (Meta OAuth dialog, AES-256 token encryption, page token exchange); avatar fetched at connect via `getMe?fields=...,picture` and stored as stable `{graph}/{id}/picture?type=large` URL (null on `is_silhouette`) — done 2026-06-28
- [x] FR-14 OAuth connect — Instagram `[BE][FE]` — done 2026-06-27 (FB Page → IG Business Account discovery & linking)
- [x] FR-14 OAuth connect — Threads `[BE][FE]` — done 2026-06-27 (Threads OAuth dialog & long-lived user token exchange)
- [x] FR-15 List connected accounts (platform, account, status, dates, token status) `[BE][FE]` — done 2026-06-27 (PlatformConnectionController & Settings.tsx UI)
- [x] FR-16 Disconnect `[BE][FE]` — done 2026-06-27 (Revoke token & soft delete connection)
- [x] FR-17 Connection check before posting `[BE]` — done 2026-06-27 (TokenValidationJob & validateConnection endpoint)
- [x] FR-18a Auto token refresh (< 24h remaining) `[BE]` — done 2026-06-27 (TokenHealthCheckJob & refreshConnection endpoint)
- [x] FR-18b Expired token → account `Expired`, scheduled posts → `On Hold` `[BE]` — done 2026-06-27 (TokenHealthCheckJob safe status migration)

## 5. Trend Research (Agent AI)
- [ ] FR-19 Scheduled research (2:00 AM daily) + "Research now" button; requires active Brand Profile & Strategy; no overlapping sessions `[BE][AI][FE]` — AI analysis (`POST /research`) done 2026-06-13; BE "Research now" + session guard (async worker, `POST /trend-research/sessions`) + FE nút Research ngay (modal chọn hồ sơ thương hiệu + nền tảng → poll; cảnh báo khi thiếu hồ sơ / chiến lược ACTIVE) done 2026-07-02; hồ sơ thương hiệu đầu tiên của user tự động `isActive` (BE); BE 2:00 AM scheduler pending
- [x] FR-20 Filter trends by industry `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-21 Relevance rating (High / Medium / Low) `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-22 Create content ideas from trends `[AI]` — done 2026-06-13 (AI svc)
- [x] Cross-platform trend signal (YouTube / TikTok / Instagram Reels) via Trends-MCP integration `[AI]` — done 2026-07-02 (connector `ai/src/platform/trends_mcp.py`, wired into `POST /research`; research data source only, publishing scope unchanged)
- [x] FR-23 Save research sessions `[BE]` — done 2026-07-02 (`TrendResearchSession` + `Trend` + `ContentIdea` persisted; API `GET /trend-research/sessions[/{id}]`)

## 6. Content Generation (Agent AI)
- [x] FR-24 Generate from brand profile + strategy + trend + idea + platform `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-25 Video script (hook, main content, shot suggestions, CTA) `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-26 Caption / FR-27 Hashtags / FR-28 CTA `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-29 Media prompt (text only — no media generation in MVP) `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-30 Brand voice check `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-31 Save drafts (`Draft`/`Generated`) `[BE]` — done 2026-07-01 (`ContentGenerationWorker` persists a `ContentItem` with status `GENERATED` after each AI call)
- [ ] FR-32 Regenerate / FR-33 Manual edit / FR-34 Review before posting `[BE][FE]` — FR-32 regenerate done end-to-end 2026-07-01 (Create.tsx → `POST /content-items/generate` with `regenerateFrom` → AI `/generate`); FR-33/FR-34 pending

## 7. Policy Violation Handling (no custom filter — SEC-06)
- [ ] FR-35 Handle platform 400/403 policy errors: `Failed`, no retry, store original code + message, notify `[BE]`
- [ ] FR-36 Move violating post to `Failed` + store error `[BE]`
- [ ] FR-37 Classify policy violations vs technical errors `[BE]`
- [ ] FR-38 Violation notification (platform, reason, next steps) `[BE][FE]`
- [ ] FR-39 Edit/regenerate then reschedule `[BE][FE]`

## 8. Platform Formatting
- [x] FR-40 Create one version per selected platform `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-44 Facebook formatting (longer caption, clear CTA, image/video/link) `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-42 Instagram formatting (vertical/square media, emotive caption, brand hashtags) `[AI]` — done 2026-06-13 (AI svc)
- [x] Threads formatting (short, conversational; per Threads API) `[AI]` — done 2026-06-13 (AI svc)
- [ ] FR-46 Save each formatted `ContentVersion` `[BE]`

*(FR-41 TikTok, FR-43 YouTube Shorts, FR-45 LinkedIn — out of current scope, do not implement yet.)*

## 9. Scheduling
- [ ] FR-47 Create schedule (content, platform, date, time, status) `[BE][FE]`
- [ ] FR-48 Golden hour suggestions (platform defaults → data-driven after ≥10 analyzed posts) `[BE][AI]` — AI endpoint (`POST /golden-hours`, defaults + data-driven) done 2026-06-13; BE scheduling integration pending
- [ ] FR-49 Posting queue `[BE]`
- [ ] FR-50 Update schedule / FR-51 Cancel schedule (unpublished only) `[BE][FE]`

## 10. Auto-Posting
- [ ] FR-52 Post on time (scheduler) `[BE]`
- [ ] FR-53 Call platform API / FR-54 receive result `[BE]`
- [ ] FR-55 Persist post status (state machine in WORKFLOWS.md) `[BE]`
- [ ] FR-56 Retry policy (3 attempts at 5/15/30 min, temporary errors only) `[BE]`
- [ ] FR-57 Failure notification / FR-58 user resolution (edit/reconnect/repost) `[BE][FE]`

## 11. Performance Analysis
- [ ] FR-59 Collect metrics (views, likes, comments, shares, saves, CTR, conversion, watch time) at 24h/48h/7d `[BE]`
- [ ] FR-60 Store in DB / FR-61 display to user / FR-62 compare posts `[BE][FE]`
- [x] FR-63 Success factor analysis (hook, caption, hashtags, CTA, media, timing, platform) `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-64 Produce optimization insights `[AI]` — done 2026-06-13 (AI svc)

## 12. Strategy Optimization
- [x] FR-65 Propose strategy adjustments from data `[AI]` — done 2026-06-13 (AI svc)
- [x] FR-66 Propose improvements for future posts `[AI]` — done 2026-06-13 (AI svc)
- [ ] FR-67 Store adjustment history `[BE]`
- [ ] FR-68 User accepts/rejects proposals `[BE][FE]`

## 13. Error Management
- [ ] FR-69 Unconnected account → block posting + notify `[BE]`
- [ ] FR-70 Expired token handling (align with FR-18b: `On Hold` + reconnect prompt) `[BE]`
- [ ] FR-71 Invalid media format → notify + suggest fix `[BE]`
- [ ] FR-72 Platform API error → log + retry where appropriate `[BE]`
- [ ] FR-73 Restricted account → stop posting + notify `[BE]`
- [ ] FR-74 System error logging `[BE]`

## 14. Notifications
- [ ] FR-75 Post published / FR-76 post failed `[BE][FE]`
- [ ] FR-77 Review needed / FR-78 reconnection needed / FR-79 new insight `[BE][FE]`

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
- [ ] FR-87 View/filter/search all ContentItems `[BE][FE]`
- [x] FR-88 Reuse (regenerate creates a new item) `[BE][AI]` — AI supports it (`regenerate_from` on `POST /generate`) 2026-06-13; BE new-item creation done 2026-07-01 (`ContentGenerationWorker` always creates a fresh `ContentItem` per job, including regenerate)
- [ ] FR-89 Delete rules (`Draft`/`Generated` only; cascades to ContentVersions) `[BE]`

## UI Pages (UI_API.md)
- [ ] UI-01 Landing Page `[FE]`
- [ ] UI-02 Dashboard `[FE]`
- [x] UI-03 Brand Profile page `[FE]` — done 2026-06-25 (list-first: card list + search/industry filter + "đang dùng" active select + slide-over create/edit + read-only "AI đã hiểu" panel + AI Brand Health; uses real /brand-profiles API)
- [x] UI-04 Content Strategy page `[FE]` — done 2026-06-25 (list-left + detail 01–08 + summary + DRAFT/ACTIVE/PAUSED toggle, gộp vào /brand 2 tab); nối BE thật `api/contentStrategy.ts` 2026-06-26
- [x] UI-05 Trend Research page `[FE]` — done 2026-07-02 (redesign 3 sub-tab: Trend nổi bật (bảng + sparkline + filter) / Ý tưởng content / Lịch sử research, sidebar phải trạng thái + lịch tự động, section "Cách hoạt động"; mock data ở `src/trendsData.ts`, chờ nối BE); tối ưu 2026-07-02: sidebar theo tab + sticky, bảng→card <1024px, phân trang 3 danh sách, responsive 4 mốc màn hình; nối BE 2026-07-02 (`api/trendResearch.ts` + map `trendsLive.ts`, nút Research ngay poll phiên async; mock chỉ còn là fallback khi BE chưa chạy)
- [x] UI-06 Content Workspace `[FE]` — done 2026-07-01 (Create.tsx wired to real generation: strategy picker + `api/contentGeneration.ts` + job polling, replacing mock data)
- [ ] UI-07 Calendar / Schedule `[FE]`
- [ ] UI-08 Analytics page `[FE]`
- [ ] UI-09 Social Account page `[FE]`
- [x] UI-10 Admin Dashboard `[FE]` — done 2026-06-23 (separated into a role-guarded System Administration module: Overview + Users + Failed/Rejected posts + System status + Logs + Platform API versions + Revenue)

## Cross-Cutting / Infrastructure
- [ ] Database schema per DATA_MODEL.md (soft delete `deleted_at` everywhere) `[BE]`
- [x] Unified API response format + auth on all user-data APIs (API-01, API-02) `[BE]` — done 2026-06-12
- [ ] Authorization: users see only their own data; admin roles (API-03, SEC-04, SEC-05) `[BE]`
- [x] Input validation + clear error responses (API-04, API-05) `[BE]` — done 2026-06-12
- [x] Password hashing (SEC-01) + JWT protection (SEC-02) `[BE]` — done 2026-06-12
- [ ] AES-256 token encryption, never exposed to frontend (SEC-03) `[BE]`
- [ ] Async background jobs for all AI/posting tasks (NFR-04) `[BE][AI]` — content generation done 2026-07-01 (`ContentGenerationJob` + `@Async` worker + FE polling); research/formatting/analysis/posting still pending
- [ ] Scheduler (posting calendar trigger + 2:00 AM research run) `[BE]`
- [ ] Platform adapter/interface layer for future platforms (NFR-09) `[BE]`
- [ ] Webhook endpoints for post-publication violation notifications `[BE]`
- [ ] Logging for AI errors, posting, platform API calls (NFR-11) `[BE][AI]`
- [ ] AI transparency markers in UI (AI-generated / needs review / auto-posted) `[FE]`
