# Bàn giao: Analytics dữ liệu thật từ Meta

> Cập nhật: **2026-10-07 (tối — làm nốt việc còn mở, mục D.9)** · Kế hoạch đầy đủ + quyết định: [`analytics-real-data-plan.md`](./analytics-real-data-plan.md)
> (mục **D** thắng mọi chỗ khác; D.1 = Giai đoạn 0, D.3/D.4 = Giai đoạn 1, D.5 = Q9/Q10, **D.6 = Giai đoạn 2**, D.7 = Giai đoạn 3, D.8 = sửa sau kiểm thật, **D.9 = việc còn mở sau bàn giao**).
> Đọc file này trước khi làm tiếp — không cần khảo sát lại.
> Tiêu đề D.3–D.8 trong kế hoạch đã sửa thành commit `1704479`.

---

## 1. Tóm tắt tiến độ

**Toàn bộ GĐ0–3 + D.8 đã commit VÀ đã push**: `main` = `dev` = `origin/main` = `origin/dev` = `fd7fc14` (gồm `1b52e26`, `1704479`).
D.9 (bên dưới) **chưa commit** — chỉ ở working tree. Chưa xác minh Render đã deploy bản mới hay chưa.

| Hạng mục | Trạng thái | Commit · Migration |
|---|---|---|
| Khảo sát + kế hoạch (`analytics-real-data-plan.md`) | ✅ Xong, đã duyệt | `1b52e26` |
| **Giai đoạn 0**: FB `post_impressions` → `post_media_view`, đếm mọi cảm xúc, dừng gọi lại vô hạn, sửa mock 194.2% | ✅ Xong, đã duyệt | `1b52e26` · **V6** |
| **Giai đoạn 1**: snapshot + số theo ngày, adapter `PlatformMetricsProvider`, đồng bộ lại bài cũ, `/analytics/*` đọc dữ liệu thật, thanh trạng thái đồng bộ | ✅ Xong, **đã kiểm với Meta thật** (khớp Business Suite, Page **AIMA Marketing**) | `1704479` · **V7** |
| **Q9**: không điền mốc cũ, giao diện hiện "—" + tooltip | ✅ Xong (kiểm bằng test) | `1704479` |
| **Q10**: Bảng điều khiển / Hồ sơ / Top chủ đề dùng chung nguồn với trang Phân tích | ✅ Xong (kiểm bằng test PG) | `1704479` |
| Bỏ mẫu màu Tím sương / Hồng sương, giữ Đại dương | ✅ Xong (ngoài analytics) | `1704479` |
| **Giai đoạn 2** (D.6): (a) insights cấp Page + ô "Người theo dõi mới", (b) import bài ngoài AIMA + lọc "Chỉ bài AIMA", (c) dọn snapshot thô > 180 ngày, (d) báo Trang chưa liên kết IG Business; kèm bảng mốc 24h/48h/7 ngày (FR-62) trong modal | ✅ Code xong + test; kiểm một phần với Meta thật 07/10 (bài tự đăng được nhập sau "Làm mới") | `1704479` · **V8** |
| **Giai đoạn 3** (D.7): webhook Page `feed` (chữ ký, chống trùng, xử lý nền, `subscribed_apps`), tần suất thích ứng, rà Graph v26 (chỉ tài liệu); bỏ nhân khẩu học | ✅ Xong + **webhook đã test thật** (app ở Live, qua tunnel); xoá bài → "Đã xoá trên nền tảng", không FAILED / không thông báo | `1704479` · **V9** |
| **D.8** sửa sau kiểm thật: gộp lịch sử khi kết nối lại + chuẩn hoá id bài FB; đánh dấu ngày ước tính trên biểu đồ | ✅ Xong | `1704479` · **V10** |
| Popover khoảng ngày `/analytics` tràn mép phải; ô nhập ngày theo ngôn ngữ | ✅ Code xong (`FilterPopover` kẹp vào viewport, `formatDateInput/parseDateInput` vi `dd/MM/yyyy` · en `MM/dd/yyyy`); nhãn nút + `RangeBadge` theo ngôn ngữ (D.9) | `1704479` + D.9 |
| **D.9** việc còn mở: widget "loại nội dung" theo loại nền tảng báo (hết xếp bài chữ vào Video), FB `video_inline/autoplay` → VIDEO, hướng dẫn "Đã xoá trên nền tảng", nhãn khoảng ngày theo ngôn ngữ | ✅ Code + test xong | **chưa commit** · không migration |

