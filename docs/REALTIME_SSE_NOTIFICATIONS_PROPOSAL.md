# Realtime (SSE) & hệ thống thông báo — Khảo sát và đề xuất

> **Trạng thái:** ĐÃ TRIỂN KHAI Bước 0–6 (code + test, 2026-10-14, chưa commit) — chờ deploy: [`REALTIME_SSE_DEPLOY.md`](REALTIME_SSE_DEPLOY.md). Chi tiết: [`REALTIME_SSE_PROGRESS.md`](REALTIME_SSE_PROGRESS.md).
> **Ngày khảo sát:** 2026-10-14 · nhánh `research_trends` (commit `1da09d4`).
> **Mục tiêu:** (a) chuông thông báo realtime · (b) tiến độ tạo content / đăng bài realtime ·
> (c) AI trả nội dung từng đoạn (streaming) · (d) hoàn thiện thông báo: danh sách, đếm chưa đọc,
> đánh dấu đã đọc, chuông, toast, cài đặt trong `/settings?tab=notifications`.

## ⚠️ Phát hiện quan trọng nhất

**Frontend không có luồng refresh token.** Cookie `access_token` sống 1 giờ
(`backend/.../security/CookieUtils.java:74`, maxAge = `jwt.accessTokenExpiration` = 3600s).
Backend có `POST /auth/refresh` nhưng FE không gọi ở đâu cả; `frontend/src/api/apiClient.ts:46`
gặp 401 chỉ hiện toast. Hệ quả: sau 1 giờ user thực chất đã bị đăng xuất — và kết nối SSE cũng sẽ chết
theo nếu không vá trước (→ Bước 0).

---

# GIAI ĐOẠN 1 — KHẢO SÁT

## 1. Realtime hiện có

### Backend: không có gì realtime
- Không có `SseEmitter`, `ResponseBodyEmitter`, `StreamingResponseBody`, `DeferredResult`,
  WebSocket/STOMP, endpoint trả `Flux`, hay Postgres LISTEN/NOTIFY.
- **Java 21, Spring Boot 4.0.6** (`backend/pom.xml:10,20`), **Spring MVC** trên Tomcat mặc định.
  `spring-boot-starter-webflux` chỉ dùng cho `WebClient`, mọi lời gọi đều `.block()`.
- **Virtual threads: chưa bật.** Không cấu hình `server.tomcat.*`, `spring.mvc.async.request-timeout`.
- `@EnableAsync` (`AimaApplication.java:8`) + 10 `ThreadPoolTaskExecutor` (`config/AsyncConfig.java`):
  contentGeneration 2/5/50, contentFormatting 1/3/20, postPublish 2/5/50, contentRegeneration 2/5/50,
  aiAssist 2/5/100, strategyOptimization 1/2/10, trendResearch 3/3/20, scheduledTrendResearch 2/2/5000,
  activityLog 1/3/500, metaWebhook 1/2/500.
- `@EnableScheduling` gated bởi `app.scheduling.enabled` (`config/SchedulingConfig.java`);
  ShedLock JDBC `usingDbTime()` cho mọi job (`config/SchedulerLockConfig.java`).
- Nén gzip (`application.yml:6-9`) chỉ cho json/html/css/js → `text/event-stream` **không** bị nén (tốt).

### Frontend: toàn polling viết tay (không React Query/SWR)

| Nơi | Endpoint | Chu kỳ |
|---|---|---|
| `components/NotificationBell.tsx:20,44` | `GET /notifications/unread-count` | 60s + khi mở dropdown |
| `api/contentCreationService.ts:458` (generate) | `GET /content-items/jobs/{id}` | 2→3→5s, tối đa 3 phút |
| `api/contentCreationService.ts:508` (format) | `GET /content-items/format-jobs/{id}` | 2s, không giới hạn |
| `api/contentCreationService.ts:545` (regen) | `GET /content-items/regen-jobs/{id}` | 1,5s, không giới hạn |
| `pages/app/Trends.tsx:175` | `GET /trend-research/sessions/{id}` | 4s × 75 lần / nền tảng |
| `components/aiAssist/AiFixModal.tsx`, `PolicyCheckNotice.tsx` | `/me/ai-assist/...` | 1,5–2s |
| `components/brand/StrategyOptimization.tsx` | optimize job | 3s |
| `pages/admin/SystemStatus.tsx`, `pages/admin/Overview.tsx` | `/admin/system…` | 5s/15s/60s (TODO dòng 463: "SSE/WebSocket thay polling") |

Trạng thái đăng bài **không** được poll; Calendar chỉ tải lại một lần sau "Đăng ngay"
(`pages/app/Calendar.tsx:160-172`).

## 2. Xác thực

### Cơ chế hiện tại
- JWT HS512 tự viết (Nimbus, `service/Impl/JwtServiceImpl.java`), trong cookie HttpOnly
  `access_token` (1 giờ) và `refresh_token` (7 ngày). jti refresh + blacklist + `logout_time` trong Redis.
  Không dùng Supabase Auth (Supabase chỉ dùng Storage).
- `security/JwtAuthenticationFilter.java`: đọc **cookie trước**, rồi `Authorization: Bearer`.
  Không có token qua query. Là `OncePerRequestFilter` → bỏ qua async dispatch.
- `security/SecurityConfig.java`: CSRF off, STATELESS, CORS `allowCredentials(true)` với origin patterns.
  Production chỉ cho `https://aima-marketing.id.vn`, `https://*.aima-marketing.id.vn`.
- Google OAuth2 → set cookie → redirect `FRONTEND_CALLBACK_URL`.

### Phía FE
- Trạng thái đăng nhập ở React Context (`auth/AuthContext.tsx`), **không phải Zustand**.
- Axios `withCredentials: true` (`api/apiClient.ts:26-29`); FE không chạm token.
- **Không có refresh flow** (xem phần đầu file).

### Đánh giá cách xác thực SSE
- FE `aima-marketing.id.vn` ↔ API `api.aima-marketing.id.vn`: khác origin nhưng **cùng site**;
  dev `localhost:3000` ↔ `localhost:8082` cũng cùng site → cookie SameSite=Lax vẫn được gửi với request
  có credentials. **Dùng luôn cookie hiện tại là đủ.**
