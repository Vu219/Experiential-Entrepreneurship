# Kế hoạch: Trang Phân tích dùng dữ liệu thật từ Meta

> Trạng thái: **ĐÃ DUYỆT 2026-10-06** (kèm quyết định ở mục D bên dưới) · **Giai đoạn 0: code xong 2026-10-06, chờ kiểm tra với Meta thật (mục D.2)** · Giai đoạn 1: chưa bắt đầu
> Ngày khảo sát: 2026-10-06 · Phạm vi đợt này: **chỉ Facebook Page**. Instagram/Threads làm sau, nhưng kiến trúc chuẩn bị sẵn
> Đọc kèm: `docs/Analytics.md` (v1), `docs/Analytics-v2.md` (v2, mục "TIẾN ĐỘ & BÀN GIAO")

---

## D. Quyết định đã chốt (2026-10-06)

> **Mục này thắng mọi chỗ khác trong tài liệu khi mâu thuẫn.**

**Phạm vi**
- Đợt này **chỉ làm Facebook Page** (đã kết nối được).
- Instagram và Threads làm sau, nhưng phải chuẩn bị sẵn kiến trúc:
  - **Schema không phụ thuộc nền tảng:**
    - có cột `platform`;
    - các cột metric dùng chung `views, reactions, comments, shares, saves, reach` **đều cho phép NULL**;
    - cột `raw` jsonb giữ metric riêng của từng nền tảng.
    - Bảng mới **gọi là `reactions`**, không dùng `likes`.
    - Riêng `post_analytics` cũ giữ tên cột `likes` (không đổi tên khi chưa hỏi), nhưng **giá trị là tổng mọi cảm xúc** từ Giai đoạn 0.
  - **Interface thu số liệu chung** (Giai đoạn 1): `PlatformMetricsProvider`, gồm:
    - `fetchPostMetrics(account, mediaIds)`;
    - `fetchAccountMetrics(account, from, to)`;
    - `listPublishedPosts(account, since)`.
    - Chỉ cài `FacebookMetricsProvider`. `InstagramMetricsProvider` / `ThreadsMetricsProvider` là stub ném `UnsupportedOperationException`, kèm `TODO`.
- **Không thuộc phạm vi:** sửa `IG_MEDIA_REQUIRED` (đăng bài IG); sửa `refresh()` của Threads.
  - Job thu số liệu Threads cũ **giữ nguyên hành vi**, chỉ được hưởng cơ chế dừng gọi lại vô hạn.

**Trả lời 8 câu hỏi**

| # | Quyết định |
|---|---|
| Q1 Instagram | Chưa làm, chỉ chuẩn bị adapter |
| Q2 Threads | Chưa làm, chỉ chuẩn bị adapter |
| Q3 Quyền Meta | ⏳ **Chờ anh/chị điền**: danh sách quyền trong Login configuration, chế độ app (Development/Live), Business Verification. Quyền cần cho phần **đọc số liệu Facebook**: `pages_show_list`, `pages_read_engagement`, **`read_insights`**, và `business_management` nếu Page nằm trong Business Manager. `pages_manage_posts` để đăng bài. Đọc bài ngoài AIMA ở giai đoạn 2 vẫn chỉ cần `pages_read_engagement` |
| Q4 Ngữ nghĩa | KPI + biểu đồ theo ngày = **số phát sinh trong kỳ** (delta). Top bài viết, heatmap, **hiệu suất theo loại nội dung** = **bài đăng trong kỳ**, có chú thích/tooltip giải thích. **ER = (reactions + comments + shares) / views × 100**, không cộng `saves`. Hiện "—" khi views = 0 hoặc null |
| Q5 Bài ngoài AIMA | Giai đoạn 2. **Mặc định hiển thị toàn bộ Page**, có bộ lọc "Chỉ bài AIMA" |
| Q6 `post_analytics` | Giữ mốc 24h/48h/7 ngày nhưng **tính từ bảng snapshot**, không gọi API riêng (Giai đoạn 1) |
| Q7 Lưu trữ | Snapshot thô 180 ngày, số theo ngày giữ vĩnh viễn |
| Q8 Kiểm thử | Page test: ⏳ **chờ anh/chị điền tên**. Cho phép job **chỉ đọc** gọi Meta từ môi trường test |

**Cách làm**
- Mỗi giai đoạn **commit riêng**, có migration rõ ràng, **không xoá dữ liệu cũ khi chưa hỏi**.
- Xong Giai đoạn 0 thì dừng, báo cách kiểm tra (đối chiếu với Meta Business Suite), chờ duyệt rồi mới sang Giai đoạn 1.

### D.1 Thiết kế chi tiết Giai đoạn 0

1. **Metric Facebook** (`MetaApiClientImpl.getFacebookPostMetrics`):
   - `fields=reactions.summary(total_count).limit(0),comments.summary(true).limit(0),shares` thay cho `likes.summary(true)`.
     Đếm mọi cảm xúc, `limit(0)` để không tải danh sách người thả.
   - Insights đổi `metric=post_impressions` (đã khai tử) → **`post_media_view`**.
   - Thiếu `read_insights` (mã 10/200–299) → `views = null`, vẫn lưu reactions/comments/shares.
   - Lỗi khác của insights (rate limit, token, lỗi tạm) **ném ra** để cả mốc được thu lại sau, không lưu snapshot thiếu views vĩnh viễn.
   - Lỗi 100 không phải subcode 33 (thường là metric bị khai tử) → `views = null` + log ERROR.
2. **Phân loại lỗi:** exception mới `MetricsFetchException(type, graphCode, subcode)` chỉ dùng cho luồng thu số liệu.
   Luồng OAuth/đăng bài **không đổi**.

   | Loại | Mã Graph | Xử lý ở job |
   |---|---|---|
   | `NOT_FOUND` | 100 + subcode 33 | Lần 1: `platform_status = UNAVAILABLE`, thử lại sau 24 giờ. Lần 2 liên tiếp: `DELETED` + `sync_status = STOPPED`. Số liệu cũ giữ nguyên, **không đổi trạng thái bài** |
   | `RATE_LIMIT` | 4, 17, 32, 613, 80001, 80002 | **Dừng cả lượt quét ngay**. Bài đó thử lại sau 1 giờ. Không tính là lỗi liên tiếp |
   | `PERMISSION` | 10, 200–299 | Thử lại sau 24 giờ, tính lỗi liên tiếp |
   | `TOKEN_INVALID` | 190, 102 | Thử lại sau 24 giờ, tính lỗi liên tiếp. Việc đổi trạng thái kết nối vẫn do `TokenValidationJob` lo như cũ |
   | `UNSUPPORTED` | — (Instagram chưa có thu số liệu) | `STOPPED` ngay |
   | `TEMPORARY` | 1, 2, 5xx, mạng, mã khác, lỗi nội bộ | Backoff `min(2^(n−1) giờ, 24 giờ)`, tính lỗi liên tiếp |

   Lỗi liên tiếp đạt **8 lần** → `STOPPED` + log WARN (khoảng 4–8 ngày, quá mốc 7 ngày). Thành công thì reset về 0.
3. **Lưu trạng thái: Flyway V6 tạo `platform_media`.**
   - Đây là bảng của thiết kế cuối (mục 3.1); Giai đoạn 0 dùng phần cột trạng thái đồng bộ của nó. Lý do không thêm cột tạm
     vào `posts`: Giai đoạn 1/2 sẽ phải chuyển dữ liệu rồi xoá cột, trái nguyên tắc "không xoá dữ liệu cũ".
   - Các cột `media_type`, `permalink`, `caption_excerpt` thêm ở Giai đoạn 1 (`ALTER … ADD`, không phá dữ liệu).
   - V6 backfill một dòng cho mỗi bài POSTED có `platform_post_id` (`origin = AIMA`).
   - Bài mới đăng sau migration được job tạo dòng khi thu lần đầu.
   - Truy vấn bài đến hạn bỏ qua dòng có `sync_status <> ACTIVE` hoặc `next_sync_at > now`.
