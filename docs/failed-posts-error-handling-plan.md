# Kế hoạch: Nâng cấp "Bài lỗi & cần xử lý" (User + Admin)

> Bắt đầu: 2026-10-11 · Nhánh: `research_trends` · Trạng thái: đang triển khai (xem checklist §7).
> Quy ước: không commit/push (user tự review) — mọi thay đổi để trong working tree.
> Đặt ở `docs/` (cạnh `analytics-real-data-plan.md`, `CREATE_SCHEDULE_IMPLEMENTATION_PLAN.md`) vì repo không có `docs/plans/`.

---

## 1. Hiện trạng

### 1.1 Stack & quy ước liên quan (đã khảo sát)

| Mảng | Thực tế trong repo |
|---|---|
| Backend | Java 21 + Spring Boot 4, JPA/Hibernate 7 (`ddl-auto: validate`), **Flyway** `db/migration` V1–V12, mọi cột enum phải có CHECK (test `PublishingMigrationTest.verifyEnumChecks`). Layer: `controller` mỏng → `service` (interface) + `service/Impl` trả `ApiResponse<T>`, MapStruct cho mọi entity↔DTO, lỗi qua `AppException(ErrorCode)` |
| Đăng bài | `PostingDispatchJob` (60s, ShedLock) → `PostingDispatchService.dispatch` → `PostPublishWorkerService.process(jobId)` (`@Async`) → `PlatformPublisher` (FB/IG/Threads) → `MetaApiClientImpl.postFormForPublish` ném `PublishException(PublishErrorType, responseCode, message)` |
| Lưu lỗi | **Mỗi lần thử = một dòng `posting_jobs`** (status, retry_count, error_type, error_message, start/end, next_retry_at) + một dòng `publish_results` (is_success, response_code, response_message). Đây chính là "publish attempts" của đề xuất |
| Retry | FR-56 (root CLAUDE.md §7): chỉ TEMPORARY, 3 lần 5/15/30 phút, job mới `RETRYING`. Chống double-publish: claim nguyên tử job + schedule, ShedLock |
| Thông báo | Bảng `notifications` (title/message **tiếng Việt cố định**, `dedupe_key` + `notifyOnce`), chuông FE. Email chỉ có Brevo cho OTP/tài khoản |
| Log | `system_logs` (lỗi kỹ thuật, admin), `activity_logs` (audit, CHECK trên `action`), SLF4J. `MetaApiClientImpl.mask()` che token trong log |
| FE | React 18 + TS + Vite, i18n = `src/i18n.ts` (vi/en, `t.key`) + module mã lỗi thuần theo `Lang` (`api/aiErrorMessages.ts`, test bằng `node --test`), toast `useToast`, `Drawer`, `Pagination`, `TONE_COLORS` |
| Trang user | `/failed-posts` → `pages/app/FailedPosts.tsx` + `components/failedPosts/*`, API `GET /me/failed-posts` (chỉ lịch FAILED). **API lỗi hoặc rỗng → hiện `failedPostsMock.ts`** |
| Trang admin | `/admin/posts` → `pages/admin/Posts.tsx` + `components/admin/posts/*`, API `/admin/posts/failed{,/summary,/export}` |

### 1.2 Dữ liệu lỗi thật

Đã đọc (read-only JDBC, `Q.java`) DB dùng chung: `publish_results` chỉ có 2 dòng (đều thành công), `posting_jobs` 2 dòng, không có `system_logs` module `posting.*`. DB docker local trống. → **Không có payload lỗi thật** trong dự án; danh mục mã lỗi được kiểm chứng với tài liệu chính thức của Meta (§2.3).

### 1.3 Các chỗ đang lộ lỗi thô ra người dùng

| # | Vị trí | Lộ gì | Ai thấy |
|---|---|---|---|
| L1 | `backend/.../mapper/FailedPostMapper.java:26` (`errorMessage ← publish_results.response_message`) | Message gốc của Graph API (tiếng Anh, kỹ thuật) hoặc chuỗi lỗi nội bộ | **User** (`/me/failed-posts`) |
| L2 | `PostPublishWorkerServiceImpl.java:189` `internalError` = `ExceptionClass: message` → lưu `job.error_message` (:337) + `publish_results.response_message` (:344) | Tên exception Java, message ORM/NPE ("Could not initialize proxy [com.aima.entity…]") | **User** qua L1 |
| L3 | `MetaApiClientImpl.java:802` lỗi mạng: `e.getMessage()` của `WebClientRequestException` | URL Graph, chi tiết Netty | **User** qua L1 |
| L4 | `PostPublishWorkerServiceImpl.java:409, 450, 467, 475` — nội dung notification ghép `e.getMessage()` | Message gốc nền tảng trong chuông thông báo | **User** |
| L5 | `ContentGenerationWorkerServiceImpl.java:85`, `ContentRegenerationWorkerServiceImpl.java:87`, `TrendResearchWorkerServiceImpl.java:97`, `StrategyOptimizationWorkerServiceImpl.java:103`, `ContentFormattingWorkerServiceImpl.java:137/139` — `e.getMessage()` của exception KHÔNG phải `AppException` được lưu vào `error_message` của job | Message kỹ thuật (NPE, SQL, Jackson…) | **User** (Trends: `pages/app/Trends.tsx:182`; Chiến lược: `components/brand/StrategyOptimization.tsx:53`; định dạng) |
| L6 | `frontend/src/components/failedPosts/FailedPostRow.tsx:96,140`, `ErrorDetailModal.tsx:233` | Hiển thị `errorMessage` thô | **User** |
| L7 | `ErrorDetailModal.tsx:131` `JSON.stringify(...)` "Phản hồi từ nền tảng" + `shared.ts httpDetailOf` | JSON/HTTP **tự bịa** từ mã lỗi (không phải phản hồi thật) | **User** |
| L8 | `pages/app/FailedPosts.tsx:170` xuất CSV | Cột message thô | **User** |
| L9 | `pages/app/FailedPosts.tsx:72-78` | API lỗi → hiện **dữ liệu demo**, che mất việc mất kết nối | **User** |
| L10 | `AdminMonitorMapper.java:33`, `AdminMonitorServiceImpl` CSV, `PostProblemDetail.tsx:178` | Message gốc (đúng đối tượng là admin) nhưng **chưa redact**; mã lỗi chỉ suy bằng từ khoá ở FE (`rejectionReasons.ts`) | Admin |

Không lộ: `PostScheduleResponse`/Calendar (không mang lỗi), luồng HTTP thường (đã qua `ErrorCode` + `GlobalExceptionHandler`), `aiErrorMessages.ts` (đã map mã).

---

## 2. Đánh giá đề xuất