- Token trên URL: loại (lộ trong log). "Ticket" dùng một lần: chỉ cần nếu API chạy khác site
  (vd `*.onrender.com`) — để dự phòng.

## 3. Hạ tầng & deploy

| Thành phần | Hiện trạng |
|---|---|
| FE | **Vercel** (`frontend/vercel.json` chỉ rewrite SPA) |
| BE | **Render** (Docker `backend/Dockerfile`, cổng 10000), domain `api.aima-marketing.id.vn`, context `/api/aima` |
| DB | Supabase Postgres qua pooler Supavisor (`.env` dev cổng 5432 session mode; memory ghi 6543 — **production cần xác nhận**). Hikari **pool = 5** |
| Redis | **Upstash** (prod), Docker (local). Dùng cho token, OTP, oauth state, circuit breaker AI, throttle email. **Không có pub/sub** |
| Broker | Không có (không Kafka/Rabbit/STOMP) |
| AI service | Không có tài liệu nơi deploy; BE gọi qua `AI_SERVICE_BASE_URL` |
| Số instance BE | Không có tài liệu chốt; runbook giả định nhiều instance; sự cố 28/09 nhiều instance chạy job trên cùng DB ⇒ **phải đúng với N instance** |
| Reverse proxy | Không có Nginx; chỉ edge của Render. HTTP/2, Cloudflare, timeout idle: **chưa rõ** |
| Timeout server | Không cấu hình. Chỉ có timeout outbound (AI 100s, research 200s, Meta 5s/30s…) |
| Dev | Vite **không proxy** (`vite.config.ts`), FE gọi thẳng `VITE_API_BASE_URL` qua CORS → không có chuyện proxy buffer SSE |
| Stack cô lập | `backend/isolated/` — PG 55432, Redis 56379, BE 8092, FE 3100, stub 58080 |

## 4. Thông báo hiện tại

### Backend
- Bảng `notifications` (V1; V4 thêm `dedupe_key` + unique partial index + CHECK `type`).
  Cột: user, type, title, message, ref_id, read_at, dedupe_key, created/updated/deleted_at.
- `service/Impl/NotificationServiceImpl.java`: `notify` / `notifyOnce` — best-effort, chạy chung
  transaction của nơi gọi.
- `controller/NotificationController.java`: `GET /notifications?unreadOnly&page&size`,
  `GET /unread-count`, `PATCH /{id}/read`, `PATCH /read-all`.
- **Thiếu:** API xoá; index theo `user_id` (chỉ có unique index `dedupe_key`).
- **Title/message lưu cứng tiếng Việt** (vd `PostPublishWorkerServiceImpl.java:474`
  "Đã đăng bài thành công") → UI tiếng Anh vẫn hiện tiếng Việt.
- Enum `enums/NotificationType.java` đóng, phải đồng bộ với `frontend/src/api/notifications.ts`,
  `components/notificationMeta.ts` và CHECK trong DB.

### Các loại đang có (9) và nơi phát

| Loại | Phát ở đâu |
|---|---|
| POST_PUBLISHED | `PostPublishWorkerServiceImpl.saveSuccess` (:473) |
| POST_FAILED / RECONNECT_NEEDED | `PublishFailureNotifierImpl.notifyFailure` (lỗi cuối cùng / lỗi tài khoản, có dedupe) |
| RECONNECT_NEEDED | `TokenHealthCheckJob` (hết hạn + sắp hết hạn 3 ngày), `PostingDispatchServiceImpl:106`, `MetaOAuthServiceImpl:491` |
| REVIEW_NEEDED | `ContentGenerationWorkerServiceImpl:196` |
| NEW_INSIGHT | `StrategyOptimizationWorkerServiceImpl:238` |
| SCHEDULE_OVERDUE | `HeldScheduleOverdueJob` (notifyOnce) |
| PAYMENT_SUCCEEDED | `PaymentServiceImpl:1065` |
| PLAN_EXPIRED | `SubscriptionServiceImpl.announceDowngrade` (:364) |
| PAYMENT_WEBHOOK_ALERT (admin) | `PaymentServiceImpl:808` |

### Sự kiện chưa sinh thông báo
- Tạo content thất bại / timeout (`saveFailure`, `ContentGenerationStuckJob`).
- Nghiên cứu xu hướng xong / lỗi (`TrendResearchWorkerServiceImpl`, `TrendResearchStuckJob`).
- Bài bị nền tảng gỡ (`MetaWebhookEventWorkerImpl` → `markDeleted`, ghi rõ "no notification").
- Hạn mức AI 80% / 100% (`TokenUsageServiceImpl.checkQuota` chỉ ném lỗi).
- Gói sắp hết hạn (không có job nhắc).
- Admin: `usage_alerts` (R1–R9) chỉ hiện trong UI admin; AI/Meta suy giảm.
- Duyệt / yêu cầu sửa bài (`ContentItemServiceImpl.updateReview`): chính chủ tự duyệt, không có
  người duyệt khác → **không cần** thông báo.

Codebase **không dùng** `ApplicationEventPublisher` / `@TransactionalEventListener`; việc sau commit
đăng ký `TransactionSynchronizationManager...afterCommit` thủ công.

### Cài đặt thông báo
- Bảng `user_notification_preferences` (V14): `email_publish_errors`, `email_prompt_status`,
  `consent_at`, `updated_at`.
- API `GET/PUT /users/me/notification-preferences`; public `POST /notifications/unsubscribe?token=`
  (HMAC, `util/UnsubscribeTokenCodec`).
- Tab Settings → Thông báo (`pages/Settings.tsx:232-253`):
  - `components/settings/PublishErrorEmailCard.tsx`: **thật**, có lưu.
  - 4 công tắc `useAppStore.notif` ("Đăng thành công / Ý tưởng AI / Báo cáo tuần / Xu hướng mới"):
    **chỉ là UI**, trong bộ nhớ, mất khi tải lại.