**Lỗi phát hiện khi kiểm thật (D.8):** bài AIMA bị "Ngoài AIMA" do kết nối lại tạo dòng kết nối mới — code đã sửa + **Flyway V10** gộp dữ liệu cũ (duyệt 07/10, tự chạy khi khởi động backend; backup trước). Lượt xem rải đều trước ngày đăng = ước tính chia đều — biểu đồ nay đánh dấu điểm rỗng viền đứt + tooltip + chú thích.

**Còn mở (chưa làm):**
- Nhãn **"Đã xoá bởi bạn"**: chưa có — người dùng **đã đồng ý (07/10) làm chức năng xoá bài trên nền tảng ở phiên sau**; yêu cầu chi tiết ở `docs/PLAN.md` → Backlog
  (`DELETE /{post-id}`, quyền `pages_manage_posts` đã có). Không có chức năng đó thì không có nguồn nào phân biệt "bạn xoá" với
  "nền tảng gỡ" (payload webhook `remove` không nói). Nhãn "Đã xoá trên nền tảng" nay đã có hướng dẫn vì sao / làm gì tiếp (D.9).
- `SubscriptionLifecycleTest` + 13 test gọi URL cũ + script `frontend/scripts/dark-mode/*.mjs`: đã đưa vào `docs/PLAN.md` → Backlog (07/10).
- Popover khoảng ngày: đã chụp ảnh headless đạt (D.9) — vẫn nên nhìn lại bằng mắt trên trình duyệt thật.

**Việc tiếp theo (người dùng chọn):** deploy production (push + Render + webhook URL production) → tách Test App Meta cho localhost → Instagram → Threads → Business Verification / App Review. Chi tiết mục 6.

---

## 2. Quy tắc làm việc đã chốt

- **Claude KHÔNG commit / push / tạo nhánh / stage.** Chỉ sửa working tree; xong mỗi phần thì liệt kê file + tóm tắt. Người dùng tự review và commit.
- Mỗi giai đoạn xong thì **dừng chờ duyệt**.
- Migration **chỉ thêm**; muốn sửa/xoá dữ liệu cũ phải hỏi trước. (Dọn snapshot thô > 180 ngày đã được duyệt 07/10.)
- **Không sửa / không skip `SubscriptionLifecycleTest`** (người dùng tự xử lý — nguyên nhân ở mục 7).
- Phạm vi hiện tại: **chỉ Facebook Page**. Instagram/Threads chỉ có adapter stub + TODO. Không sửa `IG_MEDIA_REQUIRED`.
- Quyết định nghiệp vụ:
  - **Q4:** KPI + biểu đồ theo ngày + theo nền tảng = **số phát sinh trong kỳ**. Top bài / heatmap / theo loại nội dung / insights = **bài đăng trong kỳ**, số mới nhất.
  - **Tỷ lệ tương tác** = (cảm xúc + bình luận + chia sẻ) / lượt xem; "—" khi không có lượt xem.
  - Bình luận đếm **cả phản hồi** (`comments.filter(stream)`).
  - **Q5:** bài ngoài AIMA — mặc định hiển thị toàn Page, có bộ lọc "Chỉ bài AIMA" (đã làm ở GĐ2).
  - **Q6:** `post_analytics` giữ mốc 24h/48h/7 ngày, tính từ snapshot.
  - **Q7:** snapshot thô giữ 180 ngày (luôn giữ bản mới nhất mỗi bài), số theo ngày giữ vĩnh viễn.
  - **Q9:** không điền mốc cũ.
  - **Q10:** chỉ FR-62 / tối ưu chiến lược / giờ vàng còn đọc `post_analytics`.
  - **07/10:** khôi phục bảng mốc FR-62 trong modal chi tiết bài; giữ nguyên mục "Mẫu màu" (một ô Đại dương).