4. **Mock 194.2%:** tính ER của mock từ chính `dailyPoints` (`Σ(likes+comments+shares) / Σ views`), cùng nguồn với KPI.
5. **Chú thích ER trên UI:** câu "bài Facebook bị loại do nền tảng không trả lượt xem" không còn đúng → đổi thành
   "bài chưa có lượt xem (chưa có quyền `read_insights` hoặc nền tảng chưa trả số)".

### D.2 Cách kiểm tra Giai đoạn 0 với Meta thật

**Chuẩn bị**
1. Meta Dashboard → Facebook Login for Business → configuration đang dùng (`META_FACEBOOK_CONFIG_ID`):
   - thêm **`read_insights`** (cần sẵn `pages_show_list`, `pages_read_engagement`);
   - app ở Development thì tài khoản Facebook test phải có vai trò trong app.
2. AIMA → Cài đặt → **kết nối lại Facebook**, để token Page nhận quyền mới.
   - Kiểm: `select scopes from platform_accounts where platform_name='FACEBOOK' and account_type='USER' and deleted_at is null;` có `read_insights`.
3. ⚠️ **Áp V6:** backend khởi động sẽ tự chạy Flyway trên DB trong `.env`.
   - Với Supabase/production: làm theo `docs/SCHEDULING_PRODUCTION_RUNBOOK.md` (backup trước). V6 chỉ tạo bảng mới + backfill, không sửa/xoá dữ liệu cũ.
   - Nhớ backend thật cũng bật `PostingDispatchJob` (đăng bài đến hạn).

**A. Kiểm ngay, không cần chờ job** — Graph API Explorer, chọn app AIMA + **Page access token** của Page test:
```
GET /v25.0/{platform_post_id}?fields=reactions.summary(total_count).limit(0),comments.summary(true).limit(0),shares
GET /v25.0/{platform_post_id}/insights?metric=post_media_view
```
- `platform_post_id` lấy từ bảng `posts`.
- So với **Meta Business Suite → Nội dung → bài viết → Thông tin chi tiết**: Lượt xem ↔ `post_media_view`,
  Cảm xúc ↔ `reactions.total_count`, Bình luận, Lượt chia sẻ.
- Insights trả `(#10)` hoặc `(#200)` → chưa có `read_insights`.

**B. Kiểm qua job**
1. Đăng một bài test lên Page qua AIMA.
2. Sau ≥ 24h (job chạy mỗi giờ, lần đầu ngay khi khởi động), chạy:
   ```sql
   select a.milestone_hours, a.views, a.likes as reactions, a.comments, a.shares, a.collected_at
   from post_analytics a join posts p on p.id = a.post_id where p.platform_post_id = '<id>' order by 1;
   select platform_status, sync_status, consecutive_failures, last_error_code, next_sync_at, last_synced_at
   from platform_media where platform_media_id = '<id>';
   ```
3. Đối chiếu với Business Suite cùng thời điểm. Lệch nhỏ là bình thường:
   - lượt xem FB trễ 24–48h;
   - `comments.summary` mặc định chỉ đếm **bình luận cấp 1**, Business Suite có thể tính cả phản hồi. Nếu lệch đúng phần này, có thể đổi sang `filter(stream)` (cần duyệt).
4. ⚠️ **Bài cũ đã đủ 3 mốc sẽ không được thu lại** (views của chúng vẫn null từ trước). Giai đoạn 1 sẽ đồng bộ lại số tích luỹ.

**C. Kiểm "ngừng gọi lại"**
1. Xoá một bài test trên Page.
2. Lần quét kế tiếp: `platform_status = UNAVAILABLE`, `next_sync_at` ≈ +24h.
3. 24h sau: `DELETED` + `STOPPED`, log `[AnalyticsCollection] Ngừng thu số liệu bài …`. Bài trong AIMA vẫn `POSTED`.

**D. Trang /analytics**
- Tài khoản chưa có số thật: thẻ "Tỷ lệ tương tác TB" ở chế độ mẫu khoảng 11–12% (trước là 194.2%).
- Có số thật: tỷ lệ tính cả bài Facebook có lượt xem.

---

## 0. Tóm tắt

1. **Phần lớn khung đã có sẵn, không làm lại từ đầu.** Có slice `/analytics/*` (9 endpoint), job `AnalyticsCollectionJob`
   thu số liệu lúc 24h/48h/168h vào bảng `post_analytics`, và màn hình v2 đã hoàn chỉnh. Trang hiện ra "Dữ liệu mẫu"
   vì tài khoản **chưa từng có số liệu thật nào khác 0**, chứ không phải vì thiếu API.
2. **Facebook không bao giờ có lượt xem thật.** Code đang gọi metric `post_impressions`, mà Meta đã **khai tử
   metric này ngày 15/11/2025**. Lời gọi luôn lỗi nên `views = null` → KPI "Lượt xem" bằng 0 và tỷ lệ tương tác không
   tính được với Facebook. Ngoài ra scope hiện tại **không có `read_insights`**.
3. **Con số 194.2% là lỗi trong dữ liệu mẫu ở frontend** (`frontend/src/api/analyticsMock.ts`), không phải công
   thức backend. Tử số lấy từ bộ sinh heatmap (không phụ thuộc số ngày), còn mẫu số lấy từ bộ sinh lượt xem theo ngày.
   Kết quả: 7 ngày ra 194.2%, 1 ngày ra 1837%, 90 ngày ra 8.5%. Công thức backend đúng (lấy tổng chia tổng).
4. **Instagram hiện chưa đăng được bài nào.** `InstagramPublisherImpl` luôn ném `IG_MEDIA_REQUIRED`, và `getPostMetrics`
   ném lỗi với IG. Phần này mâu thuẫn với đề bài → **cần anh/chị xác nhận** (mục 4, Q1).
5. **Hướng đề xuất:**
   - Thêm 4 bảng: bản ghi media trên nền tảng, snapshot số tích luỹ, tổng hợp delta theo ngày, insights cấp tài khoản.
   - Một job đồng bộ gom theo tài khoản: tần suất thưa dần theo tuổi bài, dùng Batch API, đọc header rate limit,
     backoff, phân loại lỗi.
   - Viết lại truy vấn `/analytics/*` để đọc bảng theo ngày.
   - Bổ sung trạng thái UI: đang đồng bộ / thiếu quyền / IG không phải tài khoản chuyên nghiệp.
   - Webhook để sau, giai đoạn đầu chỉ cần polling.

---

## 1. Khảo sát codebase (Bước 1)

### 1.1 OAuth / kết nối tài khoản