### Email
- Brevo HTTP API (`service/Impl/BrevoEmailSender.java`), HTML inline (`EmailServiceImpl`).
- Đang gửi: OTP (quên/đổi mật khẩu, đăng ký), hoàn tất tài khoản, cảnh báo xoá tài khoản,
  lỗi đăng bài (cần `AIMA_PUBLISH_EMAIL_ENABLED=true` **và** user đồng ý; tối đa 1 email/ngày;
  có `List-Unsubscribe`).

### Frontend
- `NotificationBell` dùng API thật, poll 60s, dropdown phân trang (`PAGE_SIZE=8`),
  đánh dấu đã đọc lạc quan, "Đọc tất cả". Mở được từ palette (`useUiStore.notificationsOpen`).
- Bấm chỉ điều hướng theo **loại** (`ROUTE_BY_TYPE`), bỏ qua `refId`.
- Dashboard timeline + `ActivityAllModal` dùng chung `listNotifications`.

## 5. Luồng tạo content bằng AI

### End to end
1. **FE** (`pages/app/CreateWizard.tsx:294-325`): `ensureItem` tạo item DRAFT
   (`POST /content-items`), rồi bắn **một job / nền tảng song song**:
   `POST /content-items/generate` (Idempotency-Key) → poll `GET /content-items/jobs/{id}`.
2. **BE** (`ContentGenerationServiceImpl:57-128`): khoá item, chống trùng,
   `checkQuota` + `checkConcurrentAiJobs` (tối đa 3 job), kiểm tra strategy ACTIVE,
   lưu job PENDING, `afterCommit` → worker `@Async("contentGenerationExecutor")`.
3. **Worker** (`ContentGenerationWorkerServiceImpl`): TX ngắn → RUNNING; gọi AI **ngoài TX**
   `aiUsageService.recordCall(ctx, () -> aiServiceClient.generateContent(payload))`
   (WebClient `.block(100s)` → Python `/generate`); `saveSuccess` lưu `content_versions`,
   job SUCCESS, thông báo REVIEW_NEEDED. `saveFailure` lưu errorCode.
4. Trạng thái job chỉ có PENDING → RUNNING → SUCCESS/FAILED, không có bước trung gian.
   `ContentGenerationStuckJob` đánh FAILED (`AI_TIMEOUT`) job treo > 5 phút.
5. Format là bước riêng: `POST /content-items/{id}/format` → worker gọi Python `/format`
   **từng nền tảng tuần tự**, có hậu xử lý sau khi model trả.

### Python AI service
- FastAPI 0.136, LangChain 1.3 (langchain-anthropic, langchain-google-genai), anthropic, google-genai.
- Mọi endpoint là `def` đồng bộ (`ai/src/api/routes.py`); không `StreamingResponse`.
- `ai/src/llm.py`: `with_structured_output` (Anthropic = tool use, Gemini = JSON schema);
  chuỗi fallback do BE định tuyến (`ai_providers`, `ai_models`, `ai_task_routing`,
  `ai_task_routing_fallback` → `AiRuntimeConfigServiceImpl`); ngân sách 80s / chuỗi, 40s / lần gọi.
- **SDK đều hỗ trợ stream nhưng chưa dùng.** `_GeminiChat` chỉ override `_generate`
  → thêm đường stream phải override `_stream/_astream`.
- Đầu ra là **JSON có cấu trúc** (`ai/src/schemas.py:342-371`), thứ tự:
  `script{hook, steps[], cta}` → `caption` → `hashtags` → `cta` → `media_prompt` → `image_prompt`
  → `brand_voice_check` ⇒ stream phải đọc **JSON dang dở**.

### Token usage
- Python trích usage từ provider, trả về trong body.
- BE ghi `ai_usage` trong `AiUsageServiceImpl.recordCall` **sau khi** lời gọi kết thúc;
  `status` CHECK `SUCCESS|ERROR|TIMEOUT`; lỗi/timeout ghi 0 billable.
- Quota kiểm tra trước khi dispatch (chặn cứng 100% khi hết credit, 80% chỉ cảnh báo);
  **không có reservation**.

### Huỷ
- Không có ở đâu cả. `saveSuccess` không kiểm tra trạng thái job → kết quả về muộn ghi đè
  (có chủ đích, cho job bị đánh treo — `ContentGenerationStuckJob.java:24`).
- Khi BE timeout, Python (sync) vẫn chạy hết chuỗi và tiêu token của provider.

### Đăng bài / lịch đăng
- `PostingDispatchJob` mỗi 60s (ShedLock `posting-dispatch`): claim SCHEDULED→POSTING,
  tạo `Post` + `PostingJob` PENDING; chạy retry đến hạn; cứu job treo.
- `PostPublishWorkerServiceImpl` (`@Async("postPublishExecutor")`): claim → tải target →
  publish ngoài TX → `saveSuccess` / `saveFailure`.
- Retry 5/15/30 phút + jitter 0–30s, tôn trọng Retry-After, chỉ với lỗi `isAutoRetry`.
- Không có trường lưu tiến độ.

## 6. Frontend — điểm gắn kết

- **Nơi mở/đóng SSE:** `components/AppShell.tsx` — chỉ render dưới ProtectedRoute/AdminLayout,
  unmount khi đăng xuất; `NotificationBell` nằm trong đó. Lưu ý: StrictMode mount 2 lần ở dev;
  401 hiện không xoá `user`.
- **Zustand:** `store/useAppStore.ts` (lang, theme, `notif`…), `store/useUiStore.ts`
  (`notificationsOpen`, `paletteOpen`…). Sẽ thêm `useRealtimeStore`.
- **Toast:** tự viết `components/toast/ToastProvider.tsx` — `useToast()` + `globalToast`,
  thay thế theo `id`, dừng khi hover. **Chưa có nút hành động.**
- **i18n:** `src/i18n.ts` key phẳng, bắt buộc vi + en, tham số bằng `.replace('{n}')`.
  `lang` chỉ trong Zustand, không lưu → **backend không biết ngôn ngữ user**.