- Quyền Meta (Login configuration): `pages_show_list, pages_read_engagement, read_insights, pages_read_user_content, pages_manage_posts, business_management`.
  Webhook `feed` cần thêm `pages_manage_metadata` (`META_WEBHOOK_SETUP.md` bước 4).
  - App chính đang ở **Live** (Development không nhận webhook dữ liệu thật), **chưa Business Verification / App Review**.
  - Hệ quả của Live: Meta **chặn redirect URI `localhost`** → không kết nối OAuth được từ máy local bằng app chính (cần Test App riêng — mục 6).

---

## 3. Đã làm — tóm tắt kỹ thuật

### Giai đoạn 0 (đã commit `1b52e26`)
- `MetaApiClientImpl`: FB lượt xem `post_media_view`; `reactions.summary(total_count)` thay `likes`; lỗi thu số liệu ném `MetricsFetchException` + `MetricsErrorType`.
- Flyway **V6** `platform_media` (mỗi bài trên nền tảng một dòng + trạng thái đồng bộ). Mock FE hết 194.2%.

### Giai đoạn 1 + Q9/Q10 (commit `1704479`) — chi tiết D.3 / D.5
- **V7** `post_metric_snapshots` (tích luỹ) + `post_metrics_daily` (phát sinh theo ngày VN).
- Adapter `PlatformMetricsProvider` (Facebook thật, Threads giữ hành vi cũ, Instagram stub).
- `AnalyticsSyncService(Impl)` + `AnalyticsCollectionJob` (5 phút): prepare → findDue → syncAccount; mốc 24/48/168h từ snapshot.
- API delta / bài đăng trong kỳ; `GET /analytics/sync-status`, `POST /analytics/sync`. FE thanh đồng bộ, "—" cho mốc cũ, Dashboard/Hồ sơ chung nguồn.

### Giai đoạn 2 (commit `1704479`) — chi tiết D.6
- **V8** (chỉ thêm): `account_sync_state`, `account_insights_daily`, cột `platform_media.media_type/permalink/caption_excerpt`.
- `AnalyticsAccountSyncService(Impl)` (job gọi trước bước đồng bộ bài, 1 giờ/kênh; "Làm mới" xếp lại ngay nếu kênh đã quét > 2 phút): `published_posts` → bài EXTERNAL; insights Trang + `followers_count`; kiểm IG Business. `prepare` nhận lại dòng EXTERNAL của bài AIMA vừa đăng.
- `MetaApiClient`: `getPagePublishedPosts`, `getPageInsights` (metric bị khai tử tự bỏ), `getPageFollowersCount`.
- Truy vấn "bài đăng trong kỳ" đi từ `platform_media`; tham số `source=aima` trên mọi `/analytics/*`; Top bài thêm `mediaId/origin/permalink/platformStatus`; insights thêm `newFollowers/newFollowersDeltaPct/followersTotal`; CSV thêm `origin,permalink`.
- `LogRetentionJob` dọn snapshot thô > 180 ngày (`METRIC_SNAPSHOT_RETENTION_DAYS`), giữ bản mới nhất.
- `GET /connections` trả `instagramLinkStatus`; OAuth callback ghi trạng thái liên kết IG.
- FE: mục "Nguồn bài → Chỉ bài đăng qua AIMA" + chip; chip "Ngoài AIMA"/"Đã xoá"; "Mở trên nền tảng"; ô "Người theo dõi mới" (dải 3 cột × 2 hàng); bảng mốc 24h/48h/7 ngày trong modal; hướng dẫn liên kết IG ở Cài đặt › Kết nối.