| Phần đề xuất | Kết luận | Lý do / cách hiện thực |
|---|---|---|
| 1. Error Catalog + Normalizer | **Giữ, điều chỉnh** | Backend: enum đóng `PublishErrorCode` mang metadata (category/severity/owner/autoRetry/actions/legacyType) = catalog mặc định trong code; `util/PublishErrorRules` (hàm thuần, test được) phân loại theo (code, subcode, HTTP, is_transient, message); `PublishErrorNormalizer` (bean) áp **ánh xạ admin trong DB** trước rồi mới tới luật mặc định. FE: `api/publishErrorCatalog.ts` (mẫu `aiErrorMessages.ts`, vi/en) render tiêu đề/chuyện gì/vì sao/các bước theo mã + tham số. Backend KHÔNG trả câu chữ hiển thị (trừ notification — xem §2.2) |
| `titleKey/messageKey/remediationSteps[]` | **Đổi** | Không gửi key i18n từ BE; BE gửi `code` + `params` (tên tài khoản, nền tảng, giới hạn ký tự, giờ thử lại). FE tra catalog → không lệch key giữa hai đầu, thêm ngôn ngữ chỉ sửa FE |
| `rawError` chỉ cho admin | **Giữ** | Cột mới `posting_jobs.error_detail` (JSON đã redact) chỉ ra ở endpoint admin; DTO user có test reflection chặn (mẫu payments) |
| `correlationId` / mã tham chiếu `ERR-XXXXXX` | **Giữ, đơn giản hoá** | Correlation id = **id của `PostingJob`** (đã xuyên suốt dispatch → worker → log → DB). Mã tham chiếu = `ERR-` + 6 ký tự hex đầu của job id → tất định, không cần cột/backfill, dữ liệu cũ cũng có mã; admin tra bằng tiền tố id |
| Catalog override/mở rộng bằng bảng DB, admin sửa nội dung vi/en | **Điều chỉnh** | Bảng `publish_error_mappings` chỉ ánh xạ **chữ ký lỗi (nền tảng, code, subcode, mẫu message) → mã AIMA có sẵn**. Không cho admin tự viết câu vi/en: mọi chữ hiển thị đi qua i18n FE (quy tắc dự án), và mã mới kéo theo chính sách retry/hành động mới → phải qua code review. Thêm mã mới = 1 dòng enum + 1 mục catalog FE + migration CHECK |
| `UNKNOWN` + hàng đợi "chưa phân loại" | **Giữ** | Admin gom theo chữ ký, xem payload đã redact, ánh xạ vào mã có sẵn, tuỳ chọn áp lại cho lỗi cũ |
| 2. Bảng `publish_attempts` | **Đã có sẵn → không tạo** | `posting_jobs` + `publish_results` đã là 1 dòng/lần thử. Thêm cột vào `posting_jobs`: `error_code`, `platform_error_code`, `platform_error_subcode`, `error_detail`, `resolution`, `resolved_at`, `resolved_by` |
| Vòng đời `auto_retrying → needs_action → resolved/dismissed/permanently_failed` | **Điều chỉnh** | Không thêm trạng thái vào state machine bài/lịch (root CLAUDE.md §6). `FailureState` là chiều **suy ra** khi đọc: AUTO_RETRYING (lịch POSTING + job RETRYING), NEEDS_ACTION (lịch FAILED, lỗi cuối chưa xử lý), DISMISSED (lỗi cuối `resolution=DISMISSED`), RESOLVED (lịch đã rời FAILED). `resolution` (DISMISSED/RETRIED/CANCELLED) + người/giờ lưu trên **job lỗi cuối** → lỗi mới sinh job mới nên tự "mở lại", không cần reset. **Bỏ `permanently_failed`**: trùng nghĩa với NEEDS_ACTION khi không có hành động tự động nào; phân biệt bằng `owner`/`actions` của mã |
| Retry exponential backoff + jitter, tôn trọng Retry-After / header Meta | **Điều chỉnh** | Giữ lịch **5/15/30 phút** (chính sách bắt buộc FR-56, root CLAUDE.md §7) + jitter 0–30s chống dồn; nếu nền tảng báo thời gian chờ (`Retry-After`, `X-Business-Use-Case-Usage.estimated_time_to_regain_access`) lớn hơn → chờ theo nền tảng (trần 6h). Không đổi sang exponential vì sẽ phá chính sách đã chốt |
| Idempotency trước khi retry timeout | **Giữ** | Lần thử trước lỗi mơ hồ (mạng/timeout/gián đoạn/5xx) → hỏi nền tảng có bài khớp nội dung từ lúc bắt đầu chu kỳ chưa (FB `/{page}/published_posts`, Threads `/me/threads`); có → ghi thành công với id đó, không đăng lại. Kiểm tra lỗi → vẫn đăng (log WARN) |
| Migrate dữ liệu lỗi cũ | **Điều chỉnh** | Không ghi đè dữ liệu cũ: khi đọc, dòng có `error_code` NULL được chuẩn hoá **lúc đọc** bằng chính `PublishErrorRules.classifyLegacy(response_code, message, error_type)`; không khớp → UNKNOWN. An toàn, rollback được, không cần job |
| 3. Pre-flight: định dạng/dung lượng/tỷ lệ/thời lượng media, URL media | **Không cần (MVP)** | AIMA không upload media (FR-29 — chỉ media prompt); IG đã bị chặn ngay lúc lên lịch (2130). Độ dài caption/hashtag đã có `PlatformTextLimits` (cả lúc sửa lẫn lúc đăng) |
| Pre-flight token hết hạn trước khi đăng | **Giữ** | Worker: `token_expired_at` đã qua → lỗi `AUTH_TOKEN_EXPIRED` ngay, không gọi Meta, giữ các lịch khác + nhắc kết nối lại |
| Pre-flight scope | **Bỏ** | Cột `scopes` không đáng tin để chặn: Threads lưu scope cấu hình (không phải scope được cấp), quyền đăng Trang do Page task quyết định. Chặn sai = không đăng được bài hợp lệ. Lỗi thiếu quyền vẫn được phân loại `AUTH_PERMISSION_MISSING` + gom nhóm |
| Token health job + cảnh báo sắp hết hạn | **Đã có một phần → bổ sung** | `TokenHealthCheckJob` (refresh 7 ngày trước hạn) + `TokenValidationJob` đã có. Thêm: refresh thất bại tạm thời mà còn ≤ 3 ngày → thông báo "kết nối sắp hết hạn" (1 lần/kết nối/ngày hết hạn) |
| AI policy pre-check | **Hoãn (Phase 5)** | Cần endpoint AI mới + prompt + quyết định chi phí token (hạn mức gói). Xem §5 |
| 4. UX `/failed-posts` | **Giữ** | Dữ liệu thật; demo chỉ ở môi trường dev khi rỗng/mất kết nối (prod: empty state / lỗi + Thử lại); drawer chi tiết; hành động; timeline; mã tham chiếu + copy; gom theo nguyên nhân gốc; chọn nhiều; bộ lọc; tổng quan; xuất CSV (không message thô) |
| "AI sửa nội dung vi phạm" + diff | **Hoãn (Phase 5)** | Cùng lý do với AI pre-check. Hành động "Sửa nội dung" mở đúng bản nền tảng để sửa tay (`/create?view=<item>&edit=1`) rồi "Thử lại ngay" |
| 5. Thông báo chuông + email, gộp/chống trùng | **Giữ, điều chỉnh** | Thông báo không còn chứa message thô; lỗi cấp tài khoản (token/quyền/bị hạn chế) gộp **1 thông báo/tài khoản/mã/ngày** (`notifyOnce`); không báo khi đang auto retry (đã đúng). Email: chỉ cho lỗi cấp tài khoản + token sắp hết hạn, **mặc định TẮT** (`AIMA_PUBLISH_EMAIL_ENABLED`) để không gửi mail bất ngờ |
| Notification đa ngôn ngữ | **Không đổi** | Hệ thống notification hiện lưu câu tiếng Việt; chuyển sang key i18n là thay đổi xuyên suốt ngoài phạm vi. Câu thông báo mới lấy từ metadata của `PublishErrorCode` (một nguồn) |
| 6. Admin dashboard, top lỗi, xu hướng | **Giữ** | Mở rộng `/admin/posts/failed/summary`: top mã AIMA + phân bố nền tảng + tỷ lệ lỗi (lỗi / (lỗi + đã đăng)) |
| Hàng đợi chưa phân loại + ánh xạ trên UI | **Giữ (dạng ánh xạ)** | Xem dòng catalog DB ở trên |
| Tra cứu theo mã tham chiếu | **Giữ** | Ô tìm kiếm admin nhận `ERR-XXXXXX` |
| Thử lại thay user + audit | **Giữ** | `POST /admin/posts/failed/{postId}/retry` bắt buộc `reason`, ghi `activity_logs` |
| Phát hiện sự cố nền tảng | **Giữ, không bảng mới** | Tính từ `posting_jobs` 15 phút gần nhất (≥ N lỗi tạm thời từ ≥ M tài khoản / nền tảng, cấu hình được), cache 60s → đánh mã `PLATFORM_OUTAGE`, **hoãn retry** của nền tảng đó (không tiêu lượt retry), banner cho user |
| Phân quyền raw | **Giữ** | Endpoint admin `@PreAuthorize ADMIN` cấp lớp |
| 7. Redact dùng chung | **Giữ** | `util/SensitiveDataRedactor` (token/secret/Authorization/Cookie/JWT/chuỗi token dài/email/SĐT); `MetaApiClientImpl.mask` uỷ quyền sang đây |
| Log có cấu trúc / monitoring | **Không thêm** | Dự án chưa có công cụ monitoring; log hiện đã kèm jobId (= correlation id). Không thêm thư viện |
| Test | **Giữ** | JUnit: rules/normalizer (fixture theo tài liệu Meta), redact, worker retry/idempotency (MockWebServer), recovery service; FE: `node --test` cho catalog + gom nguyên nhân. FE không có setup test UI → không thêm |