- **Điều hướng:** `go(route, search)` + `PATH_BY_ROUTE` (`context/AppContext.tsx`);
  `?focus=<id>` qua `hooks/useSectionFocus.ts`; mẫu trong palette
  (`components/search/CommandPalette.tsx`): `go('create','?view=<id>')`,
  `navigate('/calendar/<id>')`, `go('brand','?tab=strategy&strategy=<id>')`.

---

# GIAI ĐOẠN 2 — ĐỀ XUẤT

## 1. Kiến trúc SSE

### 1.1 Mỗi tab một luồng chung; AI delta đi chung luồng

`GET /realtime/stream` mang mọi loại sự kiện: thông báo, tiến độ job, trạng thái bài **và cả delta AI**.
Không mở luồng riêng cho từng request AI. Lý do:

- **Tạo content vẫn là job nền (NFR-04).** Kết nối HTTP không nên "sở hữu" công việc: đóng tab
  không được giết job. Luồng riêng theo request sẽ buộc vòng đời job phụ thuộc kết nối, hoặc vẫn phải
  có fan-out riêng.
- **Nhiều instance.** `POST /generate` vào instance A → worker chạy trên A, còn luồng SSE có thể ở B
  ⇒ đằng nào cũng cần pub/sub; đi chung một đường thì chỉ có một cơ chế.
- **Giới hạn kết nối.** 3 nền tảng = 3 luồng AI + 1 luồng chung; HTTP/1.1 (dev) chỉ 6 kết nối / origin
  → axios bị nghẽn.
- **Một đường code** cho xác thực, heartbeat, kết nối lại.

Đánh đổi: delta tới mọi tab của user, FE lọc theo `jobId` (vô hại, tab khác cũng thấy tiến độ).
Delta gộp mỗi 100ms nên lưu lượng nhỏ.

### 1.2 Xác thực kết nối SSE

- Dùng cookie `access_token` qua `JwtAuthenticationFilter` hiện có;
  FE dùng `fetch(url, { credentials: 'include' })`.
- `SecurityConfig` phải permit dispatcher `ASYNC` / `ERROR` (filter JWT bỏ qua async dispatch →
  nếu không permit sẽ gặp AccessDenied trên response đã commit khi emitter kết thúc).
- Server tự đóng emitter tại `min(30 phút, thời điểm token hết hạn)`; client kết nối lại bằng cookie
  mới → token bị thu hồi / hết hạn không tiếp tục nhận sự kiện.
- Đăng xuất / khoá tài khoản → phát `session.revoked` lên bus → đóng mọi luồng của user ở mọi instance.
- **Điều kiện tiên quyết (Bước 0):** FE gặp 401 → `POST /auth/refresh` (single-flight) → thử lại 1 lần;
  refresh thất bại → `setUser(null)` → `/login`. Client SSE dùng chung hàm refresh.
- Ngoại lệ thứ 4 của quy tắc "mọi controller trả `ApiResponse`" → ghi vào `backend/CLAUDE.md`.
  Lỗi trước khi mở stream (401, 429, 503) vẫn trả JSON `ApiResponse`.
- Dự phòng (chưa làm): `POST /realtime/ticket` cấp ticket Redis dùng một lần, sống 30s, gửi `?ticket=`.

### 1.3 Định dạng sự kiện

```
retry: 3000
id: <notificationId>              ← chỉ có ở sự kiện bền (notification.created)
event: notification.created
data: {"v":1,"ts":"2026-10-14T08:00:00Z", ...}
```

| event | payload chính | Ghi chú |
|---|---|---|
| `ready` | `unreadCount`, `resync`, `serverTime` | Gửi ngay khi kết nối, sau phần bù sự kiện |
| `notification.created` | DTO thông báo + `unreadCount` (đếm trong TX) + `toast: boolean` | Có `id` |
| `notification.read` | `ids[]` hoặc `all: true`, `unreadCount` | Đồng bộ giữa các tab |
| `notification.deleted` | `ids[]`, `unreadCount` | |
| `job.updated` | `kind` (GENERATION / FORMATTING / REGEN / TREND / AI_ASSIST / OPTIMIZE), `jobId`, `itemId?`, `platform?`, `status`, `stage?`, `progress?{done,total}`, `errorCode?`, `resultId?` | |
| `ai.delta` | `jobId`, `seq`, `path` (vd `caption`, `script.steps[1].content`), `append` | Không `id`, không bù |
| `ai.reset` | `jobId`, `reason` | Chuyển sang model dự phòng giữa chừng |
| `post.updated` | `scheduleId`, `postId?`, `itemId`, `platform`, `status`, `attempt?`, `nextRetryAt?`, `holdReason?`, `errorCode?` | |
| `usage.updated` | `percent` | Thanh token ở sidebar (tuỳ chọn) |
| `session.revoked`, `replaced`, `reconnect` | — | Điều khiển vòng đời kết nối |

### 1.4 Heartbeat, timeout, kết nối lại, Last-Event-ID

- **Heartbeat:** comment `:hb` mỗi 20s từ **một `ScheduledExecutorService` riêng của registry** —
  **không** dùng `@Scheduled` + ShedLock, vì heartbeat phải chạy ở mọi instance kể cả instance có
  `app.scheduling.enabled=false`.
- **Timeout:** mỗi kết nối tối đa 30 phút → gửi `event: reconnect` rồi đóng; client nối lại ngay.
- **Client:** backoff 1→2→4…30s + jitter; 401 → refresh rồi nối lại; 403 → dừng hẳn;
  sự kiện `offline` → tạm dừng; tab hiện lại → nối lại ngay;
  watchdog: 45s không nhận byte nào → abort và nối lại (phát hiện kết nối chết nửa vời).
- **Bù sự kiện — SSE chỉ là gợi ý, DB là nguồn đúng:**
  - Nối lại có Last-Event-ID (id thông báo) → server lấy `created_at` của thông báo đó, phát lại tối đa
    50 thông báo mới hơn, rồi `ready`. Quá 50 hoặc không tìm thấy id → `ready{resync:true}`,
    FE tải lại trang đầu danh sách.
  - Job / bài đăng không phát lại: khi nhận `ready`, FE GET lại các job đang theo dõi; trang đang mở refetch.
  - Delta AI bị lỡ → khung xem trước reset, chờ kết quả cuối từ DB.