| Hạng mục | Hiện trạng | Vị trí |
|---|---|---|
| Kiểu đăng nhập FB/IG | **Facebook Login** (`facebook.com/{v}/dialog/oauth`). IG Business được tìm qua Page. **Không** dùng Instagram Login (`graph.instagram.com`) | `MetaOAuthServiceImpl.java:78-113` |
| Facebook Login for Business | Có `META_FACEBOOK_CONFIG_ID` (đã đặt trong `.env`) → **không gửi `scope`**. Quyền thật do *configuration* trên Meta Dashboard quyết định | `MetaOAuthServiceImpl.java:104-108` |
| Scope dự phòng (`META_FACEBOOK_SCOPES`) | `pages_show_list, pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish, business_management, pages_manage_metadata` | `backend/.env` |
| Scope Threads | `threads_basic, threads_content_publish, threads_manage_insights` | `backend/.env` |
| Quyền bắt buộc khi callback | Chỉ kiểm `pages_show_list`, `pages_manage_posts` (đọc `/me/permissions`). **Không kiểm quyền insights nào** | `MetaOAuthServiceImpl.java:70,158-163` |
| Threads | **Đã có OAuth riêng đầy đủ** (`threads.net/oauth/authorize`, `th_exchange_token`, `/me`) | `MetaOAuthServiceImpl.java:85-93,214-225` |
| Lưu token | Bảng `platform_accounts`, mỗi dòng một token: `access_token` và `refresh_token` mã hoá AES-256-GCM (`EncryptedStringConverter` → `CryptoUtil`), cùng `token_type`, `token_issued_at`, `token_expired_at`, `scopes` (JSON quyền **thực được cấp** với FB/IG; với Threads là chuỗi cấu hình, không kiểm) | `entity/PlatformAccount.java` |
| Liên kết IG ↔ Page | Dòng INSTAGRAM có `platform_account_id` = IG user id, `parent_connection_id` → dòng PAGE, và dùng **token của Page** | `MetaOAuthServiceImpl.java:200-209` |
| Long-lived token | FB: `fb_exchange_token` → user token sống lâu → `/me/accounts` lấy page token (`expiry = null`, coi như không hết hạn). Threads: `th_exchange_token` (60 ngày) | `MetaApiClientImpl.java:92-143` |
| Làm mới token | `TokenHealthCheckJob` chạy 02:00 mỗi ngày, xử lý token hết hạn trong 7 ngày tới. ⚠️ Với Threads, `refresh()` gọi lại `th_exchange_token` thay vì `th_refresh_token` — **nhiều khả năng sai, cần xác minh** | `TokenHealthCheckJob.java:37`, `MetaApiClientImpl.java:283-304` |
| Token hỏng | `TokenValidationJob` (mỗi 6 giờ, lấy mẫu 10%): mã 190 → `REVOKED`. Worker đăng bài gặp 190 → `EXPIRED`. Cả hai đều chuyển lịch sang `ON_HOLD` (`ACCOUNT_ISSUE`) và gửi thông báo `RECONNECT_NEEDED`. Kết nối lại thì gỡ hold | `TokenValidationJob.java:32` |
| IG Business vs Creator | **Không phân biệt.** Tài khoản IG cá nhân không hiện ra, và UI không giải thích lý do | `MetaApiClientImpl.java:146-165` |
| Phiên bản API | Đọc từ DB `platform_api_versions`: FB/IG `v25.0` (hết hạn 29/07/2028), Threads `v1.0`. Riêng `ai/src/platform/facebook.py` cứng `v20.0` (ngoài phạm vi, theo lịch có lẽ đã hết hạn, Meta tự nâng bản) | `PlatformDataInitializer.java:35-37` |

### 1.2 Schema bài đăng

- **Bản ghi đăng thành công nằm ở `posts`:**
  - Cột chính: `platform_post_id` (FB: `pageId_postId`; Threads: media id), `published_at` (timestamptz), `platform_name`,
    `status` (POSTING/POSTED/FAILED), `schedule_id` (NOT NULL, unique).
  - Snapshot nội dung lúc đăng (V4): `snapshot_caption`, `snapshot_media_format`, …
- **Tài khoản/Page đích:** đi qua `post_schedules.platform_account_id` → `platform_accounts` (id thật trên nền tảng, `account_type`).
- **Thiếu:**
  - permalink;
  - loại media **do nền tảng báo** (hiện chỉ có `content_versions.media_format`, là chuỗi tự do IMAGE/VIDEO/TEXT do AIMA sinh);
  - số media;
  - trạng thái còn/đã xoá trên nền tảng.
- **`posts.schedule_id` là NOT NULL**, nên bài người dùng tự đăng ngoài AIMA **không thể** nằm trong `posts` (xem mục 3.3).
- **`post_analytics` (V1):**
  - Cột: `views, likes, comments, shares, saves, watch_time, ctr, conversion, milestone_hours, collected_at`.
  - Mỗi bài có tối đa 3 dòng bất biến ở các mốc 24/48/168 giờ, tức **số tích luỹ tại mốc, không phải chuỗi theo thời gian**.
  - Index `(post_id, milestone_hours)` **không unique**.
  - `optimization_insights.analytics_id` có FK trỏ vào bảng này (optimizer FR-67 dùng).
- **Migration:** Flyway `backend/src/main/resources/db/migration/`, mới nhất là **V5**.

### 1.3 Scheduler / queue

- Không có message queue. Mẫu chung là **`@Scheduled` + ShedLock (bảng `shedlock`) + bảng job trong DB + worker `@Async`**:
  - claim nguyên tử bằng `UPDATE … WHERE status IN (…)`;
  - gọi HTTP ngoài transaction;
  - đọc token qua DTO bất biến.
  - Có thể tắt toàn bộ bằng `app.scheduling.enabled`.
- `PostingDispatchJob` chạy mỗi 60 giây. Retry 5/15/30 phút chỉ dành cho lỗi TEMPORARY và mỗi lần retry là một dòng `posting_jobs` mới.
- `AnalyticsCollectionJob`:
  - Chạy mỗi giờ, khoá ShedLock `analytics-collection`, quét bài POSTED đã qua mốc mà chưa có snapshot.
  - **Không giới hạn tuổi bài, không batch, không backoff.** Bài bị xoá, lỗi quyền, rate limit đều bị gọi lại **mỗi giờ, mãi mãi**.
  - Lỗi chỉ được ghi log `warn`.
  - FB lấy `likes.summary` (**chỉ đếm Like, bỏ Love/Haha…**), `comments.summary`, `shares`, rồi `post_impressions` (đã chết).
  - Threads lấy `views, likes, replies, reposts, quotes`. IG thì ném lỗi.
- **Có thể tái dùng:** đúng mẫu "ShedLock scan → claim → worker async → ghi trong tx" của luồng đăng bài.
  `AnalyticsCollectionJob` sẽ được **thay thế** chứ không mở rộng.
- **Webhook Meta đã có** (`MetaWebhookController` → `/webhooks/meta`, kiểm chữ ký `X-Hub-Signature-256`). Hiện chỉ xử lý
  `verb=remove` của bài bị gỡ (SEC-06), là chỗ móc sẵn để phát hiện xoá bài sau này.

### 1.4 Trang /analytics

- **Nguồn dữ liệu mẫu:** `frontend/src/api/analyticsMock.ts`, sinh tất định bằng hash.
  - `Analytics.tsx:149-168` dùng mock khi: `VITE_USE_MOCK=true`, **hoặc** summary trả 4 tổng đều bằng 0 và chưa từng có
    dữ liệu thật trong phiên (`everReal`), **hoặc** lần tải đầu bị lỗi API.
  - Không có nút bật/tắt.
- Có thêm seeder backend `POST/DELETE /analytics/dev-seed`, gắn cờ `aima.dev.analytics-seed-enabled`, và không UI nào gọi.

| Widget | Endpoint | Dữ liệu cần |
|---|---|---|
| 4 KPI + % kỳ trước + sparkline | `/analytics/summary` | `{views,likes,comments,shares}: {total, deltaPct, series[]}`, `compareFrom/To` |
| Biểu đồ theo ngày | `/analytics/timeseries` | `points[{date, views, likes, comments, shares}]` (đã zero-fill) |
| Hiệu suất theo nền tảng | `/analytics/by-platform` (bỏ qua lọc nền tảng) | `{platform, connected, accountName, avatarUrl, status, views…, engagement, sharePct}` |
| Theo loại nội dung | `/analytics/by-content-type` (bỏ qua lọc loại) | `{label, posts, views…, engagement, sharePct}` |
| Top bài viết | `/analytics/top-posts` | `{postId, contentItemId, platform, caption, accountName, publishedAt, views…, engagement}` |
| Heatmap | `/analytics/activity-heatmap` | `cells[{dow, slot, hourStart, posts, engagement, avgEngagement, lowSample}]`, `max/min` |
| Thông tin chi tiết | `/analytics/insights` | `totalPosts, goodPosts, avgEngagementPerPost, needsAttentionPosts, goldenHour, engagementRatePct, ratedPosts, excludedPosts` + delta |