### Giai đoạn 3 + D.8 (commit `1704479`) — chi tiết D.7 / D.8
- **V9** (chỉ thêm): `meta_webhook_events` + `account_sync_state.webhook_subscribed_at/webhook_error_code`. Webhook `feed`: kiểm chữ ký → lưu + chống trùng → trả 200 → worker `metaWebhookExecutor` + `MetaWebhookEventJob`; `subscribed_apps` sau khi kết nối. Tần suất đồng bộ thích ứng. Hướng dẫn cấu hình: `META_WEBHOOK_SETUP.md`.
- **V10** gộp bản `platform_media` trùng do kết nối lại (idempotent, chỉ xoá mềm); `adoptPreviousConnections` khi kết nối lại; `util/FacebookPostIds` chuẩn hoá id `pageId_postId`; `/analytics/timeseries` trả `points[].estimated`.
- FE kèm theo: `FilterPopover` kẹp vào viewport + ô nhập ngày theo ngôn ngữ (`dateRange.formatDateInput/parseDateInput`).

---

## 4. Trạng thái git

- Analytics nằm trong 2 commit `1b52e26` (GĐ0, V6) và `1704479` (GĐ1–3, Q9/Q10, D.8, bỏ mẫu màu, V7–V10) — **đã push**:
  `main` = `dev` = `origin/main` = `origin/dev` = `fd7fc14` (07/10 tối).
- Working tree (07/10 tối) = **D.9, chưa commit**:
  - BE: `PostAnalyticsRepository`, `PostRepository` (SQL loại nội dung), `FacebookMetricsProviderImpl` (video_*), chú thích ở
    `AnalyticsController`, `AnalyticsService`, `AnalyticsServiceImpl`, `PostAnalyticsMapper`, `AnalyticsContentTypeResponse`,
    `ContentTypeMetricProjection`; test `AnalyticsRealDataPgTest` (sửa fixture + 1 test mới), `FacebookMetricsProviderImplTest` (mới).
  - FE: `dateRange.ts`, `RangeBadge.tsx`, `AnalyticsFilterBar.tsx`, `AnalyticsTrendChart.tsx`, `pages/app/Analytics.tsx`,
    `PostDetailPanel.tsx`, `i18n.ts`.
  - Docs: `PLAN.md`, `analytics-real-data-plan.md` (D.9 + sửa tiêu đề D.3–D.8), file này.

## 5. Còn phải kiểm tay (chưa ai làm)

- **GĐ2 với Meta thật:** theo D.6 → "Cách kiểm với Meta thật" (đăng tay một bài trên Page → chip "Ngoài AIMA", lọc "Chỉ bài AIMA", "Người theo dõi mới" so Business Suite, hướng dẫn IG ở Cài đặt).
- **Q10:** Bảng điều khiển "Hiệu quả nội dung" 7/30 ngày khớp từng ngày với biểu đồ + KPI trang Phân tích (không lọc). Lưu ý từ GĐ2 cả hai đều gồm bài ngoài AIMA; Hồ sơ "Tổng lượt xem" vẫn chỉ bài AIMA.
- **Q9:** bài chỉ có mốc cũ hiện "—" + tooltip ở Top bài viết (SQL ở D.5).
- **Mẫu màu:** Cài đặt → Giao diện chỉ còn Đại dương; người từng chọn Tím/Hồng sương tự về Đại dương.
- ~~**Popover khoảng ngày**~~ — ✅ kiểm headless 07/10 tối (390/820/1280px, vi/en): không tràn, không cuộn ngang, mọi nhãn ngày đổi định dạng.
- ~~**V6–V10 trên DB thật**~~ — ✅ đã xác nhận 07/10 tối (JDBC chỉ đọc): V6 → V10 `success = t`.

---