### 1.5 Nhiều tab

- Mỗi tab một kết nối. Tab ẩn > 5 phút → đóng; hiện lại → mở + resync.
- Toast chỉ hiện ở tab đang hiển thị (`document.visibilityState === 'visible'`);
  badge và danh sách cập nhật ở mọi tab.
- Server: tối đa 6 kết nối / user / instance; vượt → đóng kết nối cũ nhất bằng `event: replaced`
  (client không nối lại).
- Leader election (Web Locks + BroadcastChannel) **chưa làm** — production nhiều khả năng HTTP/2
  (cần xác minh), dev chỉ vướng khi > 4 tab. Chỉ làm khi đo thấy cần.

### 1.6 Pub/sub giữa các instance

| | Redis pub/sub (**đề xuất**) | Postgres LISTEN/NOTIFY |
|---|---|---|
| Hạ tầng | Redis (Upstash) đã là phụ thuộc bắt buộc (auth dùng) | Cần **kết nối riêng ngoài Hikari** (pool chỉ 5); pooler transaction mode không hỗ trợ LISTEN; kết nối trực tiếp Supabase chỉ IPv6 |
| Delta AI (tần suất cao) | Phù hợp | Tạo tải ghi lên DB chính Supabase |
| Payload | Không giới hạn đáng kể | 8KB |
| Đảm bảo giao | At-most-once (đã có resync bù) | Gắn transaction — nhưng `afterCommit` cho kết quả tương đương |
| Thư viện | `RedisMessageListenerContainer`, Lettuce tự nối lại | pgjdbc phải poll `getNotifications` |

- Một kênh `aima:rt:v1`, message `{target: {userId} | {role: "ADMIN"}, event, id, data}`.
- Mọi instance subscribe, chỉ giao cho emitter local. **Luôn đi qua Redis kể cả khi phát tới chính
  instance mình** → một đường giao duy nhất, không gửi trùng.
- Rủi ro Upstash: mỗi PUBLISH = 1 command (quota/chi phí); kết nối idle có thể bị cắt
  (Lettuce tự nối lại) → cần kiểm tra gói Upstash.

### 1.7 Cấu hình proxy / host / Vite

- Header: `Content-Type: text/event-stream;charset=UTF-8`, `Cache-Control: no-cache, no-transform`,
  `X-Accel-Buffering: no`. Gửi `retry:` + `ready` ngay để proxy flush header.
- Giữ `text/event-stream` ngoài `server.compression.mime-types` (hiện đã đúng).
- Render / Cloudflare (nếu có): heartbeat 20s < timeout idle 60–100s; server tự giới hạn 30 phút
  nên không phụ thuộc giới hạn thời lượng của Render (chưa xác minh — thử trên môi trường thật).
- Vercel không nằm trên đường đi (FE gọi thẳng domain API). Vite không proxy → không cần cấu hình.
- Tomcat: SseEmitter chạy async, không giữ thread request; NIO mặc định 8192 kết nối.
  **Không cần virtual threads.**

### 1.8 Giới hạn & dọn dẹp

- Registry `ConcurrentHashMap<userId, Set<Conn>>`; `onCompletion` / `onTimeout` / `onError` gỡ khỏi
  registry; gửi lỗi `IOException` → gỡ luôn.
- Giới hạn: 6 kết nối / user, 2000 / instance; vượt → 503 + `Retry-After`.
- Gửi qua executor fan-out riêng, hàng đợi giới hạn → thread listener Redis và worker không bị kẹt
  bởi socket chậm.
- Handler stream chỉ chạm DB cho phần bù sự kiện + đếm chưa đọc, trả connection ngay trước khi trả
  emitter (`open-in-view=false`) → pool 5 vẫn an toàn.

## 2. Thông báo

### 2.1 Dữ liệu — migration V17

```sql
ALTER TABLE notifications ADD COLUMN params jsonb, ADD COLUMN ref_type varchar(30);
-- cập nhật CHECK type thêm các loại mới
CREATE INDEX ix_ntf_user_created ON notifications (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_ntf_user_unread  ON notifications (user_id) WHERE read_at IS NULL AND deleted_at IS NULL;
ALTER TABLE user_notification_preferences ADD COLUMN channels jsonb NOT NULL DEFAULT '{}';
-- ai_usage.status CHECK thêm 'CANCELLED' (phục vụ AI streaming, xem mục 5)
```

- **Cài đặt** lưu `channels` jsonb trên bảng sẵn có, dạng
  `{"PUBLISHING":{"inApp":true,"toast":false,"email":false}, …}`. Key thiếu → mặc định trong code;
  service kiểm tra key hợp lệ theo enum. Thêm loại mới không cần migration.
- `email_publish_errors` + `consent_at` giữ nguyên (ngữ nghĩa đồng ý nhận email, gắn link huỷ nhận).
- **Dọn thông báo cũ:** job hằng ngày `notification-retention` (ShedLock):
  xoá cứng đã đọc > 90 ngày, mọi thông báo > 180 ngày, đã xoá mềm > 30 ngày (chốt ở D6).

