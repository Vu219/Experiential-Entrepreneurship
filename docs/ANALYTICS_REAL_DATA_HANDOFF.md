# Bàn giao: Analytics dữ liệu thật từ Meta

> Cập nhật: **2026-10-07 (chiều)** · Kế hoạch đầy đủ + quyết định: [`analytics-real-data-plan.md`](./analytics-real-data-plan.md)
> (mục **D** thắng mọi chỗ khác; D.1 = Giai đoạn 0, D.3/D.4 = Giai đoạn 1, D.5 = Q9/Q10, **D.6 = Giai đoạn 2**).
> Đọc file này trước khi làm tiếp — không cần khảo sát lại.

---

## 1. Tóm tắt tiến độ

| Hạng mục | Trạng thái | Commit |
|---|---|---|
| Khảo sát + kế hoạch (`analytics-real-data-plan.md`) | ✅ Xong, đã duyệt | `1b52e26` |
| **Giai đoạn 0**: FB `post_impressions` → `post_media_view`, đếm mọi cảm xúc, dừng gọi lại vô hạn, sửa mock 194.2% | ✅ Xong, đã duyệt | `1b52e26` |
| **Giai đoạn 1**: snapshot + số theo ngày, adapter `PlatformMetricsProvider`, đồng bộ lại bài cũ, `/analytics/*` đọc dữ liệu thật, thanh trạng thái đồng bộ | ✅ Xong, **đã kiểm với Meta thật** (khớp Business Suite, Page **AIMA Marketing**) | ❌ **Chưa commit** |
| **Q9**: không điền mốc cũ, giao diện hiện "—" + tooltip | ✅ Xong (kiểm bằng test) | ❌ **Chưa commit** |
| **Q10**: Bảng điều khiển / Hồ sơ / Top chủ đề dùng chung nguồn với trang Phân tích | ✅ Xong (kiểm bằng test PG) | ❌ **Chưa commit** |
| Bỏ mẫu màu Tím sương / Hồng sương, giữ Đại dương | ✅ Xong (ngoài analytics) | ❌ **Chưa commit** |
| **Giai đoạn 2** (D.6, đã kiểm một phần với Meta thật 07/10: bài tự đăng được nhập sau "Làm mới"; trang tự tải lại khi có số mới): (a) insights cấp Page + ô "Người theo dõi mới", (b) import bài ngoài AIMA + lọc "Chỉ bài AIMA", (c) dọn snapshot thô > 180 ngày, (d) báo Trang chưa liên kết IG Business; kèm khôi phục bảng mốc 24h/48h/7 ngày (FR-62) trong modal | ✅ Code xong + test (PG cô lập, ảnh nghiệm thu stack cô lập) — **chưa kiểm với Meta thật** | ❌ **Chưa commit** |
| **Giai đoạn 3** (D.7): webhook Page `feed` (chữ ký, chống trùng, xử lý nền, `subscribed_apps`), tần suất thích ứng, rà Graph v26 (chỉ tài liệu); bỏ nhân khẩu học | ✅ Xong + **webhook đã test thật** (app phải ở Live); xoá bài → "Đã xoá trên nền tảng", không FAILED / không thông báo | ❌ **Chưa commit** |

**Lỗi phát hiện khi kiểm thật (D.8):** bài AIMA bị "Ngoài AIMA" do kết nối lại tạo dòng kết nối mới — code đã sửa + **Flyway V10** gộp dữ liệu cũ (duyệt 07/10, tự chạy khi khởi động backend; backup trước). Lượt xem rải đều trước ngày đăng = ước tính chia đều — biểu đồ nay đánh dấu điểm rỗng viền đứt + tooltip + chú thích.

**Việc cần làm đầu phiên sau:**
1. Người dùng duyệt Giai đoạn 3 (webhook đã test thật 07/10; app phải ở **Live** mới nhận dữ liệu thật — `META_WEBHOOK_SETUP.md` mục 6).
2. Review rồi commit phần đang nằm trong working tree (gợi ý tách commit ở mục 4 — thêm Commit E cho giai đoạn 3).
3. Kế hoạch analytics dữ liệu thật (GĐ0–3) đã hết hạng mục; việc tiếp theo tuỳ người dùng (Instagram/Threads, Batch API, App Review…).

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
  - App đang ở **Development**, **chưa Business Verification**.

---

## 3. Đã làm — tóm tắt kỹ thuật

### Giai đoạn 0 (đã commit `1b52e26`)
- `MetaApiClientImpl`: FB lượt xem `post_media_view`; `reactions.summary(total_count)` thay `likes`; lỗi thu số liệu ném `MetricsFetchException` + `MetricsErrorType`.
- Flyway **V6** `platform_media` (mỗi bài trên nền tảng một dòng + trạng thái đồng bộ). Mock FE hết 194.2%.

