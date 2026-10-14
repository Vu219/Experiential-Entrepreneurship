# Realtime SSE & thông báo — Tiến độ triển khai

> Theo dõi việc triển khai [`REALTIME_SSE_NOTIFICATIONS_PROPOSAL.md`](REALTIME_SSE_NOTIFICATIONS_PROPOSAL.md) (mục 8).
> Cập nhật sau MỖI bước để phiên sau làm tiếp được. KHÔNG commit/push (user tự commit tách từng bước).
>
> **Trạng thái:** Bước 0–6 XONG (2026-10-14), chưa commit. Còn việc của người vận hành — xem cuối file và [REALTIME_SSE_DEPLOY.md](REALTIME_SSE_DEPLOY.md).

## Đối chiếu ban đầu (2026-10-14)

- HEAD vẫn là `1da09d4` (nhánh `research_trends`), không có commit/diff nào sau khi viết đề xuất → mọi file:dòng,
  endpoint, bảng trong đề xuất còn đúng (đã kiểm: `CookieUtils` maxAge = `jwt.accessTokenExpiration`; `apiClient.ts` 401 chỉ
  toast; 13 điểm `notify/notifyOnce`; `notifications` CHECK 9 loại ở V4; `user_notification_preferences` ở V14;
  `ai_usage.status` CHECK `SUCCESS|ERROR|TIMEOUT` ở V1).
- Migration mới nhất **V16** → migration của đợt này là **V17** (đúng dự kiến).
- Baseline test đo lại trước khi sửa:
  - BE `mvnw test -Disolated.postgres=true`: **694 test, 15 fail, 2 skip** — đúng 15 lỗi có sẵn (8 `AccountManagementTest`,
    5 `BrandProfileTest` gọi URL cũ; 2 `SubscriptionLifecycleTest` bom hẹn giờ).
  - FE `npm test`: **54/54**. AI `uv run pytest -q tests`: **65/65**.

## Phát hiện mới so với đề xuất

1. **Filter JWT xoá luôn cookie refresh khi access token hết hạn** (`JwtAuthenticationFilter` catch-all: xoá cả hai cookie
   + trả 500). Cookie access và JWT hết hạn gần như cùng lúc, nên request rơi đúng ranh giới (đặc biệt client SSE nối lại
   ngay khi server đóng luồng lúc token hết hạn) làm mất phiên dù refresh token còn hạn → đã sửa trong Bước 0.
2. Refresh token **xoay vòng** → hai tab cùng refresh một lúc thì tab sau bị 401. FE dùng khoá Web Locks giữa các tab
   (+ single-flight trong tab).
3. Guard `IsolatedStackConfig` bắt buộc cổng 8092 → để chạy BE thứ hai (8093) cho test nhiều instance phải nới guard
   (làm ở Bước 1, chỉ cho phép thêm đúng 8093).
4. Chrome extension không kết nối → nghiệm thu trình duyệt bằng Chrome headless qua `playwright-core` đặt trong
   scratchpad của phiên (công cụ test, KHÔNG thêm vào dependency dự án).

## Bước 0 — Refresh token khi gặp 401 ✅ (2026-10-14)

**File thêm/sửa**
- BE: `exception/TokenExpiredException.java` (mới), `service/Impl/JwtServiceImpl.java` (ném exception riêng khi hết hạn),
  `security/JwtAuthenticationFilter.java` (hết hạn → chỉ xoá cookie access, đi tiếp như chưa đăng nhập → 401),
  test `auth/JwtAuthenticationFilterExpiryTest.java` (mới).
- FE: `src/api/sessionRefresh.ts` (mới — single-flight + Web Locks, hàm thuần), `src/api/apiClient.ts` (interceptor: 401 →
  `refreshSession()` → thử lại 1 lần; hỏng → `endSession()`; export `refreshSession` cho client SSE),
  `src/auth/AuthContext.tsx` (đăng ký handler hết phiên → `setUser(null)`), test `tests/sessionRefresh.test.ts` (mới).