### 2.2 API

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/notifications?status=all\|unread&category=&page&size` | Vẫn nhận `unreadOnly` để tương thích |
| GET | `/notifications/unread-count` | Giữ nguyên |
| PATCH | `/notifications/{id}/read`, `/notifications/read-all` | Giữ nguyên, thêm phát `notification.read` |
| DELETE | `/notifications/{id}` | **Mới** — xoá mềm |
| DELETE | `/notifications?read=true` | **Mới** — xoá các thông báo đã đọc |
| GET/PUT | `/users/me/notification-preferences` | Mở rộng thêm `channels` |
| GET | `/realtime/stream` | **Mới** — SSE |
| POST | `/content-items/jobs/{id}/cancel` | **Mới** — nút Dừng (mục 5) |

### 2.3 Nguyên tắc `notify(user, type, params, ref)`

1. Xác định nhóm (category) của loại, đọc cài đặt user.
2. Tắt "trong app" và nhóm không bắt buộc → **không tạo bản ghi, không đẩy SSE**
   (đường email độc lập).
3. INSERT trong transaction của nơi gọi (giữ dedupe), đếm chưa đọc ngay trong TX.
4. `afterCommit` → `bus.publish` (không có TX → phát ngay).
5. Đẩy lỗi không bao giờ làm hỏng nghiệp vụ.

Giữ kiểu `TransactionSynchronization` thủ công như các chỗ khác trong code.

### 2.4 Danh sách loại thông báo

★ = nhóm **bắt buộc trong app** (khớp dòng `seInAppAlways` đang hiển thị).

| Loại | Trạng thái | Nhóm | Đích khi bấm |
|---|---|---|---|
| POST_PUBLISHED | có | PUBLISHING | `/calendar/{scheduleId}` |
| POST_FAILED | có | PUBLISH_ISSUES ★ | `/failed-posts?focus=…` |
| POST_REMOVED_BY_PLATFORM | **mới** (webhook) | PUBLISH_ISSUES ★ | `/failed-posts` |
| SCHEDULE_OVERDUE | có | PUBLISH_ISSUES ★ | `/calendar/{id}` |
| RECONNECT_NEEDED | có | ACCOUNTS ★ | `/settings?tab=connections&focus=…` |
| TOKEN_EXPIRING | **tách** từ RECONNECT_NEEDED | ACCOUNTS ★ | như trên |
| REVIEW_NEEDED | có | AI_CONTENT | `/create?view={itemId}` |
| CONTENT_GENERATION_FAILED | **mới** | AI_CONTENT | `/create/{itemId}?step=2` |
| TREND_RESEARCH_DONE / FAILED | **mới** | AI_CONTENT | `/trends` |
| NEW_INSIGHT | có | AI_CONTENT | `/brand?tab=strategy&strategy={id}` |
| PAYMENT_SUCCEEDED | có | BILLING | `/billing` |
| PLAN_EXPIRING | **mới** (job hằng ngày, báo trước 7 và 1 ngày) | BILLING | `/billing` |
| PLAN_EXPIRED | có | BILLING ★ | `/billing` |
| AI_QUOTA_WARNING (80%) / AI_QUOTA_EXHAUSTED (100%) | **mới** (dedupe theo kỳ) | BILLING | `/settings/usage` |
| SCHEDULE_UPCOMING | **mới, tuỳ chọn** (báo trước 30 phút) | REMINDERS (mặc định tắt) | `/calendar/{id}` |
| PAYMENT_WEBHOOK_ALERT | có | ADMIN | `/admin/revenue?tab=orders` |
| ADMIN_USAGE_ALERT | **mới** | ADMIN | `/admin/usage` |
| ADMIN_AI_DEGRADED | **mới** (circuit breaker mở, dedupe theo giờ) | ADMIN | `/admin/system` |
| ADMIN_API_VERSION | **mới** | ADMIN | `/admin/api-versions` |

Dedupe key gợi ý: `quota:{userId}:{period}:{80|100}`, `plan-expiring:{subscriptionId}:{daysLeft}`,
`sched-upcoming:{scheduleId}:{revision}`.

**Cố ý không tạo thông báo:**
- Duyệt / yêu cầu sửa bài — chính chủ thao tác.
- Format, regen, AI assist xong — user đang chờ trên màn hình, chỉ cần sự kiện tiến độ.
- Từng lần retry — chỉ thông báo khi thất bại cuối cùng (đúng BR-08, FR-56).

### 2.5 Đa ngôn ngữ: lưu key + tham số

- Lưu `type` + `params` (vd `{platform, accountName, errorCode, detail}`); FE hiển thị bằng key
  `ntf_<TYPE>_title` / `ntf_<TYPE>_body` trong `i18n.ts`.
- **Lý do:** backend không biết ngôn ngữ user; đổi ngôn ngữ thì thông báo cũ đổi theo;
  bản dịch chỉ nằm ở một file.
- `title` / `message` tiếng Việt vẫn ghi → dự phòng cho bản ghi cũ, email, FE bản cũ.
- Thông báo lỗi nguyên văn từ Meta đặt trong `params.detail`, không dịch.
- Chi phí: đồng bộ 3 nơi (enum BE, type FE, i18n) — giống quy ước hiện tại.

## 3. Cài đặt thông báo (`/settings?tab=notifications`)

Thay 4 công tắc giả bằng **ma trận nhóm × kênh**; bỏ `useAppStore.notif` (thành code mồ côi).

| Nhóm | Trong app | Toast | Email |
|---|---|---|---|
| Lỗi đăng bài ★ | 🔒 bật | bật | dùng lại `email_publish_errors` (giữ ngữ nghĩa đồng ý) |
| Tài khoản mạng xã hội ★ | 🔒 bật | bật | dùng chung cờ đồng ý ở trên (cần chốt) |
| Đăng thành công | bật | bật | — |
| Nội dung AI & xu hướng | bật | bật | — |
| Thanh toán & hạn mức | bật | bật | gói sắp hết hạn: tắt (cần chốt) |
| Nhắc lịch sắp đăng | tắt | tắt | — |
| Quản trị (chỉ admin) | bật | bật | — |

- Ô khoá hiển thị bật + vô hiệu, có tooltip giải thích.
- Cột email vô hiệu kèm ghi chú khi `emailAvailable=false`.
- Lưu ngay mỗi lần bật/tắt (lạc quan + toast), giống `PublishErrorEmailCard`.

## 4. Frontend: chuông + toast

- **Kết nối:** store `useRealtimeStore` (`status`: connecting/open/reconnecting/offline,
  `unreadCount`, `lastEventId`) + hook `useRealtimeEvent(type, handler)`;
  `<RealtimeConnector/>` gắn trong `AppShell`.
- **Chuông:** badge từ store; `notification.created` → chèn đầu danh sách (nếu đã tải) + hiệu ứng nhẹ
  (tôn trọng reduced-motion); `notification.read` đồng bộ giữa các tab.
- **Mất kết nối:** sau 10s → chấm xám trên chuông + tooltip "Đang kết nối lại…";
  sau 30s → **quay lại poll 60s** bằng code cũ; nối lại được thì ngừng poll.
- **Toast:** thêm `action {label, onClick}` vào `ToastProvider` (nút "Xem"); chỉ hiện khi
  `event.toast` bật **và** tab đang hiển thị; tối đa 3 toast / 10s, nhiều hơn gộp
  "Bạn có N thông báo mới".
- **Bấm thông báo:** `notificationTarget(n)` trong `notificationMeta.ts` dựng route từ
  `refType / refId / params`, dùng `go()` + `?focus=`; đánh dấu đã đọc lạc quan.
- **Xem tất cả:** trang `/notifications` — lọc tất cả/chưa đọc, chip theo nhóm, cuộn tải thêm,
  đánh dấu tất cả, xoá, xoá đã đọc; thêm vào registry palette.

## 5. AI streaming

```
FE POST /content-items/generate (không đổi) → job PENDING
Worker (instance A) → Python POST /generate/stream (NDJSON):
   start{model, inputTokens?} · delta{path, append} · reset{reason} · done{content, usage} · error{error_code}