## 6. Việc tiếp theo (đề xuất thứ tự — chờ người dùng chọn)

1. **Deploy production (Render):** code đã push lên `main`/`dev` (07/10) — kiểm Render đã deploy chưa (V6–V10 đã có trên DB Supabase trong `.env`).
   Env Render: `META_WEBHOOK_VERIFY_TOKEN` (giá trị riêng cho production), `META_FACEBOOK_APP_SECRET`,
   `META_FACEBOOK_REDIRECT_URI` = URL callback production, `FE_OAUTH_SUCCESS_URL` / `FE_OAUTH_ERROR_URL` (mặc định trong
   `application.yml` là `localhost:3000`). Meta App: Callback URL `https://api.aima-marketing.id.vn/api/aima/webhooks/meta` + verify token,
   subscribe `feed`, thêm `pages_manage_metadata` vào Login configuration, thêm redirect URI production vào Valid OAuth Redirect URIs.
   Sau đó kết nối lại Facebook trên production và chạy bước 6 của `META_WEBHOOK_SETUP.md`.
2. **Test App Meta cho localhost:** app chính ở Live chặn redirect `localhost`, và Meta chỉ cho một Callback URL / object → tạo Test App
   (con của app chính) ở Development cho `.env` local, để không phải đổi URL webhook production khi thử.
3. ~~Sửa 2 lỗi analytics còn mở~~ — widget loại nội dung + hướng dẫn nhãn xoá xong (D.9). Còn: chức năng xoá bài trên nền tảng
   từ AIMA + nhãn "Đã xoá bởi bạn" — đã chốt làm, yêu cầu ở `docs/PLAN.md` → Backlog.
4. **Instagram:** đăng bài (`IG_MEDIA_REQUIRED` — IG bắt buộc ảnh/video, AIMA không sinh media → cần người dùng tải media) rồi
   `InstagramMetricsProvider` (hiện stub `UNSUPPORTED`, TODO trong code).
5. **Threads:** provider đang giữ hành vi cũ; thiếu `shares`, nghi `th_exchange_token` sai.
6. **Business Verification + App Review** (Advanced Access) — để người không có vai trò trong app dùng được.

---

## 7. Chưa làm / nợ kỹ thuật

**Sau giai đoạn 3:** chuyển Graph v26 khi cần (admin `/admin/api-versions`, cách làm ở D.7); webhook không còn báo "bài bị nền tảng gỡ do vi phạm" (SEC-06) vì không phân biệt được với tự xoá — nếu cần lại tính năng đó phải dùng nguồn khác; nhân khẩu học người theo dõi không có cho Trang Facebook.

**Nợ kỹ thuật / ghi chú:**
- Instagram / Threads cấp tài khoản vẫn stub (`supportsAccountSync()=false`). Phát hiện IG chưa chuyên nghiệp chỉ gián tiếp qua Trang (không thấy IG cá nhân chưa gắn Trang nào).
- Chưa dùng **Batch API** (2 lời gọi/bài) và chưa đọc `X-Business-Use-Case-Usage`; chỉ xử lý khi Meta đã trả rate limit.
- Chưa lấy **reach** (`post_total_media_view_unique`, `page_total_media_view_unique`): cột `reach` luôn null.
- Insights Trang lưu theo ngày Meta (giờ Thái Bình Dương), khoảng lọc của trang theo ngày VN → có thể lệch 1 ngày ở mép kỳ.
- Bảng điều khiển nay gồm cả bài ngoài AIMA (dùng chung truy vấn với trang Phân tích) nhưng Hồ sơ/Top chủ đề chỉ bài AIMA — cố ý, ghi ở D.6.
- Threads: chưa lấy metric `shares`; `MetaApiClientImpl.refresh()` dùng `th_exchange_token` (nghi sai, chưa xác minh). Ngoài phạm vi.
- `ai/src/platform/facebook.py` cứng `v20.0`. Ngoài phạm vi.
- `frontend/scripts/dark-mode/*.mjs` còn tham chiếu theme `aurora`/`sunset` → hỏng nếu chạy lại.
- **App Review + Business Verification** chưa có: chỉ tài khoản có vai trò trong app thấy số thật.
- **Production:** khởi động backend mới sẽ tự áp **V6 → V10** (nếu chưa có) lên DB trong `.env`. Làm theo `SCHEDULING_PRODUCTION_RUNBOOK.md` (backup trước). Lượt job đầu sẽ đồng bộ lại mọi bài đã đăng và import bài 90 ngày gần nhất của mọi Trang.
- DB cô lập (`aima_isolated`) đang có dữ liệu nghiệm thu GĐ2: user `ana-gd2@aima.local` / `Admin123`, Page `uitest-gd2-page` (không ảnh hưởng gì ngoài stack cô lập).

