# Kế hoạch: Trang Phân tích dùng dữ liệu thật từ Meta

> Trạng thái: **ĐÃ DUYỆT 2026-10-06** (kèm quyết định ở mục D bên dưới) · Giai đoạn 0: đã duyệt (commit `1b52e26`) · Giai đoạn 1: đã kiểm với Meta thật (khớp Business Suite, Page test **AIMA Marketing**) · **Q9/Q10: code xong 2026-10-07, chưa commit (mục D.5)** · **Giai đoạn 2: xong 2026-10-07, đã kiểm thật một phần, chưa commit (mục D.6)** · **Giai đoạn 3: xong 2026-10-07, webhook đã test thật, chưa commit (mục D.7)**
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

### D.3 Giai đoạn 1 — đã làm (2026-10-06, commit `1704479`)

**Quyết định bổ sung (lượt duyệt 2):** Q3 đã trả lời (config có `pages_show_list, pages_read_engagement, read_insights,
pages_read_user_content, pages_manage_posts, business_management`; app Development; chưa Business Verification). Bình luận
đếm **cả phản hồi** (`comments.filter(stream)`). Từ giai đoạn này **không commit** — người dùng tự review/commit.

**Schema — Flyway V7 (chỉ thêm bảng, không sửa/xoá dữ liệu cũ):**
- `post_metric_snapshots`: số TÍCH LUỸ mỗi lần đồng bộ.
  - Cột dùng chung `views, reach, reactions, comments, shares, saves`, đều nullable.
  - `raw` jsonb (phản hồi gốc của Meta) + `source` (`POLL` | `BACKFILL`).
  - Index `(platform_media_id, collected_at desc)`.
- `post_metrics_daily`: số PHÁT SINH theo ngày giờ VN.
  - Cột `views/reactions/comments/shares/saves_delta` + `is_estimated`.
  - Unique `(platform_media_id, metric_date)`, index `metric_date`.
  - Không có `reach_delta` vì số người xem duy nhất không cộng dồn được qua các ngày.
- **Không thêm** unique cho `post_analytics(post_id, milestone_hours)`: dữ liệu thật có thể đã trùng (từng có nhiều instance cùng chạy job), thêm vào sẽ làm migration lỗi.

**Kiến trúc:**
- `PlatformMetricsProvider` có `fetchPostMetrics` / `fetchAccountMetrics` / `listPublishedPosts`.
  - `FacebookMetricsProviderImpl`: thu số liệu bài. Hai hàm còn lại `TODO giai đoạn 2`.
  - `ThreadsMetricsProviderImpl`: chỉ giữ nguyên cách thu số liệu bài cũ để không thoái lui; còn lại là stub `TODO`.
  - `InstagramMetricsProviderImpl`: stub, trả `UNSUPPORTED`.
  - Mọi lời gọi HTTP vẫn đi qua `MetaApiClient`.
- `AnalyticsSyncService(Impl)` làm toàn bộ việc đồng bộ.
- `AnalyticsCollectionJob` (giữ tên) chỉ điều phối, **chạy mỗi 5 phút**:
  1. `prepare`: tạo `platform_media` cho bài mới đăng, và **chép mốc cũ trong `post_analytics` sang snapshot `BACKFILL`** cho bài chưa có snapshot.
  2. `findDue`: lấy các bài đến hạn, gom theo tài khoản. Chỉ tài khoản đang ACTIVE.
  3. `syncAccount`: gọi provider, rồi mỗi bài một transaction gồm: snapshot → tính lại toàn bộ số theo ngày → mốc → lịch kế tiếp.
- **Số theo ngày** (`util/MetricDeltaDistributor`, hàm thuần):
  - Mốc gốc là (giờ đăng, 0). Phần tăng giữa hai snapshot được chia cho các ngày **theo tỷ lệ thời gian** (giờ VN), phần dư dồn vào ngày cuối.
  - Đoạn trải hơn một ngày được đánh `is_estimated`.
  - Metric null (chưa có quyền) bị bỏ qua: lần đầu có số, phần tăng tính từ giờ đăng.
- **Lịch đồng bộ theo tuổi bài:** dưới 24h mỗi 2h; dưới 3 ngày mỗi 6h; dưới 7 ngày mỗi 12h; dưới 30 ngày mỗi ngày; còn lại mỗi tuần.
  - Quá 90 ngày thì thôi quét định kỳ.
  - Bài **chưa đồng bộ lần nào** (kể cả bài cũ) luôn được quét **một lần**. Đây chính là bước "đồng bộ lại lượt xem cho bài cũ".
  - Luôn ép một lượt ngay sau mốc 24/48/168h.
- **`post_analytics` tính từ snapshot:**
  - Mốc mới = snapshot đầu tiên rơi vào `[mốc, mốc + 24h)`. Quá cửa sổ thì không tạo, để tránh gán số hôm nay cho mốc 24h.
  - Mốc đã có thì không tạo trùng.
  - **Mốc cũ không bị sửa:** dòng mốc cũ có `views` null vẫn null (xem câu hỏi Q9 dưới).

**API:**
- `/analytics/{summary,timeseries,by-platform}` = **delta** từ `post_metrics_daily`.
- `/analytics/{top-posts,by-content-type,activity-heatmap,insights,export}` = **bài đăng trong kỳ** + snapshot MỚI NHẤT (`LATERAL … LIMIT 1`).
- Hợp đồng API giữ nguyên.
- Mới:
  - `GET /analytics/sync-status`: kênh đăng, quyền `read_insights`, số bài đang theo dõi / chờ / đã dừng / lỗi quyền, lần đồng bộ cuối.
  - `POST /analytics/sync`: nút "Làm mới". Đưa bài về hạn ngay, job xử lý trong vòng 5 phút. Bỏ qua bài vừa đồng bộ dưới 15 phút và bài đang lỗi.
- Khoá cache 45 giây có thêm "lần đồng bộ gần nhất", nên số mới hiện ngay sau khi đồng bộ.