**Kiểm tra**
- curl trên BE cô lập (TTL access 60s): token hết hạn → 401 (trước: 500), chỉ `Set-Cookie access_token=; Max-Age=0`;
  `/auth/refresh` sau đó 200.
- Chrome headless, TTL 60s, dùng liên tục 3 phút 20 giây (tải lại trang + mở chuông): mỗi lần hết hạn 2 request 401
  đồng thời → **1** lần `/auth/refresh` 200 → thử lại thành công; không bị văng, không toast hết phiên.
- Xoá cookie (giả refresh hết hạn) → về `/login` + đúng 1 toast "Phiên đăng nhập đã hết hạn".
- FE `npm run build` OK; `npm test` 61/61. BE `mvnw test -Disolated.postgres=true`: **696 test, 15 fail** (đúng 15 baseline).

## Bước 1 — Hạ tầng SSE ✅ (2026-10-14)

**File thêm/sửa — BE**
- Mới: `controller/RealtimeController.java` (`GET /realtime/stream`, trả `SseEmitter` — ngoại lệ ApiResponse),
  `service/RealtimeService.java` + `Impl/RealtimeServiceImpl.java` (đăng ký → phát bù theo Last-Event-ID ≤ 50 → `ready`),
  `service/RealtimeConnectionRegistry.java` + `Impl/RealtimeConnectionRegistryImpl.java` (bộ nhớ instance; hàng gửi tuần tự/kết nối;
  heartbeat `:hb` 20s bằng ScheduledExecutor riêng; đóng tại min(30 phút, token hết hạn) bằng `reconnect`; 6 kết nối/user → `replaced`;
  2000/instance → 503 + Retry-After; client chậm (> 500 sự kiện chờ) → đóng),
  `service/RealtimeEventPublisher.java` + `Impl/RealtimeEventPublisherImpl.java` (phát SAU commit; `bus=redis` qua kênh `aima:rt:v1`,
  `bus=local` cho test), `service/RealtimeControlHandler.java`, `service/Impl/RealtimeMessageListener.java`,
  `config/RealtimeConfig.java` + `config/RealtimeProperties.java` (`aima.realtime.*`), `enums/RealtimeEventType.java`,
  `dto/realtime/{RealtimeMessage,RealtimeReadyEvent,NotificationCreatedEvent}.java`, `mapper/RealtimeMapper.java`,
  `util/RealtimePayloads.java`.
- Sửa: `security/SecurityConfig.java` (permit dispatcher ASYNC/ERROR), `security/JwtAuthenticationFilter.java` (attribute hạn token),
  `exception/ErrorCode.java` (2201 `REALTIME_CAPACITY_EXCEEDED`), `repository/NotificationRepository.java` (query phát bù),
  `service/Impl/AuthenticationServiceImpl.java` (logout → `session.revoked`), `service/Impl/UserServiceImpl.java` (đặt lại mật khẩu,
  admin khoá tài khoản → `session.revoked`), `config/IsolatedStackConfig.java` (cho thêm cổng 8093),
  `src/test/resources/application.yml` (`aima.realtime.bus: local`).
- Test mới: `realtime/RealtimeConnectionRegistryTest` (9), `realtime/RealtimeStreamIntegrationTest` (6),
  `src/test/java/org/springframework/web/servlet/mvc/method/annotation/EmitterCapture.java` (helper đọc SseEmitter trong test).

**File thêm/sửa — FE**
- Mới: `src/realtime/sseParser.ts` (parser thuần + backoff), `src/realtime/realtimeClient.ts` (fetch + ReadableStream; 401 → refresh;
  403/`replaced` → dừng; `reconnect`(token) → refresh rồi nối; `session.revoked` → chờ >1s rồi refresh; watchdog 45s; tab ẩn > 5 phút
  → đóng, hiện lại → nối ngay; offline/online), `src/realtime/events.ts` (kiểu sự kiện + bus + `useRealtimeEvent`),
  `src/store/useRealtimeStore.ts`, `src/components/RealtimeConnector.tsx`; test `tests/sseParser.test.ts`, `tests/realtimeClient.test.ts`.
- Sửa: `src/components/AppShell.tsx` (gắn `<RealtimeConnector/>`).