- **Cách backend tính:**
  - Chỉ lấy bài `POSTED` có `published_at` trong khoảng ngày (theo giờ VN).
  - Mỗi bài lấy snapshot **mốc muộn nhất** (`DISTINCT ON … ORDER BY milestone_hours DESC`).
  - Mọi khối đều gom theo **ngày đăng bài**, chưa có khái niệm "phát sinh trong ngày".
  - Kỳ so sánh là kỳ liền trước có cùng độ dài.
  - `deltaPct = (hiện tại − trước) / trước × 100`, trả `null` khi kỳ trước bằng 0.

### 1.5 "Tỷ lệ tương tác TB" = 194.2%

- **Backend** (`AnalyticsServiceImpl.java:385-390`) đúng:
  - Công thức: `Σ(likes+comments+shares) / Σ views × 100`, chỉ trên bài có `views > 0`.
  - Lấy tổng chia tổng, nhân 100 một lần.
  - Seeder backend sinh tương tác không quá ~10% lượt xem, nên không thể vượt 100%.
- **Mock frontend** (`analyticsMock.ts:270-308`) sai:
  - Tử số `engagement` cộng từ lưới heatmap 7×8, khoảng 15–22 nghìn, **cố định bất kể độ dài kỳ**.
  - Mẫu số `views` lấy từ `dailyPoints`, khoảng 900–1.300 mỗi ngày, **tăng theo số ngày**.
  - Hai bộ sinh không liên quan đến nhau. Kỳ 7 ngày đến 06/10/2026 cho 16.370 / 8.431 = **194.2%**.
  - `engagementRateDeltaPct` của mock cũng chỉ là số ngẫu nhiên.
- **Sửa:** tính tỷ lệ từ chính `dailyPoints` (`Σ(likes+comments+shares)/Σviews`). Xếp vào Giai đoạn 0.

---

## 2. Đối chiếu API Meta (Bước 2)

> Nguồn: changelog và reference chính thức của developers.facebook.com, tra ngày 06/10/2026. Những điểm "chưa xác minh"
> được ghi rõ. **Bản mới nhất là Graph API v26.0** (29/07/2026). Bản v25.0 đang dùng còn hạn tới 29/07/2028, nên không bắt buộc nâng.

### 2.1 Facebook Page

**Metric đã chết, mọi phiên bản đều trả "invalid metric":**
- **15/11/2025:**
  - `post_impressions*` (kể cả `_paid/_fan/_organic/_viral/_nonviral`);
  - `page_impressions`, `page_impressions_paid/viral/nonviral`;
  - `page_fans*`, `page_fan_adds/removes*`.
- **15/06/2026:**
  - toàn bộ họ `*_unique`: `post_impressions_unique`, `page_impressions_unique`, `page_posts_impressions*`;
  - `post_video_views_unique`, `page_video_views_unique`;
  - `total_video_impressions*`.

**Metric dùng được:**

| Cấp | Metric | Ghi chú |
|---|---|---|
| Bài (`/{post-id}/insights`, lifetime) | `post_media_view` (lượt xem) · `post_total_media_view_unique` (người xem ≈ reach) · `post_clicks` · `post_reactions_by_type_total` · video: `post_video_views`, `post_video_avg_time_watched`, `post_video_view_time` | Cần `read_insights` + `pages_read_engagement`. Meta nói số mới **không so 1:1 được** với impressions cũ |
| Trường trên post | `reactions.summary(total_count).limit(0)`, `comments.summary(true).limit(0)`, `shares` (`{count}`), `created_time`, `permalink_url`, `attachments{media_type,type}` | Không cần `read_insights`. **Nên đổi từ `likes` sang `reactions`** để đếm đủ cảm xúc |
| Page (`/{page-id}/insights`, day/week/days_28) | `page_media_view`, `page_total_media_view_unique`, `page_views_total`, `page_post_engagements`, `page_follows`, `page_daily_follows_unique`, `page_daily_unfollows_unique`, `page_video_views` | Page cần ≥100 lượt thích. Mỗi truy vấn tối đa 90 ngày. Dữ liệu giữ 2 năm, cập nhật trễ khoảng 24 giờ |

> Trang reference v26 của Meta **vẫn còn liệt kê** `page_impressions`/`page_fans`. Đừng tin trang đó; ưu tiên changelog.

### 2.2 Instagram

Dùng với Facebook Login (đường hiện tại), qua `graph.facebook.com`. **Không hỗ trợ tài khoản cá nhân.**

**Metric đã chết:**
- 08/01/2025: `video_views`, `profile_views`, `website_clicks`, …
- 21/04/2025: `impressions`, `plays`, `clips_replays_count`, `ig_reels_aggregated_all_plays_count` (thay bằng `views`).

**Insights cấp media (`/{ig-media-id}/insights`):**

| Metric | FEED (ảnh/carousel) | REELS | STORY |
|---|---|---|---|
| `views`, `reach`, `shares`, `total_interactions` | ✓ | ✓ | ✓ |
| `likes`, `comments`, `saved` | ✓ | ✓ | – |
| `follows`, `profile_visits` | ✓ | – | ✓ |
| `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`, `reels_skip_rate` | – | ✓ | – |
| `replies`, `navigation` | – | – | ✓ |

Ghi chú:
- Media con trong carousel không có insights. Số liệu trễ tới 48 giờ. Story chỉ có trong 24 giờ.
- Trường trên media: `like_count`, `comments_count`, `media_type`, `media_product_type`, `timestamp`, `permalink`.
  `like_count` có thể bị ẩn.
- Insights có thể **lồng vào truy vấn danh sách media** bằng field expansion
  (`/{ig-user-id}/media?fields=…,insights.metric(views,reach,…)`). Cách này **chưa chạy thử**, cần spike.

**Insights cấp tài khoản (`/{ig-user-id}/insights`):**
- Với `period=day&metric_type=total_value`: `views`, `reach`, `accounts_engaged`, `total_interactions`, `likes`, `comments`,
  `shares`, `saves`, `follows_and_unfollows`, `profile_links_taps`.
- `reach` có thêm `time_series`.
- `follower_count` và `online_followers` **không còn trong bảng metric hiện hành**, chỉ thấy ở phần "Limitations" (cần ≥100 follower).
  **Chưa xác minh.** Lấy số follower bằng trường `followers_count` của IG user cho chắc.

### 2.3 Threads (`graph.threads.net/v1.0`)

- **Media** (`/{media-id}/insights`): `views, likes, replies, reposts, quotes, shares`. Code hiện **chưa lấy `shares`**.
- **User** (`/{user-id}/threads_insights`):
  - `views` (time_series, lượt xem hồ sơ);
  - `likes, replies, reposts, quotes, clicks`, `followers_count` (total_value);
  - `follower_demographics` (≥100 follower).
- Không có dữ liệu trước 13/04/2024. Quyền cần: `threads_basic` + `threads_manage_insights` (đã có trong scope).

### 2.4 Quyền: đối chiếu với scope hiện có

| Quyền | Dùng cho | Hiện có? | App Review / Advanced Access |
|---|---|---|---|
| `read_insights` | `post_media_view`, insights Page | ❌ **thiếu** | Có |
| `pages_read_engagement` | reactions/comments/shares, đọc bài | ✅ (scope dự phòng) | Có |
| `pages_show_list` | danh sách Page | ✅ | Có |
| `instagram_basic` | media IG, `like_count`… | ✅ | Có |
| `instagram_manage_insights` | insights IG (media + tài khoản) | ❌ **thiếu** | Có |
| `threads_manage_insights` | insights Threads | ✅ | Có |
| `pages_manage_metadata` | webhook `feed` của Page (giai đoạn 3) | ✅ | Có |
| `business_management` | Page nằm trong Business Manager | ✅ | Có + **Business Verification** |

- **Quan trọng:** vì đang dùng `config_id`, danh sách quyền thật nằm trong *Login configuration* trên Meta Dashboard, không
  phải trong `.env`. Cần anh/chị kiểm (Q3).