**Giao diện:**
- **Chế độ mẫu chỉ khi chưa có kênh đăng ACTIVE.** Đã kết nối thì luôn hiện dữ liệu thật, kể cả toàn số 0.
- Thanh trạng thái hiển thị:
  - "Cập nhật lần cuối" hoặc "Đang đồng bộ N bài…";
  - nút **Làm mới**;
  - cảnh báo Page thiếu `read_insights` / cần kết nối lại, kèm nút sang Cài đặt.
- Trang tự hỏi lại trạng thái mỗi 30 giây khi còn bài chờ đồng bộ hoặc vừa bấm "Làm mới", và tự tải lại khi có lượt đồng bộ mới.
- **Chú thích theo Q4:**
  - Tooltip KPI: "số phát sinh trong kỳ…".
  - Phụ đề biểu đồ: "Số phát sinh mỗi ngày".
  - Nền tảng: "phát sinh trong kỳ".
  - Top bài / loại nội dung / heatmap: "Bài đăng trong kỳ…".

**Vẫn đọc `post_analytics`:** bảng so sánh mốc (FR-62), optimizer (FR-67), giờ vàng (FR-48). Bảng điều khiển / Hồ sơ /
"Top chủ đề" đã chuyển sang bảng mới ở mục D.5.

**Câu hỏi mở**
- **Q9.** Có muốn điền `views` cho các dòng mốc cũ đang null không? Chỉ điền được bằng số **hiện tại** (không phải số tại mốc), nên em chưa làm. Đây là sửa dữ liệu cũ, cần anh/chị đồng ý.
- **Q10.** Có chuyển Bảng điều khiển / Hồ sơ sang bảng mới không?

**Ghi chú test `SubscriptionLifecycleTest` (không sửa, để anh/chị xử lý riêng):**
- 2 test hỏng: `activatePaidPlan_samePlanStillValid_accumulatesOntoExistingExpiry` và `activatePaidPlan_planWithoutEnumLabel_keepsPreviousLabel`.
- Cùng một nguyên nhân là "bom hẹn giờ":
  - test cố định `NOW = 2026-09-22T10:00`, nhưng `SubscriptionServiceImpl.getOrCreate` gọi `expireToFreePlan(subscription, LocalDateTime.now())` bằng **đồng hồ thật**;
  - hạn `NOW+5 ngày` (27/09) và `NOW+10 ngày` (02/10) đã qua → gói bị hạ về FREE trước khi `activatePaidPlan` chạy.
- Hướng sửa gợi ý: cho `getOrCreate` nhận `now` (hoặc inject `Clock`), hoặc test dùng ngày tương đối với `LocalDateTime.now()`.

### D.5 Q9 + Q10 (2026-10-07, commit `1704479`)

**Quyết định:**
- **Q9:** KHÔNG điền mốc cũ bằng số hiện tại.
- **Q10:** Bảng điều khiển, Hồ sơ và "Top chủ đề" đọc bảng mới, dùng chung cách tính với trang Phân tích. Bảng so sánh mốc (FR-62), tối ưu chiến lược và gợi ý giờ vàng vẫn đọc `post_analytics`, vì bảng này nay đã tính từ snapshot.

**Q9 — giao diện:**
- Bảng mốc 24h/48h/7 ngày **không còn hiển thị trên giao diện** (bị gỡ ở đợt v1, `af3f48c`). API `/analytics/posts` vẫn trả `views = null` cho mốc cũ.
- Nơi người dùng thấy lượt xem từng bài là **Top bài viết** (bảng, danh sách mobile, "Xem tất cả", chi tiết bài). Trước đây ô này ép số trống thành `0`.
- Nay backend trả `views = null` kèm cờ `legacyOnly`; cờ này bật khi snapshot mới nhất của bài là bản chép từ mốc cũ (`BACKFILL`).
- Giao diện (`MetricValue`) hiện **"—"** kèm tooltip:
  - `legacyOnly` → "Bài đăng trước khi có đồng bộ đầy đủ, không có số liệu tại mốc này";
  - còn lại → "Chưa có lượt xem — chưa cấp quyền read_insights hoặc nền tảng chưa trả số".
- Sắp xếp theo lượt xem: bài "—" luôn nằm cuối khi giảm dần. CSV để trống ô. Lượt xem trung bình trong chi tiết bài chỉ tính trên các bài có số.

**Q10 — chung nguồn với trang Phân tích:**
- Biểu đồ "Hiệu quả nội dung" trên Bảng điều khiển gọi **chính** `findDailyEngagementForUser`, cùng truy vấn với KPI/biểu đồ của trang Phân tích, không lọc gì:
  - "Lượt xem" = `views_delta`;
  - "Lượt tương tác" = cảm xúc + bình luận + chia sẻ phát sinh mỗi ngày.
- Nhãn đổi "Lượt tiếp cận" → "Lượt xem"; tiêu đề có tooltip giải thích.
- Hồ sơ "Tổng lượt xem" (trước là "Tổng tiếp cận") và "Top chủ đề": snapshot MỚI NHẤT mỗi bài, dùng cùng `LATERAL` với Top bài viết.
- Đã bỏ `findDailyPerformanceForUser` và `DailyMetricProjection` vì không còn dùng.
- Kiểm chứng: `AnalyticsRealDataPgTest` so từng ngày của Bảng điều khiển với `/analytics/timeseries` (cả lượt xem lẫn tương tác) và tổng lượt xem ở Hồ sơ trên Postgres thật.

**Cách kiểm tra số khớp giữa các trang**
1. Bảng điều khiển → "Hiệu quả nội dung" → **7 ngày**. Rê chuột lên từng điểm để lấy "Lượt xem" và "Lượt tương tác" của từng ngày.
2. Phân tích → khoảng **7 ngày** (mặc định, đến hôm nay), **không** lọc nền tảng/loại nội dung:
   - "Lượt xem" từng ngày trên biểu đồ = "Lượt xem" của Bảng điều khiển cùng ngày;
   - tổng thẻ KPI "Lượt xem" = tổng 7 điểm của Bảng điều khiển;
   - "Lượt thích" + "Bình luận" + "Chia sẻ" (KPI) = tổng "Lượt tương tác" 7 ngày của Bảng điều khiển.