**Kiểm tra**
- `curl -N` cookie trên 8092: header `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`;
  `retry:3000` → `ready{unreadCount}` → `:hb` mỗi 20s. TTL access 120s: server gửi `reconnect{"reason":"token"}` rồi đóng ở
  lượt heartbeat kế tiếp (127s).
- **2 BE 8092 + 8093** chung PG/Redis cô lập: `PUBSUB NUMSUB` = 2; message PUBLISH vào `aima:rt:v1` tới luồng mở ở 8093;
  logout gọi ở 8092 → luồng ở 8093 nhận `session.revoked` và đóng.
- Chrome headless 2 tab (3100→8092, 3101→8093): logout từ phiên khác → cả hai tab nhận revoked → refresh → nối lại 200, vẫn ở /dashboard.
  Tắt BE 8093 ~65s: client backoff 2→5→9→19→32s, BE lên lại → tự nối lại.
- FE build OK, `npm test` **78/78**. BE **711 test, 15 fail** (đúng baseline).

**Quyết định phát sinh**
- `logout_time` lưu ms còn `iat` JWT tính theo giây → token làm mới trong cùng giây với lệnh đăng xuất bị coi là đã thu hồi (filter xoá
  luôn cookie refresh). Client SSE chờ 1,2–2s sau `session.revoked` rồi mới refresh. (Lỗi gốc ở BE có từ trước — không đổi để khỏi
  nới lỏng kiểm tra thu hồi.)
- Đóng luồng theo hạn token được kiểm ở mỗi nhịp heartbeat → trễ tối đa 20s sau khi token hết hạn (chấp nhận được; mọi request
  khác vẫn bị filter chặn đúng giờ).

## Bước 2 — BE thông báo ✅ (2026-10-14)

**File thêm/sửa — BE**
- Mới: `db/migration/V17__realtime_notifications.sql` (+ rollback `docs/sql/rollback/V17__realtime_notifications_down.sql`):
  `notifications.params jsonb` + `ref_type` (CHECK), CHECK type thêm 12 loại, index `ix_ntf_user_created`/`ix_ntf_user_unread`,
  `user_notification_preferences.channels jsonb default '{}'`, `ai_usage.status` thêm `CANCELLED`.
- Mới: `enums/{NotificationCategory,NotificationRefType}.java`, `dto/notification/NotificationDraft.java`,
  `dto/realtime/{NotificationReadEvent,NotificationDeletedEvent}.java`, `dto/request/NotificationChannelRequest.java`,
  `dto/response/NotificationChannelResponse.java`, `util/{NotificationChannelPolicy,NotificationParams}.java`,
  `repository/NotificationSpecifications.java`, `service/JobEventService.java` + `Impl/JobEventServiceImpl.java`,
  `scheduler/{NotificationRetentionJob,PlanExpiryReminderJob,ScheduleUpcomingReminderJob}.java`.
- Sửa: `enums/NotificationType.java` (21 loại, mỗi loại có nhóm + `alwaysInApp`), `entity/Notification.java`, `entity/UserNotificationPreference.java`,
  `dto/response/{NotificationResponse,NotificationPreferenceResponse}.java`, `dto/request/NotificationPreferenceRequest.java` (PATCH ngữ nghĩa),
  `mapper/{NotificationMapper,NotificationPreferenceMapper,RealtimeMapper}.java`, `repository/{NotificationRepository,PostScheduleRepository,
  SubscriptionRepository,ContentGenerationJobRepository,TrendResearchSessionRepository}.java`, `util/JsonColumns.java`,
  `service/NotificationService.java` + `Impl/NotificationServiceImpl.java` (`send`/`sendToAdmins`: tắt kênh → không bản ghi, dedupe, đếm trong TX,
  SSE sau commit; list status/category; delete; deleteRead; phát `notification.read/deleted`), `controller/NotificationController.java`,
  `service/Impl/NotificationPreferenceServiceImpl.java`, `exception/ErrorCode.java` (2202–2204).