→ gộp delta mỗi 100ms → Redis → SSE ai.delta → GenerateStep hiển thị từng field
→ done: saveSuccess (giữ nguyên) → job.updated SUCCESS{contentVersionId} → FE hiển thị bản đã lưu
```

### Python
- Endpoint mới `async` `/generate/stream`; giữ `/generate` để tương thích và làm đường dự phòng.
- `astream`; ghép dần chuỗi JSON thô (tool-call args của Anthropic / text JSON của Gemini) →
  `parse_partial_json` (langchain_core) → so sánh các field chuỗi → phát `delta`.
- Kết thúc: validate pydantic + hậu xử lý **y như hiện nay**.
- Lỗi trước delta đầu tiên → fallback âm thầm như cũ; lỗi sau khi đã có delta → `reset` rồi fallback
  (vẫn trong ngân sách 80s).
- Override `_astream` cho `_GeminiChat` (giữ việc tắt automatic function calling).
- Client ngắt kết nối → đóng stream tới provider → provider ngừng sinh.

### Backend
- `AiServiceClient.generateContentStream`: `bodyToFlux(...)` + `takeUntilOther(cancel)` +
  `blockLast(timeout)`. Worker vẫn bị chặn như hiện nay; mô hình executor không đổi.
- Cờ `aima.ai.generation-streaming-enabled` (mặc định tắt) vì BE và AI deploy riêng; tắt → đường cũ.
- **Nút Dừng:**
  1. `POST /content-items/jobs/{id}/cancel` (kiểm tra chủ sở hữu).
  2. Update có điều kiện PENDING/RUNNING → **FAILED + `errorCode=CANCELLED_BY_USER`**
     (không thêm giá trị enum).
  3. Phát `job.cancel` lên bus → instance giữ job dispose → Python → provider dừng.
  4. `saveSuccess` kiểm tra điều kiện: **không ghi đè job user đã huỷ** (vẫn cho ghi đè job bị đánh
     timeout do treo như cũ).
  5. Slot đồng thời (tối đa 3) được giải phóng ngay.
- **Lỗi giữa chừng:** `saveFailure` như cũ → `job.updated FAILED` → FE bỏ bản xem trước, hiện
  "Thử lại". **Chỉ lưu kết quả cuối cùng.**
- **Tính token:**
  - Thành công: usage trong `done` — giống hệt hiện nay.
  - Huỷ: `ai_usage.status=CANCELLED` với input token thật (nhận sớm trong `start`) + output token
    ước lượng theo số ký tự đã nhận; có tính tiền hay không → D4.
  - Lỗi: vẫn 0 như hiện nay.

### Frontend
- Mỗi tab nền tảng có khung xem trước: field hiện lần lượt (Hook / Steps / CTA / Caption / Hashtags /
  Media prompt), `aria-live` có throttle, nút "Dừng".
- `ai.reset` → xoá khung, ghi "Đang thử model dự phòng".
- Mất SSE → quay về polling `generateVersion` như hiện nay.
- **Không stream format** (kết quả bị hậu xử lý, chữ stream ra sẽ khác bản lưu) — chỉ có tiến độ.

## 6. Tiến độ tạo content / đăng bài

Stage chỉ có trong sự kiện, **không lưu DB** (không đổi schema / state machine).

| Luồng | Các mốc |
|---|---|
| Tạo content | QUEUED → RUNNING·PREPARING → RUNNING·GENERATING (+ delta) → SUCCESS{resultId} / FAILED{errorCode} |
| Format | RUNNING `progress{done,total,platform}` sau mỗi nền tảng → SUCCESS / FAILED |
| Trend, AI assist, regen, tối ưu chiến lược | chỉ báo đổi trạng thái |
| Đăng bài (`post.updated`) | claim→POSTING · RUNNING · POSTED · RETRYING{attempt, nextRetryAt} · FAILED{errorCode} · ON_HOLD{reason} |

- Phát sau commit từ `PostingDispatchServiceImpl`, `PostPublishWorkerServiceImpl`, `ScheduleHoldService`.
- FE `waitForJob(kind, jobId)`: chờ qua SSE, quay về polling hiện có nếu stream không mở hoặc 15s
  không có sự kiện.
- Calendar, Schedule detail, FailedPosts, Dashboard, Sidebar nghe `post.updated` → patch tại chỗ
  hoặc refetch (debounce 500ms).

## 7. Thư viện — không cài thêm

- **Backend:** `SseEmitter` (webmvc), `RedisMessageListenerContainer` (data-redis đã có),
  WebClient Flux (webflux đã có). Không dùng WebSocket/STOMP.
- **AI service:** `StreamingResponse` NDJSON + `astream` + `parse_partial_json`. Không cần
  `sse-starlette` — NDJSON đơn giản hơn cho đường nội bộ BE↔AI.
- **Frontend:** tự viết client SSE ~150 dòng (fetch + ReadableStream).
  - Không dùng `EventSource` gốc: không thấy HTTP status (không phân biệt 401 với lỗi mạng để refresh),
    không đặt được Last-Event-ID khi nối lại thủ công.
  - Không dùng `@microsoft/fetch-event-source`: ngừng bảo trì từ 2021, có ngữ nghĩa riêng khi tab ẩn,
    thêm phụ thuộc.
  - Parser là hàm thuần → test bằng `node --test`.
  - Ngoại lệ của quy tắc "không fetch trực tiếp" (axios không stream được trên trình duyệt) →
    ghi vào `frontend/CLAUDE.md`.

## 8. Kế hoạch triển khai

| Bước | Nội dung | Cách kiểm tra |
|---|---|---|
| **0** | Refresh khi gặp 401 ở FE (single-flight, thất bại → đăng xuất) | Stack cô lập với access TTL = 60s: dùng liên tục 3 phút không bị văng; `npm run build` |
| **1** | Hạ tầng SSE. BE: controller, registry, giới hạn, heartbeat, bus Redis, permit ASYNC, đóng luồng khi logout. FE: client, parser, store, `RealtimeConnector`, trạng thái kết nối | Unit test registry / giới hạn / dọn dẹp; MockMvc async (content-type, `ready`); `node --test` parser; thủ công: `curl -N` kèm cookie, tắt/bật BE → FE tự nối lại; **2 BE 8092 + 8093** chung PG/Redis cô lập: phát ở instance này phải tới tab nối instance kia |
| **2** | BE thông báo: V17, params / ref_type, kiểm tra cài đặt, phát sau commit, API xoá, loại mới + điểm phát, job dọn dẹp | Test service (tắt kênh → không tạo bản ghi; dedupe); PG test trên Docker cô lập; `mvnw test` so với baseline 694 / 15 fail sẵn có |
| **3** | FE thông báo: chuông realtime + poll dự phòng, toast có nút, trang `/notifications`, deep link, ma trận cài đặt, i18n vi/en | Build; thủ công: tạo sự kiện → badge + toast, đúng đích, đồng bộ đã đọc giữa 2 tab, tắt nhóm → không toast |
| **4** | Tiến độ: `job.updated`, `post.updated`, `waitForJob` có polling dự phòng | "Đăng ngay" trên lịch đổi trạng thái không cần tải lại; ngắt SSE vẫn xong nhờ polling |
| **5** | AI streaming: Python → BE (có cờ) → FE, kèm Dừng, reset, CANCELLED | Test Python với LLM giả (delta, reset, ngắt kết nối); test worker với AI service giả phát NDJSON; kiểm tra `ai_usage` khi thành công / lỗi / huỷ; thủ công: Dừng → job FAILED/CANCELLED_BY_USER, slot giải phóng |
| **6** | Tài liệu: `PLAN.md` (mục mới), `DATA_MODEL.md` (thêm Notification), `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `ai/CLAUDE.md` | Rà lại |