3. Lặp lại với **30 ngày** ở cả hai trang.
4. Hồ sơ → "Tổng lượt xem" = tổng cột "Lượt xem" của mọi bài đã đăng. So nhanh: Phân tích, khoảng dài nhất bao trùm mọi bài (≤ 366 ngày), tổng thẻ "Lượt xem". Hai số bằng nhau khi mọi bài nằm trong khoảng đó.
5. Đối chiếu bằng SQL:
   ```sql
   -- Bảng điều khiển & Phân tích (7 ngày, giờ VN): cùng một con số
   select d.metric_date, sum(d.views_delta) views,
          sum(d.reactions_delta + d.comments_delta + d.shares_delta) engagement
   from post_metrics_daily d join platform_media m on m.id = d.platform_media_id and m.deleted_at is null
   join platform_accounts pa on pa.id = m.platform_account_id and pa.deleted_at is null
   left join posts p on p.id = m.post_id
   where pa.user_id = '<user_id>' and d.deleted_at is null and (p.id is null or p.deleted_at is null)
     and d.metric_date between current_date - 6 and current_date
   group by 1 order by 1;

   -- Hồ sơ: tổng lượt xem = snapshot mới nhất mỗi bài đã đăng
   select count(*) posts, coalesce(sum(la.views), 0) total_views
   from posts p join post_schedules ps on ps.id = p.schedule_id
   join platform_accounts pa on pa.id = ps.platform_account_id
   left join lateral (select s.views from platform_media m join post_metric_snapshots s on s.platform_media_id = m.id
                      where m.post_id = p.id order by s.collected_at desc limit 1) la on true
   where pa.user_id = '<user_id>' and p.status = 'POSTED' and p.deleted_at is null;
   ```
6. **Q9:** tìm bài chỉ có mốc cũ (thường là bài đã xoá trên Facebook trước khi có đồng bộ). Ô "Lượt xem" ở Top bài viết phải là "—"; rê chuột thấy tooltip.
   ```sql
   select p.platform_post_id from platform_media m join posts p on p.id = m.post_id
   where not exists (select 1 from post_metric_snapshots s where s.platform_media_id = m.id and s.source = 'POLL');
   ```

### D.6 Giai đoạn 2 — đã làm (2026-10-07, commit `1704479`)

**Quyết định (lượt duyệt 2026-10-07):** làm đủ (a) insights cấp Page, (b) import bài ngoài AIMA, (c) dọn snapshot thô quá
180 ngày, (d) báo IG chưa chuyên nghiệp; **khôi phục** bảng mốc 24h/48h/7 ngày (FR-62) trong modal chi tiết bài; **giữ
nguyên** mục "Mẫu màu" (một ô Đại dương); xong giai đoạn 2 thì **dừng chờ duyệt**, chưa sang giai đoạn 3.

**Schema — Flyway V8 (chỉ thêm, không sửa/xoá dữ liệu cũ):**
- `platform_media` thêm 3 cột nullable `media_type` (IMAGE/VIDEO/TEXT/OTHER theo nền tảng báo), `permalink`, `caption_excerpt`
  (≤ 300 ký tự) + index `(platform_account_id, published_at)`.
- `account_sync_state` (1 dòng / kênh, unique một phần): `next_sync_at` (null = không tự đồng bộ — kết nối mẫu dev-seed),
  `last_synced_at`, `consecutive_failures`, `posts_error_code`, `insights_error_code`, `last_error_at`,
  `instagram_link_status` (LINKED / NOT_LINKED, CHECK).
- `account_insights_daily`: `followers_count, follows, unfollows, views, reach, interactions` (nullable — null ≠ 0) + `raw` jsonb +
  `collected_at`; unique `(platform_account_id, metric_date)`; giữ vĩnh viễn. Ngày = ngày Meta tính (giờ Thái Bình Dương).

**Đồng bộ cấp tài khoản — `AnalyticsAccountSyncService(Impl)`**, gọi trong `AnalyticsCollectionJob` (mỗi 5 phút) **trước**
bước đồng bộ bài để bài vừa import được đồng bộ ngay trong lượt. Chỉ nền tảng có `PlatformMetricsProvider.supportsAccountSync()`
(hiện chỉ Facebook; IG/Threads vẫn stub). Mỗi kênh: đọc token trong transaction ngắn → gọi Meta NGOÀI transaction → ghi một
transaction.
- **Danh sách bài** `GET /{page-id}/published_posts?fields=id,created_time,permalink_url,message,attachments{media_type}`
  (cursor `after`, tối đa 10 trang × 100 bài/lượt). Lần đầu quét 90 ngày, sau đó từ lần thành công trước − 1 ngày. Meta từ chối
  trường `attachments` → đọc lại không kèm loại nội dung (loại = null, không đoán là bài chữ).
  - Bài chưa theo dõi → `platform_media` `origin = EXTERNAL`, `post_id` null; bài đã theo dõi (kể cả AIMA) → bổ sung
    permalink / loại nội dung / trích caption còn thiếu.
  - Loại nội dung: photo/album → IMAGE, video → VIDEO, không đính kèm → TEXT, còn lại → OTHER.
  - Bài AIMA vừa đăng mà bị quét trước khi có dòng theo dõi: `AnalyticsSyncService.prepare` **nhận lại** dòng EXTERNAL đó
    (gắn `post_id`, đổi origin AIMA) — không tạo trùng, số liệu đã thu giữ nguyên.
- **Insights Trang** `GET /{page-id}/insights?period=day&metric=page_daily_follows_unique,page_daily_unfollows_unique,page_follows,page_media_view,page_post_engagements`
  (lần đầu 90 ngày, sau đó 3 ngày gần nhất — Meta sửa số ~48h) + `GET /{page-id}?fields=followers_count` gắn vào ngày hôm nay.
  Một metric bị khai tử → hỏi lại từng metric, bỏ metric bị từ chối (log ERROR). Upsert theo (kênh, ngày); metric lần sau không
  trả thì **giữ số cũ**.
- **Liên kết Instagram**: OAuth callback và mỗi lượt đồng bộ ghi Trang có/không có `instagram_business_account`
  (không tra được → giữ trạng thái cũ, KHÔNG coi là "chưa liên kết").