- Điểm phát (params + ref_type): `PostPublishWorkerServiceImpl`, `ContentGenerationWorkerServiceImpl`, `StrategyOptimizationWorkerServiceImpl`,
  `PaymentServiceImpl` (webhook alert → `sendToAdmins`), `SubscriptionServiceImpl`, `PostingDispatchServiceImpl`, `MetaOAuthServiceImpl` (variant HELD_*),
  `PublishFailureNotifierImpl` (TOKEN_EXPIRING tách khỏi RECONNECT_NEEDED), `scheduler/{HeldScheduleOverdueJob,TokenHealthCheckJob,
  ContentGenerationStuckJob,TrendResearchStuckJob}`, `TrendResearchWorkerServiceImpl`, `AnalyticsSyncServiceImpl` (POST_REMOVED_BY_PLATFORM),
  `TokenUsageServiceImpl` + `AiUsageServiceImpl` (AI_QUOTA_WARNING/EXHAUSTED + `usage.updated`), `UsageAlertServiceImpl`, `AiModelHealthServiceImpl`,
  `PlatformVersionServiceImpl` (3 loại ADMIN_*).
- Test mới: `notification/NotificationChannelPolicyTest` (6), `notification/NotificationRealtimeIntegrationTest` (9), `scheduler/PlanExpiryReminderJobTest`,
  `PublishingMigrationTest.v17…` (+ nâng số đếm migration). Test cập nhật theo hành vi đã chốt (verify `send` thay `notify`): `MetaOAuthServiceImplTest`,
  `PaymentWebhookTest`, `SubscriptionLifecycleTest`, `TokenHealthCheckJobTest`, `PublishFailureNotifierEmailTest`, `ContentGenerationWorkerErrorCodeTest`,
  `AiModelHealthTest`, `AiTestConnectionStatusTest`, `MetaWebhookFeedIntegrationTest` (bài bị gỡ: trước 07/10 "không báo" → nay báo đúng 1 lần — D7).

**Kiểm tra**: BE `mvnw test -Disolated.postgres=true` **728 test, 15 fail** (đúng baseline). V17 áp lên DB cô lập khi boot (validate OK).

**Quyết định phát sinh**
- Bài bị gỡ: Meta không cho biết tự xoá hay bị gỡ → câu thông báo trung tính ("không còn trên nền tảng"); đích = `/calendar/{scheduleId}`
  (đề xuất ghi `/failed-posts` nhưng bài đã đăng không nằm trong danh sách Bài lỗi).
- Retention đo theo `created_at` (đã đọc > 90 ngày tính từ ngày tạo).
- TREND_RESEARCH_FAILED chỉ báo phiên thủ công; phiên tự động 2:00 AM chỉ báo khi xong (DONE).
- Câu thông báo nhiều biến thể dùng `params.variant` → khoá `ntf_<TYPE>_body_<variant>`; lỗi đăng bài dựng câu từ catalog FE theo `params.code`.

## Bước 3 — FE thông báo ✅ (2026-10-14)

**File thêm/sửa — FE**
- Mới: `src/notifications/{text,links,toastGate}.ts` (thuần), `src/hooks/{useNotificationFeed,useUnreadCountSync}.ts`,
  `src/components/NotificationToaster.tsx`, `src/components/settings/NotificationChannelsCard.tsx`, `src/pages/app/Notifications.tsx`,
  test `tests/notificationText.test.ts` (10).
- Sửa: `src/api/notifications.ts` (loại/nhóm mới, filter status/category, xoá), `src/api/notificationPreferences.ts` (channels),
  `src/components/NotificationBell.tsx` (badge realtime, chấm xám sau 10s, poll dự phòng sau 30s, chèn realtime, "Xem tất cả"),
  `src/components/notificationMeta.ts` (icon loại mới + `openNotificationTarget`; bỏ `ROUTE_BY_TYPE`), `src/components/dashboard/ActivityList.tsx`,
  `src/components/toast/ToastProvider.tsx` (nút hành động), `src/components/AppShell.tsx`, `src/pages/Settings.tsx` (ma trận thay 4 công tắc giả),
  `src/pages/app/FailedPosts.tsx` (deep link `?post=`), `src/realtime/events.ts`, `src/i18n.ts` (vi+en), `src/index.css` (rung chuông, có nhánh
  reduced-motion), `src/types.ts`, `src/context/AppContext.tsx`, `src/App.tsx`, `src/search/registry.ts`, `src/store/useAppStore.ts`, `src/data.ts`.