- Tài khoản đã kết nối trước khi thêm quyền **phải kết nối lại** mới có quyền mới.
- **Standard Access** chỉ hoạt động với người có vai trò trong app (admin/dev/tester). Muốn người dùng thật dùng được thì
  mọi quyền trên cần **Advanced Access**, nghĩa là phải qua App Review (screencast từng quyền) và **Business Verification**.

### 2.5 Rate limit và lỗi

- **Business Use Case** (token Page/IG/Threads), tính trên 24 giờ: Pages `4800 × engaged users`, IG `4800 × impressions`,
  Threads `4800 × impressions` (sàn 10).
  - Header `X-Business-Use-Case-Usage` cho biết `call_count/total_cputime/total_time` (%) và `estimated_time_to_regain_access`.
  - Token user thì xem `X-App-Usage`.
- **Batch API:** tối đa 50 lệnh mỗi request, mỗi lệnh vẫn tính riêng vào hạn mức, có kết quả riêng từng lệnh.
- **Mã lỗi:**

  | Nhóm | Mã |
  |---|---|
  | Throttling, retry có backoff | 4, 17, 32, 613, 80001 (Pages), 80002 (IG) |
  | Lỗi tạm | 1, 2, HTTP 5xx |
  | Thiếu quyền | 10, 200–299 |
  | Token | 190 (subcode 458/459/460/463/464/467/492), 102 |
  | Không tồn tại hoặc không có quyền đọc | 100 / subcode 33 (chỉ thấy trên community, **không có trong trang lỗi chính thức**). Có thể là "đã xoá" **hoặc** "thiếu quyền" |

---

## 3. Phương án đề xuất (Bước 3)

### 3.1 Schema mới (Flyway V6)

```text
platform_media           1 dòng / 1 bài trên nền tảng (AIMA hoặc đăng ngoài)
 ├─ post_metric_snapshots   số TÍCH LUỸ tại mỗi lần đồng bộ (append-only)
 ├─ post_metrics_daily      DELTA + tích luỹ cuối ngày, theo ngày giờ VN (đọc cho các widget)
 └─ (post_analytics cũ)     giữ nguyên các mốc 24/48/168h cho optimizer / FR-62
platform_accounts
 ├─ account_sync_state      trạng thái đồng bộ / quyền / rate limit của tài khoản
 └─ account_insights_daily  số liệu cấp tài khoản theo ngày
```

**`platform_media`** là bản ghi chuẩn của một bài trên nền tảng, thay vai trò "nơi đo số liệu" của `posts`:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `platform_account_id` | uuid FK → platform_accounts | |
| `platform_name` | varchar(20) | FACEBOOK/INSTAGRAM/THREADS |
| `platform_media_id` | varchar(255) | `pageId_postId` / IG media id / Threads media id |
| `post_id` | uuid FK → posts, **nullable** | null nghĩa là bài đăng ngoài AIMA |
| `origin` | varchar(10) | `AIMA` \| `EXTERNAL` |
| `media_type` | varchar(20) | chuẩn hoá: TEXT/IMAGE/VIDEO/CAROUSEL/REEL/STORY, **theo nền tảng báo** |
| `permalink` | varchar(2048) | |
| `caption_excerpt` | varchar(300) | bài ngoài AIMA không có `snapshot_caption` |
| `published_at` | timestamptz | |
| `platform_status` | varchar(20) | `ACTIVE` \| `DELETED` \| `UNAVAILABLE` |
| `sync_status` | varchar(20) | `ACTIVE` \| `DONE` (quá tuổi) \| `PAUSED` \| `STOPPED` |
| `next_sync_at`, `last_synced_at` | timestamptz | |
| `consecutive_failures` | int | |
| `last_error_code` | varchar(50) | |
| `locked_until` | timestamptz | claim nguyên tử như `posting_jobs` |
| audit + `deleted_at` | | soft delete như các bảng khác |

- Unique `(platform_account_id, platform_media_id) WHERE deleted_at IS NULL`.
- Index một phần `(next_sync_at) WHERE sync_status = 'ACTIVE' AND deleted_at IS NULL` cho bộ quét.
- Index `(platform_account_id, published_at)`.
- Unique `(post_id) WHERE post_id IS NOT NULL`.

**`post_metric_snapshots`** (append-only, giữ bản thô 180 ngày, chi tiết ở mục 3.2):

| Cột | Ghi chú |
|---|---|
| `id`, `platform_media_id` FK, `collected_at` timestamptz | |
| `views`, `reach`, `likes`, `comments`, `shares`, `saves`, `clicks`, `video_views`, `avg_watch_time_ms` | bigint **nullable**: null = nền tảng không cung cấp hoặc không lấy được. **Không coalesce về 0** |
| `raw` jsonb | toàn bộ phản hồi metric, để tính lại khi Meta đổi định nghĩa |
| `api_version` varchar(10), `source` varchar(10) | `POLL` \| `BACKFILL` \| `WEBHOOK` |

- Index `(platform_media_id, collected_at DESC)` để lấy snapshot mới nhất và snapshot liền trước.
- Riêng Threads, `shares` lưu `reposts + quotes + shares`. Hai cột `reposts`/`quotes` riêng để trong `raw`.

**`post_metrics_daily`** là bảng mọi widget đọc:

| Cột | Ghi chú |
|---|---|
| `platform_media_id` FK, `metric_date` date (giờ VN) | PK ghép (`platform_media_id`, `metric_date`) |
| `user_id`, `platform_account_id`, `platform_name`, `media_type`, `origin`, `published_at` | **phi chuẩn hoá có chủ đích** để truy vấn tổng hợp không phải join 4 bảng |
| `views_delta`, `reach_delta`, `likes_delta`, `comments_delta`, `shares_delta`, `saves_delta` | phát sinh trong ngày, có thể âm (bỏ thích, xoá bình luận) |
| `views_total`, `likes_total`, … | tích luỹ tại cuối ngày |
| `is_estimated` boolean | true khi delta được chia đều từ khoảng trống nhiều ngày (mục 3.2) |

- Index `(user_id, metric_date)` và `(user_id, platform_name, metric_date)`.

**`account_sync_state`** (1 dòng / platform_account):
- `permission_state`: `OK` \| `MISSING_INSIGHTS` \| `NOT_PROFESSIONAL` \| `TOKEN_INVALID`.
- `missing_permissions` jsonb.
- `paused_until`, `last_bucket_usage_pct`.
- `last_full_sync_at`, `initial_backfill_done` boolean.
- `last_error_code`, `last_error_at`.

Đây là nguồn cho trạng thái hiển thị trên UI (mục 3.5).

**`account_insights_daily`:**
- Cột: `platform_account_id`, `metric_date`, `followers_count`, `follows`, `unfollows`, `views`, `reach`, `profile_views`,
  `accounts_engaged`, `interactions`, `raw` jsonb, `collected_at`.
- Unique `(platform_account_id, metric_date)`.
- Dùng cột rộng (không dùng EAV) vì chỉ 3 nền tảng và các widget đọc theo cột.

**Giữ `post_analytics`:**
- Job mới vẫn ghi dòng mốc 24/48/168h (lấy snapshot đầu tiên sau mốc), nên optimizer (FR-67), golden hour (FR-48) và
  bảng so sánh mốc (FR-62) không phải đổi.
- Thêm unique `(post_id, milestone_hours) WHERE deleted_at IS NULL` để chống trùng.

**Backfill (trong V6 hoặc job một lần):**
- Tạo `platform_media` cho mọi `posts` POSTED có `platform_post_id`, với `origin = AIMA`, `media_type` suy từ `snapshot_media_format`.
- Chuyển `post_analytics` cũ thành snapshot (`source = BACKFILL`) để biểu đồ không trống lúc chuyển đổi.

### 3.2 Chiến lược đồng bộ