- **Lịch / lỗi:** thành công → **1 giờ** sau (đổi từ 6 giờ ngày 07/10 sau khi kiểm thật: bài tự đăng phải hiện sớm). Lỗi danh sách bài → backoff như bài (thiếu quyền / token 24h; lỗi tạm 1h·2^(n−1) ≤ 24h);
  RATE_LIMIT → 1h, dừng cả lượt quét. Lỗi insights chỉ ghi `insights_error_code`, không làm hỏng phần danh sách bài.
  Nút "Làm mới" cũng đưa kênh về hạn (bỏ qua kênh vừa quét < 2 phút / đang lỗi); kết quả trả về = số bài + số kênh được xếp lịch.
- **Tự tải lại sau "Làm mới" (07/10):** `sync-status` trả thêm `accountSyncedAt` mỗi kênh. FE coi "phiên bản dữ liệu" = lần đồng bộ
  bài cuối + lần quét kênh cuối + số bài theo dõi; sau khi bấm "Làm mới" thanh trạng thái hiện "Đang chờ số liệu mới…", hỏi lại
  15 giây/lần tối đa 7 phút → phiên bản đổi thì tải lại mọi khối tại chỗ (giữ bộ lọc) + toast "Đã có số liệu mới"; hết 7 phút → toast
  "Chưa có số liệu mới". Khoá cache 45s có thêm lần quét kênh cuối.
- **Kiểm thật 07/10:** bài "hi" đăng tay 10:42 được nhập lúc 10:54 sau khi bấm "Làm mới" (EXTERNAL, IMAGE, 1 cảm xúc, 1 bình luận).
  Meta trả thừa một ngày SAU khoảng hỏi (toàn 0) → provider bỏ ngày > `to`; truy vấn tổng người theo dõi chỉ xét ngày ≤ hôm nay.

**Đọc số liệu:**
- Mọi truy vấn "bài ĐĂNG trong kỳ" (`top-posts`, `by-content-type`, `activity-heatmap`, `insights`, `export`) nay đi từ
  `platform_media` (LEFT JOIN `posts`) nên gồm cả bài ngoài AIMA; bài AIMA phải POSTED, chưa xoá mềm, lịch còn.
  Loại nội dung = `content_versions.media_format` (bài AIMA) hoặc `platform_media.media_type` (bài ngoài). **Đã đổi ở D.9:** mọi bài
  theo `platform_media.media_type`.
- Bộ lọc mới `source` trên mọi `/analytics/*`: `aima` = chỉ bài AIMA; bỏ trống/giá trị khác = toàn Trang (chốt Q5). FE `?source=aima`,
  mục "Nguồn bài → Chỉ bài đăng qua AIMA" trong popover Bộ lọc + chip.
- Top bài viết trả thêm `mediaId` (khoá dòng), `origin`, `permalink`, `platformStatus`; `postId`/`contentItemId` null với bài ngoài.
  FE: chip "Ngoài AIMA" / "Đã xoá", link "Mở trên nền tảng". CSV thêm cột `origin,permalink`.
- `insights` trả thêm `newFollowers` (Σ follows theo ngày, null khi không ngày nào có số), `newFollowersDeltaPct`,
  `followersTotal`. Số cấp Trang chỉ áp bộ lọc nền tảng. FE: ô thứ 6 "Người theo dõi mới"; dải "Thông tin chi tiết" thành 3 cột × 2 hàng.
- Bảng điều khiển ("Hiệu quả nội dung") dùng chung truy vấn nên nay cũng gồm bài ngoài AIMA (= trang Phân tích, không lọc).
  Hồ sơ "Tổng lượt xem" / "Top chủ đề", optimizer (FR-67), giờ vàng lịch đăng (FR-48) và FR-62 vẫn **chỉ bài AIMA**.
- `GET /connections` trả `instagramLinkStatus` cho Trang Facebook; Cài đặt › Kết nối hiện hướng dẫn khi chưa có Instagram nào:
  NOT_LINKED → "chuyển Instagram sang tài khoản chuyên nghiệp, liên kết với Trang rồi kết nối lại"; LINKED → "kết nối lại để thêm IG".
- **FR-62 khôi phục:** modal chi tiết bài (bài AIMA) có bảng "Số liệu theo mốc sau khi đăng" đọc `GET /analytics/posts/{postId}`:
  mốc chưa tới → "Chưa tới mốc"; đã qua mà không có dòng → "Không thu được số liệu ở mốc này"; views null → "—". Bài ngoài AIMA chỉ ghi chú.

**Dọn snapshot thô (c):** `LogRetentionJob` (03:30) xoá `post_metric_snapshots` có `collected_at` cũ hơn 180 ngày
(`METRIC_SNAPSHOT_RETENTION_DAYS`, 0 = tắt) **nhưng chỉ khi bài còn snapshot mới hơn** — snapshot mới nhất mỗi bài không bao giờ bị
xoá (Top bài viết / heatmap / Hồ sơ đọc nó). `post_metrics_daily` không bị đụng. Nếu bài cũ đã dọn được đồng bộ lại (hiếm: chỉ bài
chưa từng đồng bộ), phần lịch sử được chia đều lại từ ngày đăng (`is_estimated`) — tổng không đổi.

**Test:** `AnalyticsAccountSyncServiceIntegrationTest` 7 (H2 + Meta giả), `MetaApiClientImplTest` +6, `AnalyticsAggregateTest` +3,
`AnalyticsCollectionJobTest` 3, `AnalyticsRealDataPgTest` (PG: bài ngoài AIMA, lọc nguồn, người theo dõi, liên kết IG, dọn snapshot)
2, `PublishingMigrationTest` +1 (V8). Full suite 548 test, chỉ 15 lỗi cũ. FE build + 22/22. Ảnh nghiệm thu trên stack cô lập (dữ liệu
mẫu `ana-gd2@aima.local`, Page `uitest-gd2-page`).

**Cách kiểm với Meta thật (chưa ai làm):**
1. Backup DB rồi khởi động backend mới → Flyway áp **V8** (chỉ thêm). Lượt quét đầu (≤ 5 phút): log
   `[AnalyticsAccountSync] Tài khoản … (FACEBOOK): N bài mới ngoài AIMA, M ngày insights`.