- Xoá (mồ côi do thay đổi này): `src/components/settings/PublishErrorEmailCard.tsx` (email nằm trong ma trận), `useAppStore.notif/toggleNotif`, `notifLabels`.

**Kiểm tra (Chrome headless, 2 BE 8092 + 8093)**
- "Research ngay" (AI stub 503) gọi qua 8092 → TREND_RESEARCH_FAILED: tab 3100 (8092) và tab 3101 (8093) cùng tăng badge 8→9 + toast có nút "Xem";
  dropdown chèn dòng mới đầu danh sách; bấm → `/trends`, cả hai tab về 8 (đồng bộ đã đọc giữa 2 instance).
- Tắt Toast nhóm "Nội dung AI & xu hướng" trong ma trận → sự kiện mới: badge tăng, KHÔNG toast. Trang `/notifications`: lọc chưa đọc (9), xoá đã đọc
  (toast "Đã xoá 2 thông báo đã đọc"). Ma trận desktop + mobile 390px.
- Chặn `/realtime/stream`: sau ~12s có chấm xám; sau 30s bắt đầu poll unread-count; bỏ chặn → nối lại, chấm biến mất. Đổi English → câu tiếng Anh.
- Redis cô lập bị khởi động lại giữa chừng → Lettuce tự nối lại, kênh vẫn được subscribe (NUMSUB = 1 rồi 2).
- FE build OK, `npm test` **88/88**.

## Bước 4 — Tiến độ job / bài đăng ✅ (2026-10-14)

**File thêm/sửa — BE**
- Mới: `enums/RealtimeJobKind.java`, `dto/realtime/{JobUpdatedEvent,PostUpdatedEvent}.java`, test `realtime/JobEventServicePostUpdatedTest` (3).
- Sửa: `service/JobEventService.java` + `Impl/JobEventServiceImpl.java` (`generationUpdated`, `jobUpdated`, `formattingProgress`, `postUpdated`;
  `generationFailed` phát cả `job.updated`, không thông báo khi `CANCELLED_BY_USER`), `mapper/RealtimeMapper.java`,
  `ContentGenerationWorkerServiceImpl` (RUNNING·PREPARING → RUNNING·GENERATING → SUCCESS{resultId}/FAILED{errorCode}),
  `ContentFormattingWorkerServiceImpl` (RUNNING + `progress{done,total,platform}` sau mỗi nền tảng → SUCCESS/FAILED),
  `ContentRegenerationWorkerServiceImpl`, `AiAssistWorkerServiceImpl`, `StrategyOptimizationWorkerServiceImpl`, `TrendResearchWorkerServiceImpl`
  (đổi trạng thái), `PostingDispatchServiceImpl` (claim → POSTING), `PostPublishWorkerServiceImpl` (POSTING / RETRYING{attempt,nextRetryAt} /
  FAILED{errorCode} / POSTED), `ScheduleHoldServiceImpl` (mọi lần thêm/gỡ lý do giữ → ON_HOLD{holdReason} / SCHEDULED).

**File thêm/sửa — FE**
- Mới: `src/realtime/waitForJob.ts` (+ test `tests/waitForJob.test.ts`, 4), `src/hooks/useRealtimeRefresh.ts`.
- Sửa: `src/api/contentCreationService.ts` (generate / format / regen chờ qua `waitForJob`; `onProgress` tuỳ chọn), `src/pages/app/Trends.tsx`,
  `src/pages/app/Calendar.tsx`, `src/pages/app/FailedPosts.tsx` (nạp lại lặng lẽ), `src/pages/app/Dashboard.tsx`, `src/components/Sidebar.tsx`
  (badge lịch + thanh token theo `post.updated`/`usage.updated`).