**Thiết kế job** (thay `AnalyticsCollectionJob`, đúng mẫu luồng đăng bài):
1. `AnalyticsSyncDispatchJob` chạy `@Scheduled(fixedDelay = 5 phút)` với ShedLock `analytics-sync`:
   - chọn **tài khoản** có media đến hạn (`next_sync_at <= now`) và `paused_until` đã qua;
   - claim tối đa 50 media mỗi tài khoản (`UPDATE … SET locked_until = now + 10 phút`);
   - đẩy sang `analyticsSyncExecutor` (`@Async`, pool 2–3, hàng đợi có giới hạn).
2. Worker xử lý từng tài khoản:
   - đọc token trong tx read-only thành DTO;
   - gọi API **ngoài tx**;
   - ghi snapshot + upsert daily + mốc `post_analytics` + cập nhật `next_sync_at` trong **một tx**.
3. `AccountInsightsJob` chạy cron 03:30 VN mỗi ngày:
   - lấy insights tài khoản của **3 ngày gần nhất** (Meta sửa số trong vòng 48 giờ);
   - upsert theo `(account, date)`.

**Tần suất giảm dần theo tuổi bài** (`next_sync_at = last_synced_at + khoảng`):

| Tuổi bài | Chu kỳ | Lý do |
|---|---|---|
| 0–24 giờ | 2 giờ | tương tác tập trung giai đoạn đầu |
| 1–3 ngày | 6 giờ | |
| 3–7 ngày | 12 giờ | |
| 7–30 ngày | 24 giờ | |
| 30–90 ngày | 7 ngày | |
| > 90 ngày | dừng (`DONE`) | người dùng vẫn bấm "Làm mới" thủ công được |

- Các mốc 24/48/168 giờ được **ép** một lần đồng bộ ngay sau mốc để giữ ngữ nghĩa FR-59.
- Ước lượng: khoảng 35 snapshot mỗi bài trong 90 ngày, không đáng kể về dung lượng.

**Gom lời gọi:**
- **FB:** Batch API, 50 lệnh `GET {post-id}?fields=reactions.summary(total_count).limit(0),comments.summary(true).limit(0),shares,insights.metric(post_media_view,post_total_media_view_unique,post_clicks)`.
  - Một round-trip cho 50 bài, mỗi lệnh có kết quả riêng, nên một bài lỗi không kéo cả lô.
  - Không dùng `?ids=` vì một id hỏng làm hỏng cả request.
- **IG:** Batch API theo media id. Spike thử field expansion `insights.metric(...)` trên `/media`.
- **Threads:** gọi `/{media-id}/insights` từng bài, song song tối đa 3 mỗi tài khoản (chưa xác minh Threads có hỗ trợ batch).
- **Fallback quyền:** thiếu `read_insights` thì **vẫn lấy** reactions/comments/shares bằng trường thường, chỉ `views = null`.
  Vẫn có số liệu tương tác, không phải chọn được ăn cả ngã về không.

**Rate limit / retry / backoff:**
- Đọc `X-Business-Use-Case-Usage` / `X-App-Usage` ở mọi phản hồi:
  - bất kỳ chỉ số > 75% → `paused_until = now + estimated_time_to_regain_access` (tối thiểu 15 phút);
  - \> 90% → dừng cả lô đang chạy.
- **Đây không phải luồng đăng bài nên KHÔNG áp retry 5/15/30 của FR-56.** Lỗi đồng bộ chỉ dời `next_sync_at`:

  | Lỗi | Xử lý |
  |---|---|
  | 1, 2, 5xx, timeout | backoff mũ `min(2^n × 15 phút, 24 giờ)` theo `consecutive_failures` |
  | 4, 17, 32, 613, 80001, 80002 | pause **cả tài khoản** tới `estimated_time_to_regain_access`, không tăng `consecutive_failures` của bài |
  | 10, 200–299 | `permission_state = MISSING_INSIGHTS`, ghi `missing_permissions`, chuyển sang chế độ trường cơ bản |
  | 190 / 102 | `permission_state = TOKEN_INVALID`, **gọi lại đúng luồng hiện có** (EXPIRED/REVOKED + hold `ACCOUNT_ISSUE` + `RECONNECT_NEEDED`, có khử trùng), dừng đồng bộ tài khoản tới khi kết nối lại; kết nối lại thì đồng bộ bù ngay |
  | 100/33 hoặc "does not exist" | xem dòng tiếp theo |

- **Bài bị xoá trên nền tảng:** 100/33 có thể nghĩa là "đã xoá" **hoặc** "thiếu quyền", nên không kết luận ngay.
  1. Lần đầu: đánh `UNAVAILABLE`, thử lại sau 24 giờ.
  2. Lần hai vẫn lỗi trong khi lời gọi khác của cùng token vẫn chạy → `platform_status = DELETED`, `sync_status = STOPPED`.
  3. **Giữ toàn bộ số liệu lịch sử**; UI gắn nhãn "Đã xoá trên nền tảng".
  4. **Không đổi `ContentItemStatus`** (D2: analytics không bao giờ đổi trạng thái). Webhook `verb=remove` sẵn có (SEC-06) vẫn
     giữ nguyên hành vi.
- Sau 10 lần lỗi tạm liên tiếp → `PAUSED` + ghi `system_logs`. Không thông báo người dùng (tránh spam). Admin thấy được qua log.

**Delta theo ngày:**
- `delta = snapshot_mới − snapshot_trước`, quy về ngày giờ VN của `collected_at`.
- Nếu hai snapshot cách nhau nhiều ngày (bài cũ đồng bộ thưa, hoặc tài khoản bị pause) thì **chia đều** delta cho các
  ngày nằm giữa và đặt `is_estimated = true`.
- Sai số nhỏ vì phần lớn tương tác phát sinh lúc bài còn mới, khi đồng bộ còn dày.
- Snapshot đầu tiên: toàn bộ giá trị tính cho ngày thu.
  - **Ngoại lệ backfill** bài cũ: rải từ `published_at` tới ngày thu, đánh `is_estimated`.
- Lưu ý FB/IG: lượt xem trễ 24–48 giờ so với lượt thích, nên delta lượt xem của ngày gần nhất luôn thấp hơn thực tế.
  Vì vậy **ngày hôm nay được đánh dấu "tạm tính"** trên biểu đồ.

### 3.3 Có import bài đăng trực tiếp trên nền tảng không?

- **Đề xuất: CÓ, nhưng để giai đoạn 2, bật/tắt theo từng tài khoản, mặc định bật.**
- **Lý do nên làm:**
  - Insights cấp tài khoản vốn đã gồm mọi bài, nếu chỉ tính bài AIMA thì KPI tài khoản và KPI bài vênh nhau.
  - Heatmap/giờ vàng có nhiều mẫu hơn.
  - Người dùng mới chưa đăng bài nào qua AIMA vẫn thấy dữ liệu thật ngay, thay vì dữ liệu mẫu.
- **Cách làm:**
  - Đọc `/{page-id}/published_posts`, `/{ig-user-id}/media`, `/me/threads` của 90 ngày gần nhất.
  - Bài có `platform_media_id` trùng với bài AIMA thì gắn `post_id` và `origin = AIMA`; còn lại là `origin = EXTERNAL`.
- **Gắn nhãn:**
  - Cột `origin`; chip "Ngoài AIMA" ở Top bài viết.
  - Bộ lọc mới `source = all|aima` ("Chỉ bài AIMA") đi vào `AnalyticsFilter` (URL `?source=`). Mặc định `all` = toàn bộ Page (chốt Q5).
- **Ranh giới (để giữ BR-03/BR-10):**
  - **Optimizer (FR-67) và golden hour (FR-48) chỉ dùng bài `origin = AIMA`** vì bài ngoài không gắn với chiến lược nào.
  - Bài ngoài AIMA không có `content_item_id`, nên click mở modal chi tiết dạng rút gọn + nút mở permalink.
- Câu hỏi mặc định "tính chung" hay "chỉ AIMA": xem Q5.