2. Đăng tay 1–2 bài trực tiếp trên Page test (không qua AIMA). Bấm "Làm mới" ở /analytics (hoặc chờ ≤ 6 giờ):
   - Top bài viết có bài đó với chip "Ngoài AIMA", "Mở trên nền tảng" mở đúng bài; số khớp Business Suite.
   - Bộ lọc → "Chỉ bài đăng qua AIMA" → bài đó biến mất, KPI chỉ còn số của bài AIMA.
3. Ô "Người theo dõi mới" so với Business Suite → Thông tin chi tiết → Người theo dõi (cùng khoảng ngày; Meta tính ngày theo giờ
   Thái Bình Dương nên có thể lệch 1 ngày ở mép). Page dưới ~100 lượt thích có thể không có số theo ngày → ô hiện "—" (đúng thiết kế).
4. Cài đặt › Kết nối: Page chưa liên kết IG Business → khung hướng dẫn màu xanh dưới 3 thẻ nền tảng.
5. SQL:
   ```sql
   select platform_media_id, origin, media_type, permalink, platform_status, last_synced_at
   from platform_media where platform_account_id = '<page_account_id>' order by published_at desc;
   select metric_date, follows, unfollows, followers_count, views, interactions
   from account_insights_daily where platform_account_id = '<page_account_id>' order by metric_date desc limit 10;
   select next_sync_at, last_synced_at, consecutive_failures, posts_error_code, insights_error_code, instagram_link_status
   from account_sync_state where platform_account_id = '<page_account_id>';
   ```
   `insights_error_code = PERMISSION:…` → token Page thiếu `read_insights` (kết nối lại).

**Chưa làm / để sau:** Instagram/Threads cấp tài khoản (stub); phát hiện IG chỉ gián tiếp qua Trang (không biết IG cá nhân chưa
liên kết với Trang nào); chưa dùng Batch API / header `X-Business-Use-Case-Usage`; giai đoạn 3 (webhook `feed`, tần suất thích ứng,
nhân khẩu học, Graph v26).

### D.7 Giai đoạn 3 — đã làm (2026-10-07, commit `1704479`)

**Quyết định (07/10):** làm (1) webhook Page `feed` — bắt buộc kiểm chữ ký `X-Hub-Signature-256` bằng app secret, trả 200
nhanh rồi xử lý bất đồng bộ, chống xử lý trùng, đảm bảo Trang được `subscribed_apps` khi kết nối, kèm hướng dẫn từng bước
(cả test local bằng cloudflared/ngrok); (2) tần suất đồng bộ thích ứng; (3) **chỉ rà** changelog Graph v26 và ghi tài liệu,
KHÔNG đổi version mặc định. **Bỏ** nhân khẩu học (Meta đã khai tử họ `page_fans_*` của Trang; `follower_demographics` chỉ có
cho IG/Threads — ngoài phạm vi). App vẫn ở Development. Xong thì dừng.

**Webhook `feed`** (hướng dẫn cấu hình: [`META_WEBHOOK_SETUP.md`](./META_WEBHOOK_SETUP.md)):
- **Flyway V9** (chỉ thêm): bảng `meta_webhook_events` (một dòng / `entry[].changes[]`, `dedupe_key` unique = SHA-256(id Trang |
  entry.time | nội dung change), `status` PENDING/PROCESSED/IGNORED/FAILED, `attempts`, `last_error`); cột
  `account_sync_state.webhook_subscribed_at` + `webhook_error_code`.
- `MetaWebhookServiceImpl.handleEvent` (POST `/webhooks/meta`, public): kiểm chữ ký TRƯỚC → mỗi thay đổi lưu một dòng
  (trùng → bỏ) → giao `MetaWebhookEventWorker.process` (`@Async("metaWebhookExecutor")`, hàng đợi đầy thì để PENDING) →
  trả 200. Bỏ việc ghi `system_logs` cho MỌI event (feed rất nhiều sự kiện); bảng sự kiện thay vai trò lưu vết. Chữ ký sai vẫn
  ghi `system_logs`.
- Worker (một transaction / sự kiện, khoá dòng `PESSIMISTIC_WRITE` nên worker và job không xử lý trùng):
  - bài `verb=remove` (item status/post/photo/video) → `AnalyticsSyncService.markDeleted`: trạng thái riêng "Đã xoá trên nền
    tảng" (DELETED + STOPPED ngay), giữ số liệu cuối cùng. **Không** đánh FAILED, **không** thông báo "bị nền tảng gỡ" (quyết định
    07/10 sau khi test thật — payload không phân biệt Meta gỡ hay người dùng tự xoá; thay hành vi SEC-06 cũ của webhook). FE: nhãn
    xám "Đã xoá trên nền tảng";
  - bài `verb=add` → `AnalyticsAccountSyncService.markDueForPage` (quét Trang ở lượt job kế tiếp);
  - comment/reaction/share/like → `AnalyticsSyncService.syncSoon(post, 5 phút)` (không lùi lịch đã sớm hơn, bỏ bài đã dừng);
  - còn lại → IGNORED.
- `MetaWebhookEventJob` (mỗi phút, ShedLock `meta-webhook-events`) xử lý lại sự kiện PENDING > 2 phút; lỗi 3 lần → FAILED.
- `subscribed_apps`: `MetaApiClient.subscribePageWebhook` (POST form `subscribed_fields=feed`). Gọi SAU commit của OAuth callback
  cho từng Trang (`ensureWebhookSubscribed`), và mỗi lượt quét Trang nếu chưa đăng ký được (thiếu `pages_manage_metadata` →
  `webhook_error_code`).
- `LogRetentionJob` dọn `meta_webhook_events` không PENDING > 30 ngày (`WEBHOOK_EVENT_RETENTION_DAYS`).
- Sự kiện test của App Dashboard (`entry.id = "0"`) được lưu thẳng `IGNORED` (không giao worker, không ghi log lỗi).
- **Kiểm thật 07/10:** webhook chạy thành công. Phát hiện: app ở **Development** thì Meta KHÔNG gửi webhook dữ liệu thật (chỉ webhook
  test từ Dashboard, page_id = 0) — phải chuyển app sang **Live** (ghi ở `META_WEBHOOK_SETUP.md` mục 6).