## 9. Rủi ro

1. **Không vá refresh token → SSE chết sau 1 giờ.** Lỗi sẵn có, đưa vào Bước 0.
2. Upstash: quota / chi phí theo command, kết nối idle bị cắt, giao at-most-once
   → đã có resync + polling dự phòng.
3. Chưa xác minh giới hạn thời lượng kết nối của Render và có Cloudflare hay không. Thiết kế đã chịu
   được (heartbeat 20s, tự giới hạn 30 phút) nhưng cần thử trên môi trường thật.
4. Stream JSON có cấu trúc khá phức tạp (partial parse, fallback giữa chừng, đường stream của Gemini)
   → cờ tính năng để quay lui an toàn.
5. Instance dev local có thể chạy job trên DB Supabase thật nhưng dùng Redis local → user production
   không nhận sự kiện đó (rủi ro sẵn có; vẫn nhận khi nối lại).
6. Pool Hikari chỉ 5 → handler stream tuyệt đối không giữ DB connection.
7. StrictMode ở dev mở/đóng kết nối 2 lần → client phải abort sạch.

## Các điểm cần quyết định

| # | Câu hỏi | Đề xuất |
|---|---|---|
| D1 | Production chạy mấy instance trên Render? `api.` có qua Cloudflare proxy không? Có HTTP/2 không? | Thiết kế đúng cho N instance bất kể câu trả lời |
| D2 | Pub/sub: Redis hay Postgres LISTEN/NOTIFY? | **Redis pub/sub** (một kênh) |
| D3 | Mỗi tab một kết nối hay chia sẻ giữa các tab? | **Mỗi tab một kết nối** + đóng khi tab ẩn > 5 phút |
| D4 | Huỷ giữa chừng có tính token không? | **Có**: input thật + output ước lượng, `status=CANCELLED` |
| D5 | Đa ngôn ngữ: key+params hay text? | **Key + params**, giữ text tiếng Việt làm dự phòng |
| D6 | Thời gian giữ thông báo | Đã đọc 90 ngày, tất cả 180 ngày, xoá mềm 30 ngày |
| D7 | Loại mới ở mục 2.4; có làm SCHEDULE_UPCOMING; ngưỡng hạn mức; số ngày báo trước gói hết hạn | Làm hết; nhắc lịch mặc định tắt; 80/100%; 7 và 1 ngày |
| D8 | Email cho nhóm nào? | Chỉ lỗi đăng bài + tài khoản (đã có, chung cờ đồng ý); gói sắp hết hạn để sau |
| D9 | "Xem tất cả" là trang `/notifications` hay modal? | **Trang** |
| D10 | Bước 0 (refresh token) nằm trong đợt này? | **Có**, là điều kiện tiên quyết |
| D11 | AI streaming có cờ tính năng? | **Có**, mặc định tắt đến khi AI service lên bản mới |
| D12 | Job bị huỷ: trạng thái mới CANCELLED hay FAILED + `CANCELLED_BY_USER`? | **FAILED + `CANCELLED_BY_USER`** (không đổi enum / state machine) |