### 3.4 Ánh xạ widget → nguồn dữ liệu → công thức

**Định nghĩa thống nhất (chuẩn hoá đa nền tảng):**

| Khái niệm | Facebook | Instagram | Threads |
|---|---|---|---|
| Lượt xem (`views`) | `post_media_view` | `views` | `views` |
| Người tiếp cận (`reach`) | `post_total_media_view_unique` | `reach` | — (null) |
| Thích (`likes`) | `reactions.summary.total_count` (mọi cảm xúc) | `likes` | `likes` |
| Bình luận | `comments.summary.total_count` | `comments` | `replies` |
| Chia sẻ | `shares.count` | `shares` | `reposts + quotes + shares` |
| Lưu | — (null) | `saved` | — (null) |
| **Tương tác** (chốt Q4) | reactions + bình luận + chia sẻ | likes + bình luận + chia sẻ (không cộng lưu) | likes + bình luận + chia sẻ |

**Tỷ lệ tương tác (ER):**

```
ER(kỳ) = Σ tương tác_tích_luỹ(bài) / Σ lượt_xem_tích_luỹ(bài) × 100
         trên tập bài ĐĂNG TRONG KỲ, có lượt_xem > 0 và tuổi ≥ 24h
```

- **Lấy tổng chia tổng** (không lấy trung bình tỷ lệ từng bài), để bài 3 lượt xem 2 lượt thích không kéo vọt con số.
- **Mẫu số là lượt xem**, không phải reach, vì đó là chỉ số duy nhất cả 3 nền tảng đều có. ER theo reach (FB/IG) để ở tooltip.
- Loại bài dưới 24 giờ vì lượt xem FB/IG trễ hơn lượt thích, nên bài quá mới cho ER cao giả.
- Trả kèm `ratedPosts`/`excludedPosts` như hiện tại.
- Khi đã có `post_media_view`, chú thích "không tính bài Facebook" **không còn đúng** → đổi thành "chỉ tính bài có lượt xem,
  đăng từ 24 giờ trước".
- ER > 100% về lý thuyết vẫn có thể xảy ra (tương tác thật cao hơn lượt xem). Không cắt ngưỡng, nhưng log cảnh báo bất
  thường khi > 100% với ≥ 10 bài.

**Bảng ánh xạ** (`D` = `post_metrics_daily`, `M` = `platform_media`):

| Widget | Nguồn | Cách tính |
|---|---|---|
| 4 KPI (Lượt xem / Thích / Bình luận / Chia sẻ) | D | `Σ *_delta` với `metric_date ∈ [from,to]`, tức là **phát sinh trong kỳ** (mọi bài, kể cả bài đăng từ trước kỳ). Kỳ trước = cùng độ dài liền trước. `deltaPct` giữ công thức hiện tại. Sparkline = chuỗi theo ngày |
| Biểu đồ theo ngày | D | `GROUP BY metric_date`, zero-fill. Ngày có `is_estimated` hoặc là hôm nay → đường nét đứt/tooltip "tạm tính" |
| Hiệu suất theo nền tảng | D + `account_sync_state` | `Σ delta` theo `platform_name`. `connected` + **trạng thái đồng bộ/quyền** mỗi nền tảng (mục 3.5). Tuỳ chọn hiện follower từ `account_insights_daily` |
| Theo loại nội dung | D (`media_type`) | `Σ delta` theo `media_type` **do nền tảng báo** (có REEL/CAROUSEL thật), bỏ dùng `content_versions.media_format` |
| Top bài viết | M + snapshot mới nhất | bài **đăng trong kỳ**, xếp theo tương tác tích luỹ mới nhất (hoặc cột được sort). Thêm `permalink`, `origin`, `platformStatus` |
| Heatmap | M + snapshot mới nhất | giữ nguyên quy tắc v2 (`(isodow, floor(hour/3))` theo giờ đăng VN, TB tương tác/bài, ô ≥3 bài mới vào thang, chỉ bài ≥ 24h). Mặc định chỉ bài AIMA nếu Q5 chọn vậy |
| Thông tin chi tiết | M + snapshot + `posts` | `totalPosts` = số bài đăng trong kỳ. `goodPosts` = bài có tương tác > TB kỳ. `needsAttentionPosts` giữ (FAILED). `goldenHour` như heatmap. `engagementRatePct` theo công thức ER ở trên. Có thể thêm "Follower mới" từ `account_insights_daily` (giai đoạn 2) |
| Export CSV | M + snapshot | thêm cột `reach, saves, permalink, origin, platform_status, last_synced_at` |

> ⚠️ **Thay đổi ngữ nghĩa:**
> - KPI và biểu đồ chuyển từ "số liệu của các bài *đăng* trong kỳ" sang "số liệu *phát sinh* trong kỳ". Đây đúng là điều
>   đề bài muốn (delta + so kỳ trước), nhưng con số sẽ khác hiện tại → xác nhận ở Q4.
> - Top bài / heatmap / ER vẫn theo nhóm bài đăng trong kỳ, vì đó là câu hỏi "bài nào tốt", không phải "kỳ này có bao nhiêu
>   lượt xem".

### 3.5 Fallback và trạng thái UI

Endpoint mới: `GET /analytics/sync-status`, trả cho mỗi tài khoản đã kết nối:
`{platform, accountName, connectionStatus, permissionState, missingPermissions[], lastSyncedAt, initialBackfillDone, pausedUntil}`.

**Thứ tự ưu tiên quyết định hiển thị (thay luật `everReal` hiện tại):**

| # | Điều kiện | Hiển thị |
|---|---|---|
| 1 | Không có tài khoản nào kết nối | **Chế độ "Dữ liệu mẫu"** (giữ mock, đã sửa lỗi ER) + banner "Kết nối Facebook/Instagram/Threads để xem số liệu thật" → Cài đặt |
| 2 | Có kết nối, `initialBackfillDone = false` | Skeleton + "Đang đồng bộ số liệu lần đầu…", poll `sync-status` 15 giây/lần. **Không** hiện mock (tránh tưởng nhầm là số thật) |
| 3 | Có kết nối, đã đồng bộ, chưa có bài nào | Empty state thật "Chưa có bài đăng" (v2 đã có) |
| 4 | Bình thường | Dữ liệu thật + "Cập nhật lần cuối HH:mm" + nút "Làm mới" (`POST /analytics/sync`, trả job ngay theo NFR-04, giới hạn 1 lần/15 phút/người dùng) |

**Badge theo từng nền tảng** (ở card nền tảng và banner mảnh dưới thanh lọc):
- `MISSING_INSIGHTS` → "Thiếu quyền xem thống kê — chỉ hiện thích/bình luận/chia sẻ" + nút **Kết nối lại** (xin thêm quyền).
- `TOKEN_INVALID` / EXPIRED / REVOKED → "Cần kết nối lại" (tái dùng UI dashboard đã có).
- `NOT_PROFESSIONAL` (IG):
  - Không phát hiện chắc được: tài khoản cá nhân không hiện qua Page.
  - Phát hiện gián tiếp khi Page đã kết nối **không có `instagram_business_account`**: ghi cờ vào `account_sync_state` của
    Page, UI hiện hướng dẫn "Chuyển Instagram sang tài khoản Doanh nghiệp/Nhà sáng tạo và liên kết với Trang <tên>".
  - Đây là thay đổi nhỏ ở `MetaOAuthServiceImpl` (đang bỏ qua im lặng).
- `pausedUntil` (bị rate limit) → "Đang tạm dừng đồng bộ đến HH:mm". Số liệu cũ vẫn hiển thị.

> Dữ liệu mẫu **không bao giờ** trộn với dữ liệu thật trong cùng một màn hình; quy tắc này giữ đúng như v2.

### 3.6 Webhook hay polling?