- `PostRepository.findByPlatformPostIdAndDeletedAtIsNull` (chỉ phục vụ luồng FAILED cũ) đã bỏ.

**Tần suất thích ứng** (`AnalyticsSyncServiceImpl.nextSyncAt(published, now, engagementPerHour)`): tốc độ = (cảm xúc + bình luận
+ chia sẻ) tăng thêm / giờ so với snapshot trước (bỏ qua nếu hai lần cách < 15 phút; lượt xem không dùng vì trễ 24–48h).
≥ 5 tương tác/giờ → chu kỳ theo tuổi chia đôi (không dưới 1 giờ); bài ≥ 24h không có tương tác mới → nhân đôi (tối đa 7 ngày);
còn lại / không đo được → lịch theo tuổi như cũ. Mốc 24/48/168h vẫn luôn được ép. Webhook (nếu bật) còn kéo bài về sớm hơn nữa.

**Rà Graph API v26.0** (phát hành 29/07/2026; v25.0 dùng tới **29/07/2028**). Không đổi version mặc định (admin chuyển ở
`/admin/api-versions` khi muốn):
- **Không thay đổi** với mọi lời gọi AIMA đang dùng: fields `reactions/comments.filter(stream)/shares` của bài, insights
  `post_media_view`, `/{page-id}/published_posts`, insights Trang `page_daily_follows_unique, page_daily_unfollows_unique,
  page_follows, page_media_view, page_post_engagements` (period=day), `followers_count`, `instagram_business_account{…}`,
  `subscribed_apps` + payload `feed` (item/verb/post_id), `POST /{page-id}/feed`, `/me/accounts`, `/me/permissions`, OAuth.
- v26 chặn các tính năng cũ `pretty`, `debug`, `date_format`, `GET /?ids=…`, cache `If-None-Match`/ETag — và **từ khoảng
  27/10/2026 chặn trên MỌI phiên bản kể cả v25**. Đã grep: backend/AI **không dùng** cái nào.
- v26 bỏ 5 field Trang (`current_location, genre, network, parking, start_info`) + `auto_publish_page_info_updates` — không dùng.
- v25 (19/05 & 15/06/2026) đã khai tử trên mọi phiên bản `page_impressions_unique`, `page_posts_impressions*`,
  `post_impressions_unique*`, `*_video_views_unique`, metric story — AIMA không gọi.
- Webhook mTLS: từ 31/03/2026 chứng chỉ client của Meta ký bằng CA riêng `meta-outbound-api-ca-2025-12.pem` — chỉ ảnh hưởng nếu
  server kiểm chứng chỉ client (AIMA không).
- Chưa xác minh được: thay đổi ngoài chu kỳ năm 2026 (trang out-of-cycle chưa có mục 2026); tài liệu Post v26 ghi đọc bài Trang cần
  `pages_manage_posts` + Page Public Content Access — AIMA đọc bài Trang của chính mình bằng Page token và đã kiểm thật được (07/10).
- Nguồn: developers.facebook.com/docs/graph-api/changelog (+ /version26.0, /version25.0, /out-of-cycle-changes),
  /docs/graph-api/reference/insights, /docs/platforminsights/page/deprecated-metrics, /docs/graph-api/webhooks
  (+ /reference/page, /getting-started/webhooks-for-pages), blog 2026/07/29 "Introducing Graph API v26".
- **Cách nâng khi cần:** admin → API versions → Facebook → đặt `v26.0` (áp ngay, cache 5 phút) → theo dõi log `[Meta]` + chạy
  Làm mới ở trang Phân tích; có lỗi thì đặt lại `v25.0`. Instagram dùng chung Graph version.

**Test:** `MetaWebhookFeedIntegrationTest` 7 (H2: chữ ký sai, chống trùng, tương tác → 5 phút, không lùi lịch sớm hơn, xoá bài
không FAILED / không thông báo / giữ số cuối, sự kiện test page_id 0, bỏ qua), `AnalyticsSyncServiceIntegrationTest` +2 (tần suất thích ứng), `AnalyticsAccountSyncServiceIntegrationTest` +1 và
mở rộng (subscribed_apps), `MetaApiClientImplTest` +2, `MetaOAuthServiceImplTest` (gọi đăng ký webhook), `PublishingMigrationTest`
+1 (V9).

**Cách kiểm thật:** theo [`META_WEBHOOK_SETUP.md`](./META_WEBHOOK_SETUP.md) bước 1–6 (cần thêm `META_WEBHOOK_VERIFY_TOKEN`, URL
HTTPS công khai / tunnel, quyền `pages_manage_metadata`, kết nối lại Facebook). Không bật webhook thì mọi thứ vẫn chạy bằng lịch.

### D.8 Lỗi phát hiện khi kiểm thật (2026-10-07, commit `1704479`)

**1. Bài đăng qua AIMA bị gắn "Ngoài AIMA" + bản ghi trùng.** Không phải lệch ID: AIMA chỉ đăng bài chữ qua `POST /{page}/feed`
(Graph trả `pageid_postid`), trùng dạng id của `published_posts` và webhook. Nguyên nhân gốc: mỗi lần **ngắt kết nối rồi kết nối
lại** tạo dòng `platform_accounts` MỚI (dòng cũ xoá mềm; DB thật có 5 lần kết nối Trang AIMA Marketing). `platform_media` gắn theo
dòng kết nối → bài cũ (kể cả bài AIMA) kẹt ở kết nối đã xoá (truy vấn Phân tích lọc `pa.deleted_at is null` nên bị ẩn), lượt quét
Trang của kết nối mới không thấy → tạo bản `EXTERNAL` trùng. DB thật: 3 bài × 3 bản.
- Sửa code: `AnalyticsAccountSyncService.adoptPreviousConnections` — gọi trong `MetaOAuthServiceImpl.upsert` khi tạo dòng kết nối
  mới: chuyển bài đang theo dõi của các kết nối cũ (cùng user + nền tảng + id tài khoản nền tảng) sang kết nối mới; trùng id → giữ
  bản gắn bài AIMA (không thì bản cũ nhất), chuyển snapshot của bản bị gộp sang, xoá mềm bản bị gộp + số theo ngày của nó, đồng bộ
  lại bản giữ ngay.