**Kiểm tra**
- Lịch mở ở tab 3101 (BE 8093), gọi "Đăng ngay" qua 8092 (stub Meta 503): luồng ở 8093 nhận `post.updated` POSTING → RETRYING{attempt:1,
  nextRetryAt}; trang Lịch tự GET `/schedules` một lần (debounce) + sidebar đếm lại — không tải lại trang.
- Tạo nội dung qua 8092 (AI stub 503): luồng 8093 nhận `job.updated` RUNNING·PREPARING → RUNNING·GENERATING → FAILED{AI_SERVICE_ERROR} +
  `notification.created` CONTENT_GENERATION_FAILED. Phát hiện + sửa: MapStruct lấy nhầm `progress.platform` cho `platform` (thêm `@Mapping` + test).
- Ngắt SSE → `waitForJob` quay về nhịp poll cũ: kiểm bằng unit test (`realtime closed: falls back…`) + chuỗi fallback của chuông ở Bước 3.
- BE full suite: **730 test, 15 fail** (baseline); sau khi sửa mapper chạy lại nhóm realtime/notification (18/18 xanh).
  FE build OK, `npm test` **92/92**.

**Quyết định phát sinh**
- Không phát `QUEUED` (tab gửi request đã có job PENDING trong response); không đổi luồng poll của AiFixModal / PolicyCheckNotice /
  StrategyOptimization (BE đã phát `job.updated`, FE có thể chuyển sang `waitForJob` sau — chưa cần cho mục tiêu đợt này).
- `post.updated` POSTING có thể đến 2 lần (dispatch + worker claim) — FE gộp bằng debounce.

## Bước 5 — AI streaming + nút Dừng ✅ (2026-10-14)

**File thêm/sửa — AI (Python)**
- Sửa: `src/llm.py` (`astream_structured`, `_stream_chunks`, `string_leaves`, `diff_deltas`, `_merge_usage`; `_GeminiChat._stream/_astream`
  giữ tắt AFC), `src/agents/content_generator.py` (`generate_content_stream`), `src/api/routes.py` (`POST /generate/stream` NDJSON).
- Mới: `tests/test_generate_stream.py` (6: delta dựng lại đủ field + validate kết quả, fallback âm thầm trước delta, `reset` sau delta, cả chuỗi
  hỏng → LlmChainError, ngắt kết nối đóng luồng provider, route NDJSON done/error).

**File thêm/sửa — BE**
- Mới: `exception/AiStreamCancelledException.java`, `dto/ai/GenerateStreamEventPayload.java`, `dto/realtime/{AiDeltaEvent,AiResetEvent}.java`,
  `service/{AiStreamListener,GenerationCancelService}.java` + `Impl/GenerationCancelServiceImpl.java` (control `job.cancel`).
- Sửa: `enums/AiUsageStatus.java` (+CANCELLED), `service/AiServiceClient.java` + `Impl/AiServiceClientImpl.java` (`generateContentStream`:
  NDJSON, `takeUntilOther(cancel)`, usage một phần = input thật + output ~3 ký tự/token), `Impl/AiUsageServiceImpl.java` (CANCELLED tính tiền như
  SUCCESS), `Impl/ContentGenerationWorkerServiceImpl.java` (cờ `aima.ai.generation-streaming-enabled`, `DeltaRelay` gộp 100ms, không ghi đè job đã huỷ),
  `service/ContentGenerationService.java` + `Impl/ContentGenerationServiceImpl.java` + `controller/ContentGenerationController.java`
  (`POST /content-items/jobs/{id}/cancel`), `repository/ContentGenerationJobRepository.java` (`cancel` có điều kiện), `mapper/RealtimeMapper.java`,
  `src/main/resources/application.yml` (khoá `aima.realtime.*`, `aima.ai.generation-streaming-enabled`, retention thông báo, cron nhắc gói).
- Test mới: `content/AiServiceClientStreamTest` (3, MockWebServer NDJSON: delta/reset/done, error → mã chuỗi, huỷ giữa luồng → usage một phần),
  `content/GenerationStreamingIntegrationTest` (4: delta tới trình duyệt + lưu như cũ; Dừng → FAILED/CANCELLED_BY_USER + ai_usage CANCELLED 154
  token + không lưu bản; kết quả về muộn bị bỏ; huỷ job người khác → 4xx). Cập nhật constructor: `ContentGenerationDedupeTest`,
  `ContentGenerationWorkerErrorCodeTest`.