### 2.1 Thư viện mới
Không thêm thư viện nào (BE dùng Jackson/WebClient sẵn có; FE dùng component sẵn có).

### 2.2 Vì sao notification vẫn là câu tiếng Việt từ backend
`notifications.title/message` là text thuần đã lưu, FE `NotificationBell` hiển thị nguyên văn; mọi loại thông báo khác (thanh toán, duyệt bài…) cũng vậy. Đổi riêng thông báo bài lỗi sang key i18n sẽ làm chuông có hai kiểu dữ liệu. Giữ nguyên kiểu cũ, nhưng câu chữ lấy từ một nguồn (`PublishErrorCode.notice*`) và tuyệt đối không ghép message thô.

### 2.3 Mã lỗi nền tảng đã kiểm chứng (tài liệu chính thức Meta)

Nguồn: [Graph API — Handling Errors](https://developers.facebook.com/docs/graph-api/guides/error-handling), [Graph API — Rate Limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting), [Threads API — Troubleshooting](https://developers.facebook.com/documentation/threads/troubleshooting).

| Graph code / subcode | Ý nghĩa (theo tài liệu) | Mã AIMA | Ghi chú so với danh sách đề xuất |
|---|---|---|---|
| 190 (không subcode), 190/463, 190/467, 102 | Token hết hạn / bị thu hồi / không hợp lệ | `AUTH_TOKEN_EXPIRED` | ✔ |
| 190/460 | Đổi mật khẩu | `AUTH_PASSWORD_CHANGED` | ✔ |
| 190/458 | User gỡ ứng dụng | `AUTH_APP_REMOVED` | ✔ |
| 190/459, 190/464 | Checkpoint / tài khoản chưa xác nhận — phải đăng nhập facebook.com | `ACCOUNT_CHECKPOINT` | mới |
| 190/492 | User của Page token không còn vai trò trên Trang | `AUTH_PAGE_ROLE_MISSING` | mới |
| 10, 200–299, 3 | Thiếu / mất quyền | `AUTH_PERMISSION_MISSING` | ✔ (+3) |
| **368** | "Temporarily blocked for policy violations" — **tạm chặn hành động**, khuyến nghị *chờ rồi thử lại* | `POLICY_TEMPORARY_BLOCK` | ⚠ Đề xuất coi 368 = vi phạm nội dung; thực tế là **tài khoản bị tạm chặn**. Vẫn KHÔNG tự retry (BR-07), giữ lịch của tài khoản như hiện tại |
| message chứa "policy"/"community standards" | Nội dung vi phạm | `POLICY_VIOLATION` | ✔ (giữ luật cũ) |
| 4, 17, 32, 613, 341, 80001–80014, HTTP 429 | Giới hạn tần suất | `RATE_LIMITED` (tự retry) | ✔ (+341, BUC) |
| **506** | Đăng trùng bài liên tiếp | `CONTENT_DUPLICATE` | ⚠ mới — code cũ xếp PERMANENT chung |
| 1609005 | Lỗi đọc link | `CONTENT_INVALID` | mới |
| 100 (khác 100/33) | Tham số không hợp lệ | `CONTENT_INVALID` | ✔ (đề xuất gộp media; AIMA không gửi media nên là nội dung/tham số) |
| 100/33 | Đối tượng không tồn tại / thiếu quyền | `AUTH_PERMISSION_MISSING` | mới |
| 1, 2, HTTP 5xx, `is_transient=true` | Lỗi tạm thời phía nền tảng | `PLATFORM_TEMPORARY` (tự retry) | ✔ |
| Threads container `error_message` = `FAILED_DOWNLOADING_VIDEO`, `INVALID_*`… | Media lỗi | `MEDIA_INVALID` | Chỉ để mở rộng (MVP không đăng media) |
| Threads giới hạn đăng (250 bài / 24h, `threads_publishing_limit`) | Hết hạn mức đăng | `QUOTA_EXCEEDED` (nhận diện theo message "publishing limit/quota" — **chưa có payload thật**, admin ánh xạ lại được) | — |

Mã nội bộ AIMA (không từ nền tảng): `TEXT_LIMIT_EXCEEDED` → `CONTENT_TOO_LONG`; `IG_MEDIA_REQUIRED` → `MEDIA_REQUIRED`; `ACCOUNT_TYPE` → `ACCOUNT_TYPE_UNSUPPORTED`; `NO_PUBLISHER` → `PLATFORM_UNSUPPORTED`; `NETWORK` → `NETWORK_TIMEOUT`; `STUCK_RUNNING` → `PUBLISH_INTERRUPTED`; `NO_CONTAINER` → `PLATFORM_TEMPORARY`; `INTERNAL` → `INTERNAL_ERROR`; tài khoản ngắt kết nối lúc nhận job → `ACCOUNT_DISCONNECTED`; token quá hạn phát hiện trước khi gọi → `AUTH_TOKEN_EXPIRED`.

---

## 3. Thiết kế cuối cùng

### 3.1 Catalog (`enums/PublishErrorCode`)

| Mã | Nhóm | Mức | Người xử lý | Tự retry | `PublishErrorType` cũ | Hành động (FE) | Cấp tài khoản |
|---|---|---|---|---|---|---|---|
| POLICY_VIOLATION | POLICY | ERROR | USER | – | POLICY_VIOLATION | EDIT_CONTENT, DISMISS | |
| POLICY_TEMPORARY_BLOCK | POLICY | CRITICAL | USER | – | POLICY_VIOLATION | OPEN_PLATFORM, RECONNECT_ACCOUNT, RETRY_NOW, DISMISS | ✔ |
| AUTH_TOKEN_EXPIRED | AUTH | CRITICAL | USER | – | PERMANENT | RECONNECT_ACCOUNT, RETRY_NOW, DISMISS | ✔ |
| AUTH_PASSWORD_CHANGED | AUTH | CRITICAL | USER | – | PERMANENT | RECONNECT_ACCOUNT, RETRY_NOW, DISMISS | ✔ |
| AUTH_APP_REMOVED | AUTH | CRITICAL | USER | – | PERMANENT | RECONNECT_ACCOUNT, RETRY_NOW, DISMISS | ✔ |
| AUTH_PERMISSION_MISSING | PERMISSION | CRITICAL | USER | – | PERMANENT | RECONNECT_ACCOUNT, RETRY_NOW, DISMISS | ✔ |
| AUTH_PAGE_ROLE_MISSING | PERMISSION | CRITICAL | USER | – | PERMANENT | OPEN_PLATFORM, RECONNECT_ACCOUNT, RETRY_NOW, DISMISS | ✔ |
| ACCOUNT_CHECKPOINT | ACCOUNT | CRITICAL | USER | – | PERMANENT | OPEN_PLATFORM, RECONNECT_ACCOUNT, RETRY_NOW, DISMISS | ✔ |
| ACCOUNT_RESTRICTED | ACCOUNT | CRITICAL | USER | – | PERMANENT | OPEN_PLATFORM, RECONNECT_ACCOUNT, RETRY_NOW, DISMISS | ✔ |
| ACCOUNT_DISCONNECTED | ACCOUNT | ERROR | USER | – | PERMANENT | RECONNECT_ACCOUNT, DISMISS | ✔ |
| ACCOUNT_TYPE_UNSUPPORTED | ACCOUNT | ERROR | USER | – | PERMANENT | CHANGE_ACCOUNT, DISMISS | |
| RATE_LIMITED | RATE_LIMIT | WARNING | SYSTEM | ✔ | TEMPORARY | RETRY_NOW, DISMISS | |
| QUOTA_EXCEEDED | QUOTA | WARNING | USER | – | PERMANENT | RETRY_NOW, DISMISS | |
| CONTENT_TOO_LONG | CONTENT | ERROR | USER | – | PERMANENT | EDIT_CONTENT, DISMISS | |
| CONTENT_DUPLICATE | CONTENT | ERROR | USER | – | PERMANENT | EDIT_CONTENT, DISMISS | |
| CONTENT_INVALID | CONTENT | ERROR | USER | – | PERMANENT | EDIT_CONTENT, DISMISS | |
| MEDIA_REQUIRED | MEDIA | ERROR | USER | – | PERMANENT | CHANGE_ACCOUNT, DISMISS | |
| MEDIA_INVALID | MEDIA | ERROR | USER | – | PERMANENT | EDIT_CONTENT, DISMISS | |
| PLATFORM_TEMPORARY | PLATFORM | WARNING | SYSTEM | ✔ | TEMPORARY | RETRY_NOW, DISMISS | |
| PLATFORM_OUTAGE | PLATFORM | WARNING | SYSTEM | ✔ | TEMPORARY | RETRY_NOW, DISMISS | |
| NETWORK_TIMEOUT | NETWORK | WARNING | SYSTEM | ✔ | TEMPORARY | RETRY_NOW, DISMISS | |
| PUBLISH_INTERRUPTED | NETWORK | WARNING | SYSTEM | ✔ | TEMPORARY | RETRY_NOW, DISMISS | |
| PLATFORM_UNSUPPORTED | INTERNAL | ERROR | SYSTEM | – | PERMANENT | CONTACT_SUPPORT, DISMISS | |
| INTERNAL_ERROR | INTERNAL | ERROR | SYSTEM | – | INTERNAL | RETRY_NOW, CONTACT_SUPPORT, DISMISS | |
| UNKNOWN | UNKNOWN | ERROR | SYSTEM | – | PERMANENT | RETRY_NOW, CONTACT_SUPPORT, DISMISS | |

Mã cần sửa nội dung (POLICY_VIOLATION, CONTENT_*, MEDIA_INVALID): khi bản nền tảng đã được sửa sau lần lỗi, server tự thêm `RETRY_NOW` ngay sau `EDIT_CONTENT` (`PublishRecoveryServiceImpl.actionsOf`).

`PublishErrorType` (cũ) giữ nguyên làm phân loại thô = `code.legacyType()` → các truy vấn/tab POLICY/TECHNICAL cũ và FE cũ vẫn chạy.

**Chặn "Thử lại ngay" phía server** (không tin FE): tài khoản phải còn kết nối + ACTIVE (`FAILED_POST_ACCOUNT_NOT_READY`); nhóm CONTENT/MEDIA_INVALID/POLICY_VIOLATION phải **sửa nội dung trước** (revision bản > revision trong snapshot) (`FAILED_POST_EDIT_REQUIRED`); MEDIA_REQUIRED / ACCOUNT_TYPE_UNSUPPORTED / PLATFORM_UNSUPPORTED không thử lại được (`FAILED_POST_NOT_RETRYABLE`).

### 3.2 Data model — Flyway `V13__publish_error_normalization.sql` (chỉ THÊM, không sửa/xoá)

```
posting_jobs  + error_code varchar(40)  CHECK (mọi giá trị PublishErrorCode)
              + platform_error_code varchar(50), platform_error_subcode varchar(50)
              + error_detail text               -- JSON đã redact, CHỈ admin
              + resolution varchar(20) CHECK (DISMISSED|RETRIED|CANCELLED)
              + resolved_at timestamptz, resolved_by uuid
              index (error_code, end_time desc) where status = 'FAILED'
publish_error_mappings (mới, BaseEntity) platform, platform_code, platform_subcode?, message_pattern?,
              error_code, note, updated_by_email; unique chữ ký where deleted_at is null
activity_logs.action CHECK  + POST_RETRIED, POST_FAILURE_DISMISSED, PUBLISH_ERROR_MAPPING_UPDATED
```

Rollback: `docs/sql/rollback/V13__publish_error_normalization_down.sql` (drop cột/bảng/constraint + xoá dòng `flyway_schema_history` version 13). Vì migration chỉ thêm cột nullable, **binary cũ vẫn chạy trên schema mới** (Hibernate validate chỉ kiểm cột đã map) → rollback app không bắt buộc rollback DB. CHECK `activity_logs` mới là tập cha của cũ.

### 3.3 Luồng xử lý

```
Meta lỗi ──► MetaApiClientImpl.toPublishException
              ├─ parse error.{code, error_subcode, type, message, error_user_title, error_user_msg, fbtrace_id, is_transient}
              ├─ headers Retry-After / X-Business-Use-Case-Usage (estimated_time_to_regain_access)
              └─ PublishException(legacyType, responseCode, message, PlatformErrorDetail)
worker ──► PublishErrorNormalizer.normalize(platform, exception)
              ├─ ánh xạ admin (cache 5 phút, evict khi sửa) ─┐
              ├─ PublishErrorRules (luật mặc định)          ├─► NormalizedPublishError(code, platformCode, subcode, retryAfter, detailJson)
              └─ sự cố nền tảng đang mở + lỗi tạm thời → PLATFORM_OUTAGE
saveFailure ──► job.{error_code, platform_*, error_detail(redact), error_type = code.legacyType()}
              ├─ code.autoRetry && retryCount < 3 → job RETRYING (5/15/30 phút + jitter, ≥ thời gian nền tảng yêu cầu)
              ├─ code cấp tài khoản → EXPIRED/ERROR + giữ lịch khác + notifyOnce/tài khoản/mã/ngày (+ email nếu bật)
              └─ còn lại → notification theo mã (không message thô)
retry (dispatch) ──► nếu lần trước lỗi mơ hồ → publisher.findPublished(since) → có bài khớp → SUCCESS, không đăng lại
```

### 3.4 API

User (`/me/failed-posts`, auth, scope theo chủ bài):

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/me/failed-posts?filter=&state=&page=&size=` | **Tương thích ngược**: `state` mặc định `NEEDS_ACTION` = đúng tập cũ. Giá trị: NEEDS_ACTION / AUTO_RETRYING / DISMISSED / ACTIVE / ALL. Response thêm: `code, category, severity, owner, autoRetry, actions[], params{}, platformSubcode, referenceCode, state, attempt, maxAttempts, nextRetryAt, contentVersionId, accountId, accountStatus, contentChanged`. `errorMessage` **luôn null** (deprecated — không trả message thô cho user) |
| GET | `/me/failed-posts/{postId}` | + `attempts[]` (timeline: lần, trạng thái, bắt đầu/kết thúc, mã AIMA, mã nền tảng, mã tham chiếu, hẹn thử lại) |
| GET | `/me/failed-posts/summary` | + `needsAction`, `autoRetrying`, `dismissed` (giữ `total/policyViolation/technical`) |
| POST | `/me/failed-posts/{postId}/retry` | Thử lại ngay (FAILED → SCHEDULED now → dispatch); guard §3.1; trả `jobId` hoặc lý do tạm giữ |
| POST | `/me/failed-posts/{postId}/dismiss` | Bỏ qua (idempotent) |
| POST | `/me/failed-posts/bulk` | `{action: RETRY|DISMISS, postIds[1..50]}` → kết quả từng dòng, mỗi dòng 1 transaction |
| GET | `/me/failed-posts/platform-status` | Sự cố nền tảng đang mở (banner) |

Admin (`/admin/posts/failed…`, ADMIN): list + `code`, `category`, `referenceCode`; `q` nhận `ERR-XXXXXX`; `GET /{postId}` (chi tiết + `rawError` đã redact + timeline); summary + `topCodes`, `byPlatform`, `postedTotal`, `incidents`; `POST /{postId}/retry` `{reason}`; `GET /unclassified?from&to`; `GET/POST/DELETE /admin/publish-error-mappings` (POST có `applyToExisting`).

Huỷ lịch hiện có (`DELETE /schedules/{id}`) đánh `resolution=CANCELLED` lên lỗi cuối khi lịch đang FAILED.

### 3.5 UI

User `/failed-posts`: hàng **tab theo vòng đời** (Cần xử lý · Đang tự thử lại · Đã bỏ qua) thay cho tab Policy/Technical (nhóm lỗi chuyển thành bộ lọc); banner sự cố nền tảng; **banner nguyên nhân gốc** ("3 bài lỗi vì token Instagram @aima.coffee hết hạn → Kết nối lại một lần"); bộ lọc nền tảng / tài khoản / nhóm lỗi / mã lỗi / khoảng ngày; bảng có checkbox + thanh hành động hàng loạt (Thử lại / Bỏ qua); dòng hiển thị **tiêu đề thân thiện** + nhóm + trạng thái vòng đời; modal chi tiết: *Chuyện gì đã xảy ra / Vì sao / Cách khắc phục từng bước* + nút theo `actions[]` + timeline các lần thử + mã tham chiếu (copy) + tab nội dung gốc; panel tổng quan theo nhóm lỗi + mã phổ biến (mã AIMA); xuất CSV (nhãn thân thiện + mã tham chiếu). Demo: chỉ `import.meta.env.DEV` khi rỗng/mất kết nối, có banner; prod rỗng → empty state, lỗi → khối lỗi + Thử lại.

Admin `/admin/posts`: lý do theo mã AIMA (bỏ suy từ khoá ở FE), khối "Phản hồi gốc" hiện `rawError` đã redact + mã tham chiếu + timeline; nút **Thử lại thay người dùng** (bắt buộc lý do); tab thứ ba **Chưa phân loại** (gom theo chữ ký, payload mẫu, form ánh xạ → mã AIMA, tuỳ chọn áp cho lỗi cũ); khối **Mã lỗi hàng đầu** + phân bố nền tảng + tỷ lệ lỗi; banner sự cố nền tảng.

---

## 4. File tạo/sửa theo phase

**Phase 1 — Nền móng**
- BE mới: `enums/{PublishErrorCode, PublishErrorCategory, PublishErrorSeverity, PublishErrorOwner, PublishErrorAction, FailureState, FailureResolution}`, `util/{SensitiveDataRedactor, PublishErrorRules, PublishReference}`, `dto/publish/{PlatformErrorDetail, NormalizedPublishError}`, `service/PublishErrorNormalizer` + `Impl`, `db/migration/V13__publish_error_normalization.sql`, `entity/PublishErrorMapping` + `repository/PublishErrorMappingRepository`, `docs/sql/rollback/V13__…_down.sql`.
- BE sửa: `exception/PublishException`, `entity/PostingJob`, `service/Impl/MetaApiClientImpl` (parse đầy đủ, `mask` → redactor), `service/Impl/PostPublishWorkerServiceImpl` (normalize + lưu + notification sạch), `mapper/{FailedPostMapper, AdminMonitorMapper, PostPublishMapper}`, các worker AI (L5), `enums/ActivityAction`.
- FE sửa: chặn L6–L9 tạm thời (dùng catalog), `api/publishErrorCatalog.ts` mới.
- Test: `PublishErrorRulesTest`, `SensitiveDataRedactorTest`, cập nhật `MetaApiClientImplTest`, `PostPublishWorkerIntegrationTest`, `PublishingMigrationTest` (đếm migration).

**Phase 2 — UX người dùng**
- BE: `service/PublishRecoveryService` + `Impl`, `FailedPostController/Service/Impl` (detail, retry, dismiss, bulk, state), DTO `FailedPostDetailResponse`, `FailedPostAttemptResponse`, `FailedPostBulkRequest/Response`, `PostRepository` (truy vấn theo state), `PostScheduleServiceImpl.cancel` (resolution), `ErrorCode` 2063–2067.
- FE: `api/failedPosts.ts`, `failedPostsMock.ts`, `pages/app/FailedPosts.tsx`, `components/failedPosts/*` (+ `RootCauseBanner`, `AttemptTimeline`, `BulkBar`, `rootCause.ts`), `i18n.ts`.
- Test: `FailedPostRecoveryIntegrationTest`, `tests/publishErrorCatalog.test.ts`, `tests/failedPostRootCause.test.ts`.

**Phase 3 — Độ tin cậy**
- BE: retry delay (jitter + hint), idempotency (`PlatformPublisher.findPublished`, `MetaApiClient.findRecentThreadsPosts`), pre-flight token, `TokenHealthCheckJob` cảnh báo sắp hết hạn, notification gộp (`NotificationService.notifyOnce` trả boolean), email tuỳ chọn (`EmailService.sendPublishActionRequiredEmail`, cờ `aima.notifications.publish-email-enabled`).
- Test: worker (Retry-After, idempotency, pre-flight), job token.

**Phase 4 — Admin & nâng cao**
- BE: `AdminMonitorController/Service/Impl` (detail, retry, unclassified, summary mở rộng, tra mã tham chiếu), `PublishErrorMappingController` + service, `PlatformIncidentService` + `Impl`, `PostingDispatchJob` hoãn retry khi sự cố.
- FE: `api/admin.ts`, `components/admin/posts/*` (+ `UnclassifiedQueue`, `MappingForm`, `TopCodesCard`), `pages/admin/Posts.tsx`, banner sự cố trang user.

---

## 5. Rủi ro, tương thích ngược, dữ liệu cũ

- **API cũ**: không đổi tên/xoá trường; chỉ thêm. `errorMessage` của `/me/failed-posts` trả null (FE cũ hiển thị "—" — chấp nhận để chặn lộ lỗi). `state` mặc định giữ tập cũ. `/admin/posts/failed` giữ tham số cũ.
- **Phân loại cũ ↔ mới**: `legacyType()` khớp luật cũ cho mọi trường hợp test hiện có; khác biệt có chủ đích: mã rate-limit/token kèm chữ "policy" giờ theo mã (đúng tài liệu), 506 → nội dung trùng.
- **Dữ liệu lỗi cũ**: không sửa DB; chuẩn hoá khi đọc. Mã tham chiếu tất định từ job id nên lỗi cũ cũng có.
- **Notification**: số lượng giảm do gộp theo tài khoản/ngày — chủ đích.
- **Idempotency**: kiểm tra trùng chỉ so nội dung + thời điểm; nếu user tự đăng tay đúng y nội dung trong khoảng đó, AIMA coi là đã đăng (chấp nhận, log rõ).
- **Sự cố nền tảng**: ngưỡng thấp có thể báo động giả → cấu hình `aima.publishing.outage.*`, chỉ hoãn retry chứ không huỷ.
- **Không chạy trên Supabase/production**: mọi kiểm chứng trên stack cô lập (`backend-boot-hazard`); áp V13 lên production do user làm theo runbook (backup trước).

**Hoãn sang Phase 5** (cần quyết định của user): "AI sửa nội dung vi phạm" (diff + duyệt) và "AI policy pre-check" — cần endpoint AI mới (`ai/`), prompt + đánh giá chất lượng, và quyết định token đó có tính vào hạn mức gói không.

---

## 6. Kế hoạch test

| Lớp | Test |
|---|---|
| Unit BE | `PublishErrorRulesTest` (mọi dòng bảng §2.3 + legacy), `SensitiveDataRedactorTest` (token query/JSON, Bearer, Cookie, JWT, EAA…, email, SĐT, không che id bài), `PublishErrorNormalizerImplTest` (ánh xạ admin thắng luật, cache), `PublishReferenceTest` |
| Client | `MetaApiClientImplTest`: subcode/fbtrace/is_transient/Retry-After/BUC header vào `PlatformErrorDetail`; message mạng không chứa URL |
| Worker (H2 + MockWebServer) | lưu error_code/detail đã redact; 190/463 → EXPIRED + giữ lịch + 1 thông báo/ngày; 506 không retry; Retry-After > 5 phút → nextRetryAt theo nền tảng; retry sau timeout mà bài đã có trên Trang → SUCCESS không POST lần 2; token quá hạn → không gọi Meta |
| Recovery | retry/dismiss/bulk: quyền sở hữu, guard tài khoản/sửa nội dung, idempotent, resolution |
| Migration (PG cô lập `-Disolated.postgres=true`) | `PublishingMigrationTest` đếm thêm V13, CHECK enum mới |
| FE (`npm test`) | catalog: mọi mã có vi/en, tham số được thay, mã lạ → UNKNOWN; gom nguyên nhân gốc |
| Build | `mvnw test`, `npm run build`, `npm test` sau mỗi phase |

---

## 7. Checklist

### Phase 1 — Nền móng
- [x] Enum catalog + `PublishErrorRules` + `PlatformErrorDetail`/`NormalizedPublishError` — 2026-10-11
- [x] `SensitiveDataRedactor` + `MetaApiClientImpl.mask` uỷ quyền — 2026-10-11
- [x] `MetaApiClientImpl` parse đầy đủ lỗi (subcode, user msg, fbtrace, transient, header chờ) + message mạng sạch — 2026-10-11
- [x] Flyway V13 + entity `PostingJob`/`PublishErrorMapping` + rollback script — 2026-10-11
- [x] `PublishErrorNormalizer` (ánh xạ DB + luật) + worker lưu mã chuẩn hoá — 2026-10-11
- [x] Chặn rò rỉ L1–L5, L10 (BE) — notification không message thô, AI worker message sạch — 2026-10-11
- [x] FE chặn L6–L8 bằng catalog (`publishErrorCatalog.ts`) — 2026-10-11
- [x] Test Phase 1 + build/test xanh — 2026-10-11

### Phase 2 — UX người dùng
- [x] `PublishRecoveryService` (retry/dismiss) + resolution khi huỷ lịch — 2026-10-11
- [x] API user: list theo state, detail + timeline, retry, dismiss, bulk, summary mở rộng — 2026-10-11
- [x] FE: dữ liệu thật + demo chỉ dev, tab vòng đời, bộ lọc, chọn nhiều + bulk, banner nguyên nhân gốc — 2026-10-11
- [x] FE: modal chi tiết (chuyện gì/vì sao/các bước, hành động, timeline, mã tham chiếu) — 2026-10-11
- [x] FE: tổng quan + mã phổ biến từ dữ liệu thật, xuất CSV sạch, i18n vi/en — 2026-10-11
- [x] Test Phase 2 + build/test xanh — 2026-10-11

### Phase 3 — Độ tin cậy
- [x] Retry: jitter + tôn trọng Retry-After / BUC `estimated_time_to_regain_access` — 2026-10-11
- [x] Idempotency trước khi retry lỗi mơ hồ (FB + Threads) — 2026-10-11
- [x] Pre-flight token quá hạn trước khi gọi nền tảng — 2026-10-11
- [x] Token sắp hết hạn → thông báo (1 lần) + email tuỳ chọn — 2026-10-11
- [x] Thông báo gộp theo tài khoản/mã/ngày, không message thô, gửi sau commit (`PublishFailureNotifier`, làm cùng Phase 1) — 2026-10-11
- [x] Email tuỳ chọn cho lỗi cấp tài khoản (mặc định tắt) — 2026-10-11
- [x] Test Phase 3 + build/test xanh — 2026-10-11

### Phase 4 — Admin & nâng cao
- [x] Admin: mã AIMA + mã tham chiếu + raw đã redact + timeline + tra `ERR-…` — 2026-10-11
- [x] Admin: thử lại thay user (lý do + audit) — 2026-10-11
- [x] Admin: top mã lỗi + phân bố nền tảng + tỷ lệ lỗi — 2026-10-11
- [x] Hàng đợi chưa phân loại + ánh xạ chữ ký → mã (áp lại lỗi cũ) — 2026-10-11
- [x] Phát hiện sự cố nền tảng: hoãn retry + banner user/admin — 2026-10-11
- [x] Test Phase 4 + build/test xanh — 2026-10-11 (BE 646 test, 15 lỗi = baseline có sẵn; PG 16/16; FE tsc + build + 39/39)
- [x] Cập nhật `docs/PLAN.md` + `backend/CLAUDE.md` + `frontend/CLAUDE.md` — 2026-10-11

### Phase 5 — AI sửa bài & kiểm tra chính sách → đã được duyệt, thiết kế + checklist ở §8

## 8. Đợt 2 — quyết định của chủ dự án (2026-10-11) & thiết kế

### 8.1 Quyết định đã chốt
| Mục | Quyết định |
|---|---|
| A1 AI sửa bài vi phạm | LÀM. Chỉ chạy khi người dùng bấm "AI sửa nội dung" trong chi tiết lỗi; chỉ nhóm policy/content; hiện diff caption cũ ↔ gợi ý, cho sửa lại rồi "Áp dụng & đăng lại" / "Áp dụng & lên lịch"; prompt = nội dung + nền tảng + mã lỗi + lý do đã chuẩn hoá + giọng thương hiệu; token tính vào "Token AI tháng này"; hết hạn mức → báo rõ, không gọi AI; giới hạn số lần mỗi bài. |
| A2 AI kiểm tra chính sách | LÀM, 2 tầng: (1) bộ luật/từ khoá miễn phí ở file cấu hình; (2) chỉ gọi AI khi tầng 1 có nghi vấn. Toggle trong Cài đặt, giới hạn theo gói, cache theo hash nội dung, CHỈ cảnh báo (mức độ, lý do, gợi ý, nút "AI sửa ngay"), tái dùng hạ tầng AI sẵn có (không SDK mới). |
| B `pages_read_engagement` | App Meta ĐÃ có quyền. Bước kiểm tra trùng qua `published_posts` không bao giờ bị bỏ qua khi lần thử trước mơ hồ; Page trả lỗi thiếu quyền → không retry mù, bài sang Cần xử lý với mã quyền + CTA "Kết nối lại", log rõ. Test 3 tình huống. |
| C Email opt-in | Email chỉ gửi khi `AIMA_PUBLISH_EMAIL_ENABLED=true` VÀ user đồng ý; preference theo user (`emailPublishErrors`, `emailPromptStatus`, `consentAt`); hỏi một lần ở /failed-posts; toggle trong Cài đặt → Thông báo; link huỷ nhận có chữ ký + hạn dùng, không cần đăng nhập, kèm `List-Unsubscribe` (+ `List-Unsubscribe-Post`); kiểm tra ở MỘT chỗ trong notifier trước khi gọi Brevo; user cũ mặc định false / NOT_ASKED. |

### 8.2 Thiết kế
**Dữ liệu — Flyway `V14__ai_policy_assist_and_email_consent.sql`** (rollback `docs/sql/rollback/V14__ai_policy_assist_and_email_consent_down.sql`):
- `user_notification_preferences` (user_id PK → users ON DELETE CASCADE, `email_publish_errors` false, `email_prompt_status` NOT_ASKED|ACCEPTED|DECLINED, `consent_at`, `updated_at`); backfill mọi user hiện có = false / NOT_ASKED.
- `user_publishing_settings.policy_check_enabled` boolean NOT NULL DEFAULT true (gói FREE có hạn mức lượt AI = 0 nên bật mặc định không tự tiêu token của user FREE — chỉ chạy tầng luật miễn phí).
- `ai_assist_jobs` (BaseEntity): `kind` POLICY_FIX|POLICY_CHECK, `status` PENDING|RUNNING|SUCCESS|FAILED, user, content_version, post (tuỳ chọn), platform, `error_code` (mã AIMA khi sửa bài lỗi), `content_hash` (sha256 nền tảng + nội dung đăng thật), `input_caption`, `result` (JSON), `error_message`, `applied_at`, client_ip/user_agent. Index (user, kind, created_at), (kind, content_hash), (content_version, kind).
- `AiTaskCode` + `POLICY_FIX`, `POLICY_CHECK` → cập nhật CHECK của `ai_task_routing`, `ai_usage`, `usage_daily`, `usage_hourly`. Định tuyến model cho 2 task mới được `AiConfigDataInitializer` seed như các task khác (admin đổi ở "Cấu hình AI").

**AI service** (`ai/src/agents/policy_assistant.py`, đi qua `invoke_structured` — không SDK mới): `POST /policy-fix` (brand + nền tảng + caption + hashtag + mã lỗi + lý do đã chuẩn hoá → caption/hashtag gợi ý + danh sách thay đổi) và `POST /policy-check` (nền tảng + nội dung + nghi vấn tầng 1 → mức rủi ro, tóm tắt, từng vấn đề kèm gợi ý). Lý do theo mã lỗi là câu cố định trong agent — KHÔNG gửi message thô của nền tảng.

**Backend**
- `PolicyRuleEngine` đọc `classpath:policy/policy-check-rules.json` (đổi bằng `aima.ai-assist.policy-check.rules-location`): mỗi luật = id, nhóm, mức độ, regex (không phân biệt hoa thường, tiếng Việt + Anh). Thêm luật = sửa file JSON, không sửa code.
- `AiAssistService` + worker async (`aiAssistExecutor`, mẫu ContentRegeneration: gọi AI ngoài transaction, `AiUsageService.recordCall` → token vào "Token AI tháng này").
  - Sửa bài: `POST /me/ai-assist/fixes` {contentVersionId, postId?} → chặn: bản đang đăng; bài lỗi không thuộc nhóm policy/content; không có bài lỗi và tầng 1 không nghi vấn; quá `fix-max-per-version` lần mỗi bản (mặc định 3); hết hạn mức token (mã có sẵn `TOKEN_QUOTA_EXCEEDED`); quá số tác vụ AI song song. `GET /me/ai-assist/jobs/{id}`; `POST /me/ai-assist/fixes/{id}/apply` {caption, hashtags, action SAVE|RETRY_NOW} → dùng lại `ContentItemService.updateVersion` (giới hạn ký tự, revision, bỏ duyệt) rồi `FailedPostService.retry` khi RETRY_NOW. "Áp dụng & lên lịch" = SAVE rồi FE huỷ lịch lỗi + mở bước 4 (giống "Đổi tài khoản").
  - Kiểm tra: `POST /me/ai-assist/policy-check` {contentVersionId} → tầng 1 đồng bộ; tầng 2 chỉ khi có nghi vấn + toggle bật + gói còn lượt (`ai-monthly-limit` FREE 0 / PLUS 30 / PRO 200 lượt/tháng) + còn token → tạo job (cache: cùng hash đã có kết quả thì trả luôn). Trả `aiStatus` NOT_NEEDED|DISABLED|PLAN_NOT_INCLUDED|LIMIT_REACHED|QUOTA_EXCEEDED|PENDING|RUNNING|DONE|FAILED.
  - Hành động mới `PublishErrorAction.AI_FIX` cho POLICY_VIOLATION + CONTENT_* (server quyết định nút có hiện không).
- B: `alreadyPublished` bỏ hành vi "kiểm tra lỗi thì vẫn đăng": thiếu quyền (Graph 10/200–299) → `AUTH_PERMISSION_MISSING` (mã gốc `VERIFY_PERMISSION`, không retry, CTA Kết nối lại); token chết → `AUTH_TOKEN_EXPIRED`; lỗi tạm thời khi kiểm tra → lỗi tạm thời (thử lại theo FR-56, KHÔNG đăng mù). Cửa sổ kiểm tra 24h → 7 ngày (thử lại tay sau một ngày vẫn được kiểm tra).
- C: `NotificationPreferenceService` (GET/PUT `/users/me/notification-preferences`), `EmailUnsubscribeTokens` (HMAC-SHA256, payload userId + hạn, `aima.notifications.unsubscribe-secret`; rỗng → khoá suy ra từ `jwt.signerKey` có tiền tố riêng), endpoint public `POST /notifications/unsubscribe?token=` (nhận cả one-click `List-Unsubscribe=One-Click`). `PublishFailureNotifierImpl.email` là chỗ DUY NHẤT gọi `EmailConsentPolicy.shouldSend(serverEnabled, preference)` trước Brevo; email có link huỷ nhận + header `List-Unsubscribe` / `List-Unsubscribe-Post` (Brevo nhận `headers` tuỳ ý). Người dùng đã đồng ý nhận thêm tối đa 1 email/ngày cho bài lỗi cần xử lý (ngoài email lỗi cấp tài khoản).

**Frontend**: `api/aiAssist.ts`, `api/notificationPreferences.ts`; `components/aiAssist/{AiFixModal, PolicyCheckNotice, textDiff.ts}`; nút "AI sửa nội dung" (action AI_FIX) trong chi tiết lỗi; cảnh báo chính sách dưới mỗi nền tảng ở bước lên lịch (SchedulePlanner); banner hỏi email ở /failed-posts; Cài đặt → Thông báo (email lỗi đăng bài), Cài đặt → Đăng bài (toggle kiểm tra chính sách); trang public `/unsubscribe`.

**Cấu hình mới**: `AIMA_EMAIL_UNSUBSCRIBE_SECRET`, `AIMA_EMAIL_UNSUBSCRIBE_TTL_DAYS` (60), `AIMA_PUBLIC_API_BASE_URL` (URL backend công khai cho one-click), `AIMA_AI_FIX_MAX_PER_VERSION` (3), `AIMA_POLICY_CHECK_AI_LIMIT_FREE/PLUS/PRO` (0/30/200), `AIMA_POLICY_CHECK_CACHE_DAYS` (30).

**Rủi ro**: tầng luật có thể báo nhầm (chỉ cảnh báo, không chặn); AI có thể gợi ý sai → người dùng luôn xem diff và tự áp dụng; hai task AI mới dùng model mặc định khi seed — admin nên xem lại ở "Cấu hình AI".

### 8.3 Checklist đợt 2
#### Phase 5 — AI sửa bài & kiểm tra chính sách
- [x] V14 + rollback; enum/entity/repository; cập nhật PublishingMigrationTest — 2026-10-11
- [x] AI service: agent `policy_assistant` + `/policy-fix` + `/policy-check` + pytest — 2026-10-11
- [x] Backend: PolicyRuleEngine + file luật; AiAssistService/worker; API fixes/jobs/apply/policy-check; action AI_FIX; test — 2026-10-11
- [x] FE: AiFixModal (diff + sửa + áp dụng), nút trong chi tiết lỗi, PolicyCheckNotice ở bước lên lịch, toggle Cài đặt → Đăng bài; i18n vi/en; test diff — 2026-10-11
#### Phase 6 — Kiểm tra trùng bài luôn chạy (B)
- [x] `alreadyPublished`: thiếu quyền → Cần xử lý (AUTH_PERMISSION_MISSING), lỗi tạm → retry, không đăng mù; cửa sổ 7 ngày — 2026-10-11
- [x] Test: bài đã có / chưa có / thiếu quyền — 2026-10-11
#### Phase 7 — Email opt-in (C)
- [x] Preference + API + toggle Cài đặt → Thông báo + banner hỏi ở /failed-posts — 2026-10-11
- [x] Token huỷ nhận + endpoint public + trang /unsubscribe + header List-Unsubscribe — 2026-10-11
- [x] Kiểm tra đồng ý ở một chỗ trong notifier; test quyết định gửi + token hợp lệ/hết hạn/bị sửa — 2026-10-11
#### Phase 8 — Hoàn tất
- [x] Lint/typecheck/test/build xanh; cập nhật PLAN.md + CLAUDE.md — 2026-10-12

### 8.4 Kết quả đợt 2 (hoàn tất 2026-10-12)
- Backend: toàn bộ suite 676 test, 15 lỗi = baseline có sẵn (8 AccountManagement + 5 BrandProfile + 2 SubscriptionLifecycle); test chỉ-PG 17/17 (gồm `v14AddsAiAssistJobsEmailConsentAndTaskCodes`). AI service 65/65. FE: tsc sạch, 44/44, build OK.
- E2E trên stack cô lập (stub AI/Brevo/Meta, cổng 58080): V14 áp lên DB; banner hỏi email → bật; AI sửa bài vi phạm → diff → sửa tay → "Áp dụng & đăng lại" (caption lưu bản đã duyệt, lần cũ RETRIED, đúng 1 job/1 lần gọi AI, 1.650 token ghi `ai_usage` task POLICY_FIX); hết token → kiểm tra trả QUOTA_EXCEEDED, không gọi AI; bước 4 lên lịch: bộ luật → AI → "Rủi ro cao" + gợi ý → "AI sửa ngay" → áp dụng → kiểm tra lại "không thấy dấu hiệu" (1 lần gọi kiểm tra nhờ cache hash dù StrictMode/poll); email gửi kèm `List-Unsubscribe` + `List-Unsubscribe-Post`; trang /unsubscribe và one-click POST tắt email; toggle Cài đặt → Đăng bài tắt → `DISABLED`.
- Sửa thêm khi E2E: token huỷ nhận đổi ký tự cuối (chỉ khác bit đệm base64) từng được chấp nhận → nay so chuỗi chữ ký dạng chuẩn (test duyệt mọi ký tự cuối).

## 9. Giới hạn AI theo gói thay cho env cứng theo tên gói (2026-10-12)

### 9.1 Khảo sát (trước khi sửa)
- `AiAssistServiceImpl` đọc `aima.ai-assist.policy-check.ai-monthly-limit.free|plus|pro` (env `AIMA_POLICY_CHECK_AI_LIMIT_FREE/PLUS/PRO`)
  và chọn bằng `switch` trên enum `UserPlan` (FREE/PLUS/PRO) lấy từ **nhãn** `User.plan`. Gói admin tự tạo (vd TEAM) không có
  giá trị enum → `SubscriptionServiceImpl.syncPlanLabel` giữ nhãn cũ → user mua TEAM vẫn bị tính theo lượt của gói cũ. `aima.ai-assist.fix-max-per-version`
  là một số chung cho mọi gói. ⇒ Nhận định "giới hạn bị code cứng theo 3 gói qua env" là **đúng**.
- Module gói: `plans` (`entity/Plan`, admin `PlanAdminController` `/admin/plans` + trang `pages/admin/Plans.tsx`), gói hiện tại =
  `subscriptions.plan_id` (`SubscriptionService.getOrCreate`; `User.plan` chỉ là nhãn cache). Trường giới hạn có sẵn: `monthly_token_limit`
  (null = không giới hạn, đã theo gói — `TokenUsageService`), `token_quota` (chỉ hiển thị).
- Chỗ khác (giữ nguyên trong đợt này, ghi nhận): `TokenUsageService.MAX_CONCURRENT_AI_JOBS = 3` (bảo vệ hệ thống — giữ cấu hình chung);
  so `"FREE"` trong `SubscriptionServiceImpl`/`PaymentServiceImpl`/`PlanDataInitializer` (FREE là gói lõi bất biến, dùng làm gói hạ cấp — hợp lệ);
  FE so `'FREE'|'PLUS'|'PRO'` chỉ để hiển thị nhãn/badge/nút nâng cấp (`UserMenu`, `Profile`, `Sidebar`, `UsageTab`, `admin/Users`, `UserPlanTab`) — nên
  đọc tên gói từ API ở đợt sau; bảng so sánh seed ghi "1 hồ sơ thương hiệu", "Kết nối 1 nền tảng", "5 bài viết AI" nhưng backend **không chặn**
  các giới hạn đó — cần chủ dự án chốt giá trị trước khi thêm cột (không tự đoán giá trị nghiệp vụ).

### 9.2 Thiết kế
- Flyway `V15__plan_ai_assist_limits.sql` (rollback `docs/sql/rollback/V15__plan_ai_assist_limits_down.sql`): `plans.policy_check_ai_monthly_limit`,
  `plans.ai_fix_max_per_version` (integer, CHECK ≥ −1). Quy ước: **null = mặc định hệ thống, −1 = không giới hạn, 0 = tắt, > 0 = số lượt**
  (khác `monthly_token_limit` có sẵn: null = không giới hạn — không đổi cột cũ). Backfill FREE 0 / PLUS 30 / PRO 200; AI sửa để null (= mặc định 3 như trước).
  `PlanDataInitializer` seed cùng giá trị cho DB mới (V15 chạy trước khi có dòng gói).
- Không thêm cờ bật/tắt riêng: 0 = tắt — một nguồn sự thật; UI admin trình bày dạng chọn chế độ (Mặc định / Giới hạn N / Không giới hạn / Tắt).
- `PlanLimitService` (+`Impl`) — nơi DUY NHẤT quy đổi: gói lấy từ subscription (không theo nhãn), cột null → env cũ cùng mã gói (deprecated) → mặc định
  `AIMA_POLICY_CHECK_AI_LIMIT_DEFAULT` (0) / `AIMA_AI_FIX_MAX_PER_VERSION` (3). Hạn mức token giữ ở `TokenUsageService` (đã theo gói, gắn kỳ tính usage).
- API: `GET /me/ai-assist/usage` (đã dùng/tổng lượt AI kiểm tra tháng này + số lần AI sửa mỗi bản); `GET /admin/plans` thêm `limitDefaults`;
  ErrorCode `PLAN_AI_LIMIT_INVALID` 2176, `AI_FIX_NOT_IN_PLAN` 2198. `PolicyCheckResponse.aiChecksLimit` null = không giới hạn.
- FE: form gói (tab Cơ bản) + dòng tóm tắt trên thẻ gói; Cài đặt → Đăng bài hiện lượt đã dùng/tổng + nút "Nâng cấp gói"; cảnh báo chính sách và modal AI sửa
  gợi ý nâng gói khi gói không gồm / hết lượt.

### 9.3 Checklist
- [x] V15 + rollback + PublishingMigrationTest (`v15AddsPlanAiLimitsAndBackfillsCorePlansWithOldEnvValues`, cập nhật số migration) — 2026-10-12
- [x] Entity/DTO/validate (−1…100000) + `PlanLimitService` + AiAssistService dùng service + `GET /me/ai-assist/usage` — 2026-10-12
- [x] Env: `AIMA_POLICY_CHECK_AI_LIMIT_DEFAULT` mới; `_FREE/_PLUS/_PRO` deprecated (vẫn đọc, WARN khi khởi động); `.env.example` — 2026-10-12
- [x] Test: `PlanLimitServiceImplTest` (có giá trị / null→mặc định / −1 / 0 / gói tự tạo / không subscription / không gói / env cũ / cấu hình sai),
      `AiAssistIntegrationTest.customPlan_limitsComeFromSubscriptionPlan_notFromLabel`, `PlanTokenLimitTest` — 2026-10-12
- [x] FE admin Gói + Cài đặt → Đăng bài + nâng gói ở PolicyCheckNotice/AiFixModal; i18n vi/en — 2026-10-12
- [ ] Áp V15 lên production + xoá 3 biến env cũ — người vận hành (xem 9.4)
- [ ] (Đợt sau, cần chốt giá trị) giới hạn số hồ sơ thương hiệu / số kết nối mạng xã hội / bài AI mỗi tháng theo gói; FE bỏ so mã gói khi hiển thị nhãn

### 9.4 Triển khai production
1. Backup DB. Deploy backend (Flyway tự chạy V15 — chỉ thêm cột + backfill, binary cũ vẫn chạy trên schema mới).
2. Deploy FE **cùng lúc**: PUT `/admin/plans/{id}` là full update, FE cũ không gửi 2 trường mới → admin sửa gói bằng FE cũ sẽ đưa gói về "Mặc định".
3. Đặt `AIMA_POLICY_CHECK_AI_LIMIT_DEFAULT` (mặc định 0) nếu muốn khác; xoá `AIMA_POLICY_CHECK_AI_LIMIT_FREE/PLUS/PRO` (log WARN "DEPRECATED" nếu còn).
4. Kiểm: `select code, policy_check_ai_monthly_limit, ai_fix_max_per_version from plans;` → FREE 0 / PLUS 30 / PRO 200, AI sửa null. Gói admin tự tạo đang
   null → dùng mặc định (0 = không có AI kiểm tra) — admin vào "Quản lý gói" đặt giá trị cho từng gói.
5. Rollback: chuyển binary về bản trước, đặt lại 3 biến env cũ (0/30/200), chạy script rollback V15.