**`SubscriptionLifecycleTest`, 2 test hỏng (để người dùng xử lý — vẫn chưa sửa 07/10; là 2 trong 15 lỗi cũ, 13 lỗi còn lại là
`AccountManagementTest` + `BrandProfileTest` gọi URL cũ → 401):**
- `activatePaidPlan_samePlanStillValid_accumulatesOntoExistingExpiry` và `activatePaidPlan_planWithoutEnumLabel_keepsPreviousLabel`.
- Nguyên nhân: test cố định `NOW = 2026-09-22`, nhưng `SubscriptionServiceImpl.getOrCreate` gọi `expireToFreePlan(…, LocalDateTime.now())` (đồng hồ thật) → hạn đã qua → gói bị hạ FREE.
- Sửa gợi ý: truyền `now`/`Clock` vào `getOrCreate`, hoặc dùng ngày tương đối trong test.

---

## 8. Chạy & kiểm chứng

- **JDK 21:** `JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot"` (Git Bash) trước `./mvnw`.
- **Postgres cô lập** cho test SQL native: `docker start aima-scheduling-isolated-postgres-1` (cổng 55432; tắt sau khi xong).
- Lệnh test:
  ```bash
  cd backend
  ./mvnw -o test "-Dtest=MetricDeltaDistributorTest,AnalyticsSyncServiceIntegrationTest,AnalyticsAccountSyncServiceIntegrationTest,AnalyticsCollectionJobTest,AnalyticsAggregateTest,MetaApiClientImplTest" "-Dsurefire.failIfNoSpecifiedTests=false"
  ./mvnw -o test "-Dtest=AnalyticsRealDataPgTest,PublishingMigrationTest" "-Disolated.postgres=true" "-Dsurefire.failIfNoSpecifiedTests=false"
  ./mvnw -o test "-Disolated.postgres=true"     # full suite
  cd ../frontend && npm run build && npm test
  ```
- **Baseline hiện tại (07/10 tối, sau D.9):**
  - Backend: **567 test, 15 lỗi cũ** (Redis cô lập :56379 bật) = 8 `AccountManagementTest` + 5 `BrandProfileTest` (gọi URL cũ → 401) + 2 `SubscriptionLifecycleTest` (bom hẹn giờ).
  - Frontend: build sạch, **30/30** test.
- **Nghiệm thu giao diện:** stack cô lập `backend/isolated/start-backend.ps1` (BE :8092, scheduling tắt) + FE `VITE_API_BASE_URL=http://localhost:8092/api/aima npx vite --port 3100` (script `start-frontend.ps1` hỏng khi chạy qua PowerShell của tool: "Unknown command: pm").
- ⚠️ **Đừng boot backend chỉ để thử:** `.env` trỏ Supabase thật, và `PostingDispatchJob` đăng bài thật mỗi 60s. Dùng test hoặc stack cô lập.
- **Truy vấn native** trang Phân tích chỉ chạy trên Postgres (H2 không bắt lỗi). Thêm/sửa SQL thì chạy lại `AnalyticsRealDataPgTest`.