**Giai đoạn đầu chỉ cần polling.** Lý do:
- Webhook của Meta **không mang số đếm** (thích/lượt xem). Page `feed` chỉ báo có sự kiện thêm/sửa/xoá bài, bình luận, cảm
  xúc; IG `comments`/`mentions`; Threads `replies`/`delete`. Ngoại lệ duy nhất là IG `story_insights`, mà AIMA không đăng story.
- Webhook IG cần Advanced Access + Business Verification + tài khoản public, và sự kiện không xem lại được.
- Lịch 2 giờ/lần trong 24 giờ đầu đã đủ "gần thời gian thực" cho một dashboard marketing.

**Giai đoạn 3 (tuỳ chọn):**
- Mở rộng `MetaWebhookController` sẵn có để nhận Page `feed`.
- `verb=add/edited/remove` của `comment`/`reaction` trên bài đang theo dõi → **dời `next_sync_at = now + 5 phút`** (debounce),
  tức webhook chỉ là tín hiệu kích hoạt, số liệu vẫn lấy qua API.
- `verb=remove` của bài → đánh `DELETED` ngay, không phải chờ 2 lần lỗi.
- `pages_manage_metadata` đã có trong scope.

### 3.7 Lộ trình

| Giai đoạn | Nội dung | Độ phức tạp* |
|---|---|---|
| **0. Sửa nhanh** | Theo mục D.1: (1) FB `post_impressions` → `post_media_view`, `likes.summary` → `reactions.summary`. (2) Phân loại lỗi + V6 `platform_media` làm trạng thái đồng bộ, dừng gọi lại vô hạn. (3) Sửa ER trong `analyticsMock.ts` + chú thích ER. (Quyền `read_insights` do anh/chị thêm vào Login configuration rồi kết nối lại Page test) | **S** · 1–2 ngày |
| **1. MVP dữ liệu thật** | V6 (4 bảng mới + unique `post_analytics`) + backfill. `MetaInsightsClient` (Batch API, đọc header usage, phân loại lỗi). `AnalyticsSyncDispatchJob` + worker thay `AnalyticsCollectionJob`. Viết lại 9 truy vấn `/analytics/*` sang `post_metrics_daily` (giữ nguyên hợp đồng API, thêm trường mới là tuỳ chọn). `GET /analytics/sync-status`, `POST /analytics/sync`. FE: các trạng thái mục 3.5, nét "tạm tính", chú thích ER mới. Áp dụng FB + Threads, và IG nếu đã đăng được (Q1). Test: tích hợp MockWebServer cho client (batch, lỗi từng phần, 4/17/80001, 190, 100/33), test tổng hợp delta/chia đều, test truy vấn PG thật (cạm bẫy `:x is null` → dùng Specification/CAST) | **L** · BE 8–10 ngày + FE 3–4 ngày |
| **2. Mở rộng** | `AccountInsightsJob` + `account_insights_daily` (follower, lượt xem Page/hồ sơ) + KPI "Follower mới". Import bài ngoài AIMA + bộ lọc `source`. Insights IG đầy đủ (saved, reach, reels watch time). Phát hiện IG không chuyên nghiệp. Dọn snapshot thô > 180 ngày (gắn vào `LogRetentionJob`) | **M** · 5–7 ngày |
| **3. Nâng cao** | Webhook `feed` kích hoạt đồng bộ + phát hiện xoá tức thì. Tần suất thích ứng theo tốc độ tương tác. Nhân khẩu học (`follower_demographics`). Nâng Graph v26 | **M** · 4–6 ngày |

\* S ≤ 2 ngày, M ≤ 1 tuần, L > 1 tuần, cho 1 người, chưa tính nghiệm thu.

**Ngoài code** (anh/chị làm trên Meta Dashboard): App Review cho `read_insights`, `instagram_manage_insights`,
`threads_manage_insights`, `pages_read_engagement`, kèm screencast. Business Verification. Thường mất **1–4 tuần, có thể bị trả về**.

### 3.8 Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| **App Review / Business Verification** chưa có → chỉ tài khoản có vai trò trong app thấy số thật | Cao | Phát triển và demo bằng tài khoản tester (Standard Access đủ). Nộp review sớm, song song giai đoạn 1 |
| **Meta khai tử metric tiếp** (đã 3 đợt trong 2025–2026) | Cao | Danh sách metric để ở một chỗ (hằng số theo nền tảng + phiên bản). Lưu `raw` jsonb. Lỗi "invalid metric" → log ERROR + bỏ metric đó, vẫn lưu phần còn lại. `ApiVersionCheckJob` theo dõi changelog |
| Rate limit BUC khi số người dùng tăng | Trung bình | Batch + giảm tần suất theo tuổi + pause theo header. Ước lượng: 100 tài khoản × ~2 batch/giờ, còn xa trần |
| Delta theo ngày sai khi đồng bộ thưa/bị pause | Trung bình | Chia đều + cờ `is_estimated` + nhãn "tạm tính". Phần lớn tương tác rơi vào giai đoạn đồng bộ dày |
| Số mới không so được với số cũ (Meta tự nói "không 1:1") | Thấp | Thực tế dữ liệu views FB cũ đều null nên gần như không có gì để so. Ghi chú trong tài liệu |
| Nhiều instance cùng chạy job trên DB Supabase (đã gặp 28/09) | Trung bình | ShedLock + claim `locked_until` ở cấp media. Unique constraint chống ghi trùng |
| 100/33 nhập nhằng "xoá" vs "thiếu quyền" | Thấp | Xác nhận 2 lần cách 24 giờ + đối chiếu lời gọi khác cùng token |
| Boot app để thử sẽ gọi Meta thật | — | Theo quy ước hiện có: verify bằng test (MockWebServer) và stack cô lập (PG :55432 / BE :8092), không boot vào Supabase |

---

## 4. Câu hỏi đã gửi (đã trả lời — xem mục D)

1. **Instagram:** code hiện chưa đăng được IG (`InstagramPublisherImpl` luôn trả `IG_MEDIA_REQUIRED`, `getPostMetrics` từ
   chối IG). Đề bài nói đã đăng được IG. Phần đăng IG nằm ở nhánh khác, hay em hiểu sai? Nếu chưa có thì giai đoạn 1 chỉ làm
   FB + Threads, còn IG chỉ có insights tài khoản (hoặc chờ phần đăng IG).
2. **Threads:** code OAuth, đăng bài và thu số liệu Threads đã có đủ. "Threads chưa kết nối" nghĩa là chỉ chưa kết nối tài
   khoản thật để thử, hay app Threads trên Meta chưa cấu hình xong? Có đưa Threads vào giai đoạn 1 không?
3. **Quyền trong Login configuration (`META_FACEBOOK_CONFIG_ID`):** configuration đang xin những quyền nào? App đang ở
   Development hay Live, đã có Advanced Access / Business Verification chưa? Cần thêm ít nhất `read_insights` và
   `instagram_manage_insights`.
4. **Ngữ nghĩa KPI/biểu đồ:** đồng ý chuyển sang "phát sinh trong kỳ" (delta), còn Top bài / heatmap / ER giữ "bài đăng trong
   kỳ" (mục 3.4)?
5. **Bài đăng ngoài AIMA:** đồng ý import ở giai đoạn 2? Trên dashboard mặc định **tính chung** (đề xuất) hay **chỉ bài AIMA**?
   Optimizer/giờ vàng luôn chỉ dùng bài AIMA. Có đồng ý không?
6. **Giữ `post_analytics`** (mốc 24/48/168h) cho optimizer / FR-62 thay vì chuyển optimizer sang bảng mới. Đề xuất giữ để
   không động vào FR-67.
7. **Lưu trữ:** snapshot thô giữ 180 ngày rồi xoá (bảng theo ngày giữ vĩnh viễn). Có cần mốc khác không?
8. **Môi trường kiểm thử:** giai đoạn 1 cần một Page + tài khoản Threads test có bài thật để đối chiếu số với Meta Business
   Suite. Anh/chị có tài khoản nào dùng được, và cho phép job gọi Meta **chỉ đọc** từ stack cô lập không?