### Giai đoạn 1 + Q9/Q10 (chưa commit) — chi tiết D.3 / D.5
- **V7** `post_metric_snapshots` (tích luỹ) + `post_metrics_daily` (phát sinh theo ngày VN).
- Adapter `PlatformMetricsProvider` (Facebook thật, Threads giữ hành vi cũ, Instagram stub).
- `AnalyticsSyncService(Impl)` + `AnalyticsCollectionJob` (5 phút): prepare → findDue → syncAccount; mốc 24/48/168h từ snapshot.
- API delta / bài đăng trong kỳ; `GET /analytics/sync-status`, `POST /analytics/sync`. FE thanh đồng bộ, "—" cho mốc cũ, Dashboard/Hồ sơ chung nguồn.

### Giai đoạn 2 (chưa commit) — chi tiết D.6
- **V8** (chỉ thêm): `account_sync_state`, `account_insights_daily`, cột `platform_media.media_type/permalink/caption_excerpt`.
- `AnalyticsAccountSyncService(Impl)` (job gọi trước bước đồng bộ bài, 1 giờ/kênh; "Làm mới" xếp lại ngay nếu kênh đã quét > 2 phút): `published_posts` → bài EXTERNAL; insights Trang + `followers_count`; kiểm IG Business. `prepare` nhận lại dòng EXTERNAL của bài AIMA vừa đăng.
- `MetaApiClient`: `getPagePublishedPosts`, `getPageInsights` (metric bị khai tử tự bỏ), `getPageFollowersCount`.
- Truy vấn "bài đăng trong kỳ" đi từ `platform_media`; tham số `source=aima` trên mọi `/analytics/*`; Top bài thêm `mediaId/origin/permalink/platformStatus`; insights thêm `newFollowers/newFollowersDeltaPct/followersTotal`; CSV thêm `origin,permalink`.
- `LogRetentionJob` dọn snapshot thô > 180 ngày (`METRIC_SNAPSHOT_RETENTION_DAYS`), giữ bản mới nhất.
- `GET /connections` trả `instagramLinkStatus`; OAuth callback ghi trạng thái liên kết IG.
- FE: mục "Nguồn bài → Chỉ bài đăng qua AIMA" + chip; chip "Ngoài AIMA"/"Đã xoá"; "Mở trên nền tảng"; ô "Người theo dõi mới" (dải 3 cột × 2 hàng); bảng mốc 24h/48h/7 ngày trong modal; hướng dẫn liên kết IG ở Cài đặt › Kết nối.

---

## 4. Đang nằm trong working tree (chưa commit) — gợi ý tách commit

`git diff --cached` rỗng (không stage gì).

**Commit A — Analytics giai đoạn 1 (Facebook dữ liệu thật)** · **Commit B — Q9 + Q10** · **Commit C — Bỏ mẫu màu Tím/Hồng sương**
— danh sách file như bản bàn giao trước (V7, `AnalyticsSyncService*`, `*MetricsProviderImpl`, `MetricDeltaDistributor`, `AnalyticsSyncBar`, `MetricValue`, `frontend/{index.html,rule.md}`, `data.ts`, `types.ts`, `useAppStore.ts`, `tokens.css`…). Lưu ý: GĐ2 sửa tiếp nhiều file của A/B (xem dưới) — tách hunk được (`git add -p`), không cần thì gộp A+B+D.

**Commit D — Analytics giai đoạn 2**
- Migration: `backend/src/main/resources/db/migration/V8__account_insights_external_posts.sql`
- Mới (backend): `entity/{AccountSyncState,AccountInsightsDaily}`, `enums/InstagramLinkStatus`, `repository/{AccountSyncStateRepository,AccountInsightsDailyRepository}`, `repository/projection/FollowerGrowthProjection`, `service/AnalyticsAccountSyncService`, `service/Impl/AnalyticsAccountSyncServiceImpl`
- Sửa (backend): `entity/PlatformMedia`, `service/{MetaApiClient,PlatformMetricsProvider,AnalyticsService}`, `service/Impl/{MetaApiClientImpl,FacebookMetricsProviderImpl,AnalyticsSyncServiceImpl,AnalyticsServiceImpl,DashboardServiceImpl,MetaOAuthServiceImpl,PlatformConnectionServiceImpl}`, `mapper/{PostAnalyticsMapper,PlatformConnectionMapper}`, `repository/{PostAnalyticsRepository,PlatformMediaRepository}`, `repository/projection/TopPostProjection`, `dto/response/{AnalyticsTopPostResponse,AnalyticsInsightsResponse,PlatformConnectionResponse}`, `controller/AnalyticsController`, `scheduler/{AnalyticsCollectionJob,LogRetentionJob}`, `resources/application.yml` (retention)
- Test: mới `service/Impl/AnalyticsAccountSyncServiceIntegrationTest`; sửa `AnalyticsAggregateTest`, `AnalyticsRealDataPgTest`, `AnalyticsCollectionJobTest`, `MetaApiClientImplTest`, `MetaOAuthServiceImplTest`, `PlatformConnectionServiceImplTest`, `PublishingMigrationTest`
- FE: mới `components/analytics/PostOriginBadges.tsx`; sửa `api/{analytics,analyticsMock,connections}.ts`, `pages/app/Analytics.tsx`, `pages/Settings.tsx`, `components/analytics/{AnalyticsFilterBar,InsightsStrip,AnalyticsSkeleton,PostsTable,PostsCardList,PostDetailPanel,PostDetailModal}.tsx`, `i18n.ts`