- Chuẩn hoá id bài Facebook một dạng `pageId_postId` (`util/FacebookPostIds`) ở mọi điểm vào: kết quả đăng bài (ưu tiên `post_id`
  nếu Graph trả — endpoint ảnh trả id ẢNH ở `id`), `published_posts`, webhook. Ghi chú ảnh/nhiều ảnh/video trong javadoc.
- Dữ liệu cũ: **Flyway V10** `V10__merge_reconnect_duplicate_media.sql` (người dùng duyệt 07/10) — chạy lại an toàn (chỉ xử lý nhóm
  còn trùng / còn ở kết nối đã xoá), chỉ xoá mềm, không đụng `posts`, `post_analytics`, `account_insights_daily`. Bản tham khảo + truy
  vấn xem trước: `docs/sql/analytics_merge_reconnect_duplicates.sql` (PHẦN A sau V10 phải trả 0 dòng). Dry-run trên DB thật trước V10:
  3 bài, giữ 3 bản (bài AIMA giữ bản gắn bài AIMA), gộp 6 bản.

**2. Lượt xem 3–4/ngày từ 01/10–06/10 dù bài trong kỳ đăng 07/10.** Số đến từ bài **29/09** "Bạn đã bao giờ rơi vào tình trạng cạn
kiệt…" (bài tự đăng). Lần đồng bộ đầu tiên (07/10) mới thấy 38 lượt xem → `MetricDeltaDistributor` **chia đều** từ ngày đăng tới
ngày thu (thiết kế D.3, `is_estimated = true`). KPI/biểu đồ là số PHÁT SINH trong kỳ (Q4) nên tính cả bài đăng trước kỳ. Không gán
sai ngày. Người dùng chọn (a) giữ chia đều + hiển thị: `/analytics/timeseries` trả `points[].estimated`
(`bool_or(post_metrics_daily.is_estimated)` theo ngày); biểu đồ vẽ điểm rỗng viền đứt cho ngày ước tính (điểm thật tô đặc), tooltip
"Ước tính (chia đều từ ngày đăng đến lần đồng bộ đầu tiên)", chú thích nhỏ dưới biểu đồ khi kỳ có ngày ước tính (vi/en).

**Dọn `meta_webhook_events`:** có — `LogRetentionJob` (03:30 hằng ngày) xoá sự kiện KHÔNG còn PENDING (PROCESSED/IGNORED/FAILED) cũ
hơn 30 ngày (`WEBHOOK_EVENT_RETENTION_DAYS`, 0 = tắt).

### D.9 Việc còn mở sau bàn giao (2026-10-07 tối, chưa commit)

**1. "Hiệu suất theo loại nội dung" xếp bài chữ vào Video — đã sửa.** Xác nhận trên DB thật (truy vấn chỉ đọc): bài AIMA 07/10
có `platform_media.media_type = TEXT` (nền tảng báo) nhưng `content_versions.media_format = video` (định dạng media AI gợi ý — AIMA
chỉ đăng chữ) → SQL `coalesce(cv.media_format, m.media_type)` xếp vào VIDEO. Theo mục 3.4 (dùng loại nền tảng báo):
- Nhãn mọi truy vấn `/analytics/*` (`PostAnalyticsRepository`, 7 chỗ): `coalesce(m.media_type, case when m.origin = 'AIMA' then
  'TEXT' end, 'OTHER')` — bài AIMA chưa được quét danh sách bài (Threads, bài > 90 ngày, chưa tới lượt) = TEXT vì AIMA hiện chỉ đăng
  bài chữ (FB `/feed`, Threads `TEXT`; IG bị chặn `IG_MEDIA_REQUIRED`); bài ngoài không rõ = OTHER. Bỏ join `content_versions` /
  `post_schedules` không còn dùng. Quét danh sách bài vẫn ghi đè loại khi nền tảng trả giá trị (nền tảng là nguồn đúng).
  ⚠️ Khi AIMA đăng được ảnh/video, phải ghi `media_type` lúc đăng (hoặc sửa nhánh fallback này).
- Ô "Bài lỗi & cần xử lý" (`PostRepository.countFailedForUserInRange`): bài lỗi chưa lên nền tảng → TEXT (cùng quy ước).
- Facebook `attachments.media_type` `video_inline` / `video_autoplay` (dạng video thường gặp trên Trang) trước rơi vào OTHER → nay
  VIDEO (`FacebookMetricsProviderImpl.mediaType`). Dữ liệu cũ tự đúng ở lượt quét kế tiếp (ghi đè khi nền tảng trả giá trị).
- Donut "Loại nội dung" của Bảng điều khiển KHÔNG đổi: nó đếm bản nội dung đã tạo theo định dạng AI gợi ý (khái niệm khác, không phải bài đã đăng).
- Test: `AnalyticsRealDataPgTest` (fixture bài AIMA nay mang `media_format = video` → vẫn phải ra TEXT; test mới bài AIMA chưa có
  nhãn nền tảng → TEXT, lọc VIDEO = 0), `FacebookMetricsProviderImplTest` (ánh xạ attachment).

**2. "Đã xoá trên nền tảng" — thêm hướng dẫn.** Tooltip ghi rõ "bạn đã xoá hoặc nền tảng đã gỡ"; modal chi tiết bài thay link
"Mở trên nền tảng" (đã chết) bằng ghi chú: vì sao (Meta không cho biết lý do), số liệu dừng ở lần thu cuối và vẫn tính trong báo cáo,
làm gì tiếp (không tự xoá → xem Chất lượng tài khoản / thông báo Trang trên Meta trước khi đăng lại nội dung tương tự).
**"Đã xoá bởi bạn" CHƯA làm:** chỉ phân biệt được khi AIMA có chức năng xoá bài trên nền tảng (`DELETE /{post-id}`, quyền
`pages_manage_posts` đã có) và ghi lại thao tác đó — cần người dùng quyết định có làm chức năng này không.