**File thêm/sửa — FE**
- Mới: `src/realtime/aiPreview.ts` (+ `tests/aiPreview.test.ts`, 3), `src/hooks/useAiPreview.ts`, `src/components/create/AiStreamPreview.tsx`.
- Sửa: `src/api/contentGeneration.ts` (`cancelContentGeneration`), `src/api/contentCreationService.ts` (`onStarted`), `src/pages/app/CreateWizard.tsx`
  (Dừng từng nền tảng, câu "Bạn đã dừng…"), `src/components/create/steps/GenerateStep.tsx`, `src/realtime/events.ts`, `src/i18n.ts`,
  `src/api/adminUsage.ts` + `src/components/admin/usage/UsageEventsTable.tsx` (trạng thái CANCELLED).

**Kiểm tra (stack cô lập, stub AI NDJSON ở 58080, BE 8092 bật cờ)**
- Wizard thật: "Tạo nội dung với AI" → khung xem trước hiện lần lượt Mở đầu → Các bước → CTA → Caption → Hashtag; xong thì thay bằng bản đã lưu.
- Bấm "Dừng" giữa luồng (stub chậm 300ms/mẩu): stub log `client closed early (cancel)` (luồng AI bị đóng thật), `ai_usage` CANCELLED 615 token
  (600 input + 15 ước lượng), job FAILED/CANCELLED_BY_USER, UI "Bạn đã dừng tạo nội dung cho nền tảng này" + "Thử lại"; nền tảng kia chạy tiếp.
- AI `uv run pytest -q tests` **71/71**; FE build OK, `npm test` **95/95**; BE full suite **738 test, 15 fail** (đúng baseline).

**Quyết định phát sinh**
- Ước lượng output khi huỷ = ceil(số ký tự delta đã nhận / 3).
- Lệnh huỷ tới trước khi worker kịp đăng ký luồng → worker kiểm tra job đã huỷ và không gọi AI; huỷ khi cờ streaming TẮT → kết quả về muộn bị bỏ
  (token vẫn tính SUCCESS vì AI đã chạy xong).
- Ranh giới "lỗi khi chưa có delta → fallback âm thầm" dùng chung bộ phân loại `errors.classify_error` với đường không stream.

## Bước 6 — Tài liệu ✅ (2026-10-14)
- `docs/PLAN.md` (mục "Realtime (SSE) & hệ thống thông báo"), `docs/DATA_MODEL.md` (Notification, UserNotificationPreference, quy tắc xoá),
  `backend/CLAUDE.md` (rule #3 ngoại lệ (d) SSE, mục §4 "Realtime (SSE)", viết lại "Notifications", AI streaming + Dừng, filter hết hạn token,
  biến env), `frontend/CLAUDE.md` (ngoại lệ `fetch` cho SSE, `realtime/`, `notifications/`, refresh phiên, quy ước realtime),
  `ai/CLAUDE.md` (`/generate/stream`, `astream_structured`), `docs/REALTIME_SSE_DEPLOY.md` (thứ tự deploy, env, migration, bật cờ, kiểm SSE
  Render, lưu ý Cloudflare — D1).

## Việc còn dở (người vận hành / sau đợt này)
- Áp Flyway V17 lên Supabase; bật `AIMA_AI_GENERATION_STREAMING_ENABLED` sau khi AI service deploy; thử SSE trên Render thật (`curl -N` > 3 phút).
- Chưa thử AI streaming với provider THẬT (Anthropic tool-call / Gemini JSON stream) — chỉ LLM giả + stub NDJSON. Thử ở staging trước khi bật cờ.
- Chưa chuyển AiFixModal / PolicyCheckNotice / StrategyOptimization sang `waitForJob` (BE đã phát `job.updated`).
- Leader election giữa các tab (Web Locks + BroadcastChannel) chưa làm (đề xuất mục 1.5).