**Commit E — Analytics giai đoạn 3**
- Migration: `V9__meta_webhook_events.sql`
- Mới: `entity/MetaWebhookEvent`, `enums/WebhookEventStatus`, `repository/MetaWebhookEventRepository`, `service/MetaWebhookEventWorker`, `service/Impl/MetaWebhookEventWorkerImpl`, `scheduler/MetaWebhookEventJob`, test `webhook/MetaWebhookFeedIntegrationTest`, tài liệu `docs/META_WEBHOOK_SETUP.md`
- Sửa: `service/Impl/MetaWebhookServiceImpl` (+ interface), `entity/AccountSyncState`, `service/{AnalyticsSyncService,AnalyticsAccountSyncService,MetaApiClient}` + Impl, `MetaOAuthServiceImpl`, `mapper/PostAnalyticsMapper`, `repository/{PlatformMediaRepository,PostMetricSnapshotRepository}`, `config/AsyncConfig`, `scheduler/LogRetentionJob`, `application.yml`; test `AnalyticsSyncServiceIntegrationTest`, `AnalyticsAccountSyncServiceIntegrationTest`, `MetaApiClientImplTest`, `MetaOAuthServiceImplTest`, `MetaIntegrationTest`, `PublishingMigrationTest`

**Tài liệu (đi kèm):** `docs/analytics-real-data-plan.md` (D.6, D.7), `docs/META_WEBHOOK_SETUP.md`, `docs/PLAN.md` (dòng GĐ2 → [x]), `backend/CLAUDE.md` (mục Performance Analysis), file này.

---

## 5. Còn phải kiểm tay (chưa ai làm)

- **GĐ2 với Meta thật:** theo D.6 → "Cách kiểm với Meta thật" (đăng tay một bài trên Page → chip "Ngoài AIMA", lọc "Chỉ bài AIMA", "Người theo dõi mới" so Business Suite, hướng dẫn IG ở Cài đặt).
- **Q10:** Bảng điều khiển "Hiệu quả nội dung" 7/30 ngày khớp từng ngày với biểu đồ + KPI trang Phân tích (không lọc). Lưu ý từ GĐ2 cả hai đều gồm bài ngoài AIMA; Hồ sơ "Tổng lượt xem" vẫn chỉ bài AIMA.
- **Q9:** bài chỉ có mốc cũ hiện "—" + tooltip ở Top bài viết (SQL ở D.5).
- **Mẫu màu:** Cài đặt → Giao diện chỉ còn Đại dương; người từng chọn Tím/Hồng sương tự về Đại dương.

---

## 6. Câu hỏi còn mở

Các câu hỏi phiên trước đã được trả lời 07/10 (làm đủ GĐ2 a–d, khôi phục FR-62 trong modal, giữ mục "Mẫu màu", dừng sau GĐ2).
Còn lại cho Giai đoạn 3 (hỏi khi duyệt GĐ2): làm phần nào trước — webhook `feed` (đồng bộ sớm + đánh dấu xoá ngay), tần suất thích ứng, nhân khẩu học người theo dõi, nâng Graph v26?

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
- **Production:** khởi động backend mới sẽ tự áp V6 + V7 + V8 lên DB trong `.env`. Làm theo `SCHEDULING_PRODUCTION_RUNBOOK.md` (backup trước). Lượt job đầu sẽ đồng bộ lại mọi bài đã đăng và import bài 90 ngày gần nhất của mọi Trang.
- DB cô lập (`aima_isolated`) đang có dữ liệu nghiệm thu GĐ2: user `ana-gd2@aima.local` / `Admin123`, Page `uitest-gd2-page` (không ảnh hưởng gì ngoài stack cô lập).

**`SubscriptionLifecycleTest`, 2 test hỏng (để người dùng xử lý):**
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
- **Baseline hiện tại (07/10 chiều):**
  - Backend: **561 test, 15 lỗi cũ** (07/10 tối, Redis cô lập :56379 bật — tắt thì 9 test `RegistrationOtpFlowTest` bị skip) = 8 `AccountManagementTest` + 5 `BrandProfileTest` (gọi URL cũ → 401) + 2 `SubscriptionLifecycleTest` (bom hẹn giờ).
  - Frontend: build sạch, **22/22** test.
- **Nghiệm thu giao diện:** stack cô lập `backend/isolated/start-backend.ps1` (BE :8092, scheduling tắt) + FE `VITE_API_BASE_URL=http://localhost:8092/api/aima npx vite --port 3100` (script `start-frontend.ps1` hỏng khi chạy qua PowerShell của tool: "Unknown command: pm").
- ⚠️ **Đừng boot backend chỉ để thử:** `.env` trỏ Supabase thật, và `PostingDispatchJob` đăng bài thật mỗi 60s. Dùng test hoặc stack cô lập.
- **Truy vấn native** trang Phân tích chỉ chạy trên Postgres (H2 không bắt lỗi). Thêm/sửa SQL thì chạy lại `AnalyticsRealDataPgTest`.