**3. Nhãn ngày theo ngôn ngữ.** `formatRangeLabel` / `formatRangeShort` / `formatDayMonth` nhận `lang` (vi `dd/MM/yyyy`, en
`MM/dd/yyyy`): nút khoảng ngày, tiêu đề sheet lọc mobile, `RangeBadge` góc card, nhãn kỳ so sánh dưới KPI ("vs …") và trục ngày
biểu đồ. Nghiệm thu headless (stack cô lập, `ana-gd2@aima.local`): popover nằm trọn viewport ở 390 / 820 / 1280px, không cuộn ngang,
vi/en đổi đúng định dạng; modal bài "Đã xoá trên nền tảng" hiện ghi chú, không còn link "Mở trên nền tảng".

**Kiểm chứng:** backend full suite 567 test, chỉ 15 lỗi cũ; FE build sạch + 30/30 test.

**4. Kiểm tra trên DB thật (chỉ đọc):** `flyway_schema_history` có V6 → V10 `success = t` (áp 06–07/10).

### D.4 Cách kiểm tra Giai đoạn 1

**Chuẩn bị**
- Backup DB rồi khởi động backend có code mới. Flyway tự áp **V7**, và **V6** nếu chưa áp.
- ⚠️ Backend thật còn bật job đăng bài đến hạn.
- Page test đã kết nối lại và có `read_insights`.
- Job chạy mỗi 5 phút. Lượt đầu (ngay khi khởi động) sẽ:
  - chép mốc cũ sang snapshot;
  - đồng bộ lại **mọi bài AIMA đã đăng** (kể cả bài cũ quá 90 ngày, mỗi bài một lần).
- Log cần thấy: `[AnalyticsCollection] Đã chuẩn bị N bài` và `[AnalyticsSync] Tài khoản … (FACEBOOK): x/y bài đã cập nhật`.

**Trên giao diện (`/analytics`)**
1. Tài khoản có Page ACTIVE → **không còn chip "Dữ liệu mẫu"**.
   - Thanh trạng thái hiện "Đang đồng bộ N bài…" (lượt đầu), rồi "Cập nhật lần cuối dd/MM/yyyy HH:mm".
   - Trang tự tải lại khi đồng bộ xong.
2. Chọn 7/30 ngày:
   - KPI "Lượt xem / Thích / Bình luận / Chia sẻ" = số **phát sinh** trong kỳ. Rê chuột vào nhãn KPI để xem giải thích.
   - Đối chiếu **Meta Business Suite → Thông tin chi tiết → Nội dung**, cùng khoảng ngày, với các bài đăng qua AIMA.
   - Lượt xem của 1–2 ngày gần nhất có thể thấp hơn vì Meta trả trễ.
   - Bài cũ được đồng bộ lại lần đầu sẽ có số rải đều từ ngày đăng tới hôm nay (ước tính).
3. **Top bài viết:** mỗi dòng = số liệu mới nhất của bài (Lượt xem = "Lượt xem", Thích = tổng cảm xúc, Bình luận gồm cả phản hồi). So từng bài trên Business Suite.
4. **Tỷ lệ tương tác TB** = (cảm xúc + bình luận + chia sẻ) / lượt xem của các bài đăng trong kỳ; hiện "—" khi không có lượt xem.
5. **Làm mới:**
   - Vừa đồng bộ dưới 15 phút → báo "Số liệu vừa được cập nhật".
   - Quá 15 phút → "Đã xếp lịch cập nhật N bài". Trong ≤ 5 phút thanh trạng thái đổi giờ và số liệu tự tải lại.
6. Gỡ quyền `read_insights` (hoặc dùng Page chưa cấp) → cảnh báo vàng "Trang … chưa cấp quyền read_insights" + nút "Kết nối lại".
7. Tài khoản chưa kết nối kênh nào → vẫn hiện "Dữ liệu mẫu" như cũ.

**Qua SQL** (thay `<post_id_nền_tảng>` bằng `posts.platform_post_id`):
```sql
-- 1) Bài đang theo dõi + trạng thái đồng bộ
select platform_media_id, platform_status, sync_status, consecutive_failures, last_error_code,
       last_synced_at at time zone 'Asia/Ho_Chi_Minh' as last_synced_vn,
       next_sync_at  at time zone 'Asia/Ho_Chi_Minh' as next_sync_vn
from platform_media order by published_at desc;

-- 2) Chuỗi snapshot tích luỹ của một bài (BACKFILL = chép từ mốc cũ, POLL = gọi Meta)
select s.collected_at at time zone 'Asia/Ho_Chi_Minh' as at_vn, s.source, s.views, s.reactions, s.comments, s.shares
from post_metric_snapshots s join platform_media m on m.id = s.platform_media_id
where m.platform_media_id = '<post_id_nền_tảng>' order by s.collected_at;

-- 3) Số phát sinh theo ngày của bài đó — TỔNG mỗi cột phải bằng snapshot mới nhất
select d.metric_date, d.views_delta, d.reactions_delta, d.comments_delta, d.shares_delta, d.is_estimated
from post_metrics_daily d join platform_media m on m.id = d.platform_media_id
where m.platform_media_id = '<post_id_nền_tảng>' order by d.metric_date;

-- 4) KPI 7 ngày như trang hiển thị (đổi ngày cho khớp bộ lọc)
select sum(d.views_delta) views, sum(d.reactions_delta) reactions, sum(d.comments_delta) comments, sum(d.shares_delta) shares
from post_metrics_daily d join platform_media m on m.id = d.platform_media_id
join platform_accounts pa on pa.id = m.platform_account_id
where pa.user_id = '<user_id>' and d.metric_date between current_date - 6 and current_date;

-- 5) Mốc 24/48/168h (mốc mới tính từ snapshot; mốc cũ giữ nguyên)
select a.milestone_hours, a.views, a.likes, a.comments, a.shares, a.collected_at
from post_analytics a join posts p on p.id = a.post_id
where p.platform_post_id = '<post_id_nền_tảng>' order by 1;
```

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
