# Nối wizard tạo nội dung với lịch đăng — kế hoạch triển khai

Ngày rà soát: 2026-09-29. Người dùng đã duyệt triển khai. Cập nhật 2026-09-30: **Phase 0 đã triển khai và kiểm chứng trên stack cô lập; dừng báo cáo trước Phase 1**. Chi tiết và các failure của suite cũ: [runbook Phase 0](SCHEDULING_PHASE0_RUNBOOK.md). Các nhận định rà soát bên dưới mô tả thời điểm trước triển khai.

## 1. Phạm vi xác minh

Đã đọc mã nguồn hiện tại, chưa khởi động ứng dụng, chạy test, kết nối DB hay gọi Meta. Không đọc giá trị bí mật trong `.env`. Không thể xác nhận schema/dữ liệu Supabase thực tế chỉ từ repository. Các kết luận về dữ liệu cũ phải được kiểm tra trên bản sao cô lập trước migration.

`frontend/AGENTS.md` và `backend/AGENTS.md` không có trong checkout; dùng hướng dẫn gốc, `frontend/CLAUDE.md`, `frontend/rule.md`, `frontend/README.md`, `backend/CLAUDE.md` làm nguồn bổ sung. Yêu cầu mới của người dùng ưu tiên hơn mô hình trạng thái cũ trong tài liệu.

| Nhận định ban đầu | Kết quả đối chiếu mã nguồn |
|---|---|
| Chưa có `/create/:id`, draft đi qua location.state | Đúng: `App.tsx`, `CreateWizard.tsx`. Lỗi resume còn bị catch rỗng, cần màn lỗi rõ ràng. |
| Bước 4 là placeholder, không mang ID sang Calendar | Đúng: `ScheduleStep.tsx` chỉ gọi `go('calendar')`. |
| Bước 3 chặn khi chưa allFormatted | Đúng: `FinalizeStep.tsx`; `handleGoSchedule` lưu rồi chuyển bước. |
| Resume bị giới hạn 3 | Đúng phía FE: `WizardDraft`, `resumeStep`, auto-save `Math.min(step, 3)`. DTO BE đã cho 1–4, nhưng service chỉ cho DRAFT. |
| Lưu APPROVED hai PATCH và dễ lỗi lần tiếp theo | Đúng: `saveContent` luôn PUT các version rồi PATCH NEED_REVIEW, APPROVED; BE không cho NEED_REVIEW → NEED_REVIEW. |
| NEED_REVIEW không format được | Đúng: thiếu trong `FORMATTABLE_STATUSES`. |
| Tạo lịch chỉ kiểm tra version/account, bỏ qua duyệt | Đúng: `PostScheduleServiceImpl.create`; item bị ghi SCHEDULED trực tiếp. |
| Item bị ghi theo nền tảng hoàn thành sau cùng | Đúng: worker success/failure và webhook ghi thẳng item; cancel dùng kiểm tra pipeline riêng. |
| Hủy mất duyệt; FORMATTED không sửa được | Đúng khi không còn lịch pipeline: item về FORMATTED, không nằm trong tập editable. |
| Có thể sửa version scheduled khi item FAILED | Đúng: `updateVersion` chỉ kiểm tra trạng thái item. |
| Worker không snapshot | Cần nói chính xác: đã có DTO `PublishTarget` bất biến để gọi HTTP ngoài transaction; nhưng lấy từ version ở mỗi lượt chạy, chưa lưu snapshot vào Post. |
| Đăng ngay và hàng đợi tự xếp chưa có | Đăng ngay trong Calendar chỉ toast + refresh. API hiện có CRUD lịch và giờ vàng, chưa có batch/publish-now/suggested-slots. |
| Schedule 1–1 version, Post 1–1 schedule | Đúng; lịch CANCELLED được tái sử dụng, Post cũ cũng được tái sử dụng khi mở chu kỳ mới. Cần phân biệt chu kỳ và retry. |
| LocalDateTime gây lệch múi giờ | Đúng: request dùng LocalDateTime + @Future, FE dùng giờ máy. Còn có `TimezoneVerificationConfig` và `system_config` chốt timezone cho dữ liệu cũ. |
| Disconnect để lịch trỏ vào account đã soft-delete | Đúng: MetaOAuth soft-delete và giữ lịch; update chỉ nhận giờ. |
| ON_HOLD được thả chỉ vì account ACTIVE | Đúng trong update lịch, chưa có lý do giữ. Còn luồng user PENDING_DELETE phải giữ nguyên bảo vệ. |
| Instagram luôn thất bại ở publisher | Đúng: `InstagramPublisherImpl` ném IG_MEDIA_REQUIRED; create chưa chặn. |
| Analytics dựa vào trạng thái tổng | Không đúng: `PostRepository.findDueForAnalytics` đã lọc `Post.POSTED`. Nhưng `saveSnapshot` vẫn ghi ANALYZING vào version/item. |
| ENUM_COLUMNS quản lý tất cả enum | Không đúng: danh sách hiện chỉ phủ payment/subscription, activity/notification, posting error type và AI test status; không phủ content/schedule status. |
| Không có Flyway/Liquibase | Đúng theo pom/resources; ddl-auto=update. Có nhiều initializer chạy DDL ngoài PaymentDataInitializer. |
| ON_HOLD của connection, OPTIMIZED dư | Không thấy nơi dùng ConnectionStatus.ON_HOLD hoặc ghi OPTIMIZED trong mã ứng dụng; chưa có bằng chứng DB không dùng. |
| backend/CLAUDE.md lỗi thời | Có mô tả cũ cần đối chiếu lại; tài liệu cũng đã có bổ sung auto-posting mới, nên sửa từng mục mâu thuẫn, không thay toàn bộ. |

## 2. Điều chỉnh thiết kế đề xuất để duyệt

### 2.1 Trạng thái và resolver

- Tách `ReviewStatus`: NONE, NEED_REVIEW, APPROVED, CHANGES_REQUESTED.
- Tách `ContentVersionStatus`: DRAFT, GENERATED, FORMATTED. Job generation/formatting vẫn có status riêng. Lịch không thay đổi trạng thái sản xuất.
- `ScheduleStatus` giữ vòng đời đăng. `PostingJobStatus` giữ vòng đời lần thực thi; không gộp chỉ vì trùng tên FAILED/POSTING. `PostStatus` hiện phục vụ analytics/admin: giữ trong giai đoạn chuyển đổi, cập nhật qua một dịch vụ chuyển trạng thái đăng, rồi đánh giá loại bỏ riêng nếu thực sự không cần.
- `ContentItemStatus`: DRAFT, GENERATED, FORMATTED, SCHEDULED, ON_HOLD, POSTING, POSTED, PARTIALLY_POSTED, FAILED. Duyệt là chip/filter riêng, ANALYZING/OPTIMIZED không điều khiển quyền sửa hay đăng.
- Chỉ `ContentItemStatusResolver` ghi trạng thái tổng, kể cả khởi tạo qua luồng service/mapper. Test kiến trúc kiểm tra các đường ghi còn sót.
- Đề xuất quy tắc tổng hợp: có POSTING → POSTING; nếu không, có POSTED và còn version hiện hành chưa POSTED → PARTIALLY_POSTED; tất cả version hiện hành đã POSTED → POSTED; không có POSTED thì ưu tiên FAILED → ON_HOLD → SCHEDULED; không còn lịch hiệu lực thì suy ra từ readiness của version (tất cả FORMATTED → FORMATTED; có nội dung → GENERATED; còn lại DRAFT). CANCELLED không tính là lịch đang hoạt động; version đã soft-delete không tính.
- PARTIALLY_POSTED xuất hiện trong mục cần xử lý như yêu cầu, nhưng giao diện phân biệt phần còn lại đang chờ đúng lịch với phần thực sự lỗi. Trả thêm số lượng theo trạng thái và `needsAttention`, không dùng một enum để suy đoán mọi chi tiết.
- Khóa theo item trước khi thay đổi version/schedule và tính resolver, với thứ tự khóa thống nhất item → version → schedule → job. Tránh hai worker đồng thời tính rồi ghi kết quả tổng từ dữ liệu cũ.

### 2.2 Hold không nên là một lý do duy nhất

Một lịch có thể đồng thời chưa được duyệt và mất kết nối. Một `hold_reason` đơn dễ bị luồng này ghi đè luồng khác. Đề xuất bảng `post_schedule_holds(schedule_id, reason, created_at)` unique theo schedule/reason, API trả `holdReasons[]`.

Các lý do: ACCOUNT_ISSUE, PENDING_REVIEW, ACCOUNT_REMOVED; bổ sung USER_PENDING_DELETE để giữ bảo vệ hiện hữu, UNSUPPORTED_MEDIA cho lịch IG cũ nếu được chuyển hold. Cờ quá giờ được suy ra từ scheduledTime và trạng thái giữ; notification quá giờ có khóa chống gửi lặp.

Mỗi luồng chỉ gỡ lý do mình quản lý. Chỉ chuyển về SCHEDULED khi không còn blocker, chưa quá giờ và policy vẫn cho phép. Duyệt muộn không tự đăng. Publish-now trên bài chưa duyệt khi bật bắt buộc duyệt sẽ báo cần duyệt trước; không tạo một lịch giữ đã quá giờ ngay lập tức.

### 2.3 Settings và quyền

Chưa thấy entity Workspace trong code; ownership đang theo User/BrandProfile. Đề xuất `UserPublishingSettings` 1–1 User cho workspace cá nhân hiện tại, không thêm hệ thống tenant/team ngoài phạm vi. Có timezone IANA (mặc định Asia/Ho_Chi_Minh), requireApproval=false, conflictWindowMinutes=60, brandVoiceBlockingEnabled=false và ngưỡng nullable chỉ bắt buộc khi bật.

Đề xuất quyền duyệt theo ownership hiện tại: chủ bài duyệt bài của mình; không tự mở quyền admin sửa dữ liệu người khác qua API người dùng. Nếu cần reviewer độc lập/team thì phải chốt quyền trước phase 2.

Thay đổi nội dung thực tế mới làm mất hiệu lực duyệt; PUT cùng dữ liệu là no-op. Khi policy bắt buộc duyệt, đổi nội dung/format/regenerate → NEED_REVIEW, giữ tất cả lịch chưa đăng của item vì review thuộc item. Policy tắt vẫn bỏ hiệu lực phê duyệt cũ nhưng không chặn đăng vì review. Chỉ POSTING khóa sửa; sửa bản đã POSTED không thay đổi snapshot/historical post. Wizard sau khi lên lịch giữ bước 1–3 chỉ đọc; luồng chỉnh sửa bài hiện hữu là điểm vào riêng.

### 2.4 Snapshot, retry và publish-now

Snapshot caption/hashtags/CTA/link/media references và revision vào Post trong cùng transaction claim lịch + tạo job. Mọi retry dùng cùng snapshot. Token lấy mới từ account khi gửi, không lưu token trong snapshot. Luồng format/regenerate hoàn tất cũng phải kiểm tra revision/quyền sửa để job AI cũ không ghi đè bài đã dispatch.

Đăng ngay dùng cùng dịch vụ claim với scheduler: server gán Instant.now(), transaction ghi job bền vững, kích hoạt worker sau commit, trả job ngay. Không gọi toàn bộ vòng quét scheduler từ HTTP. Giữ cơ chế phục hồi job PENDING nếu mất dispatch.

Idempotency nội bộ không bảo đảm exactly-once ở Meta khi nền tảng đã nhận bài nhưng phản hồi bị mất. Giữ đúng retry 5/15/30 và báo rõ giới hạn này; không tuyên bố chống được mọi dạng đăng trùng ngoài hệ thống.

### 2.5 Migration và dữ liệu lịch sử

- Baseline phải gồm toàn schema ứng dụng: entity + index/check/DDL trong initializer, `shedlock`, `system_config`; không chỉ vài bảng content. Không bật baseline-on-migrate tự động trên DB bất kỳ.
- DB trống chạy V1 tạo schema; bản sao DB cũ phải đối chiếu schema rồi baseline V1 tường minh trước V2+. Không chạy V1 CREATE TABLE lên DB đã có bảng.
- Đưa DDL ra khỏi `PaymentDataInitializer`, `PlatformDataInitializer`, `UsageDataInitializer`, `PlanDataInitializer`, `AiConfigDataInitializer`, `TimezoneVerificationConfig`, `SchedulerLockConfig`; giữ seed dữ liệu nếu còn cần. Không để initializer sửa CHECK ngược với Flyway.
- Chuyển thời gian nghiệp vụ đăng (schedule, publish, retry/start/end và các timestamp liên quan dùng so sánh) sang Instant/timestamptz bằng phép chuyển timezone có chỉ định Asia/Ho_Chi_Minh. Không đổi JVM timezone toàn cục khi BaseEntity/payment/usage còn là giờ địa phương. Audit rõ các phép so sánh chéo và truy vấn native trước khi đổi kiểu.
- Kiểm tra `system_config.app.timezone` trên bản sao; nếu khác giả định hoặc dữ liệu trộn múi giờ thì dừng chuyển thời gian và báo, không đoán.
- Trạng thái duyệt đã bị lịch ghi đè không thể khôi phục chắc chắn. Map APPROVED/NEED_REVIEW khi còn bằng chứng; phần không xác định báo riêng, dùng NONE nếu không có bằng chứng đáng tin. Job sửa trạng thái tổng không được tự phê duyệt.
- Trước khi bỏ enum: thống kê mọi giá trị, kể cả soft-delete, trên bản sao. Giá trị không ánh xạ được → dừng migration và báo; không xóa dữ liệu để qua constraint.
- Chưa có danh sách lịch IG thật. Phase 0 chuẩn bị báo cáo trên bản sao; mặc định đề xuất hold các lịch IG chưa đăng bằng UNSUPPORTED_MEDIA, không đổi các Post lịch sử đã đăng.

## 3. Danh mục ảnh hưởng cần đối chiếu trước sửa

Đường dẫn BE dưới `backend/src/main/java/com/aima`, FE dưới `frontend/src`. Bao gồm cả query native và mapper, không chỉ nơi gọi setStatus.

| Nhóm | File/nhóm file |
|---|---|
| Model/contract BE | `entity/{ContentItem,ContentVersion,PostSchedule,Post,PostingJob,PlatformAccount,User}`, `enums/{ContentLifecycle,ScheduleStatus,PostStatus,PostingJobStatus,ConnectionStatus}`, DTO request/response ContentItem/ContentVersion/ContentWizardState/PostSchedule, `dto/publish/PublishTarget`, error codes, notification enums |
| Mapping | `mapper/{ContentItemMapper,ContentFormattingMapper,AiContentMapper,PostScheduleMapper,PostPublishMapper,PostAnalyticsMapper}` |
| Sửa/tạo/format | `service/Impl/{ContentItemServiceImpl,ContentGenerationServiceImpl,ContentGenerationWorkerServiceImpl,ContentFormattingServiceImpl,ContentFormattingWorkerServiceImpl,ContentRegenerationServiceImpl,ContentRegenerationWorkerServiceImpl}` và interfaces/controllers tương ứng |
| Lịch/đăng | `PostScheduleServiceImpl`, `PostPublishWorkerServiceImpl`, `FailedPostServiceImpl`, `FacebookPublisherImpl`, `ThreadsPublisherImpl`, `InstagramPublisherImpl`, `scheduler/PostingDispatchJob`, `controller/PostScheduleController` |
| Account/hold | `MetaOAuthServiceImpl`, `MetaWebhookServiceImpl`, `MetaDataDeletionServiceImpl`, `PlatformConnectionServiceImpl`, `scheduler/{TokenHealthCheckJob,TokenValidationJob}`, luồng delete/restore trong `UserServiceImpl`, `AccountPurgeService` |
| Đọc/tổng hợp BE | `DashboardServiceImpl`, `AdminMonitorServiceImpl`, `AnalyticsServiceImpl`, `PostAnalyticsServiceImpl`, `StrategyOptimizationServiceImpl`, `StrategyOptimizationWorkerServiceImpl`, `scheduler/AnalyticsCollectionJob`; DTO DashboardStats/Platform, AnalyticsPlatform và projections StatusCount/DailyStatusCount |
| Repository | `ContentItemRepository`, `ContentVersionRepository`, `PostScheduleRepository`, `PostRepository`, `PostingJobRepository`, `PlatformAccountRepository`, các truy vấn analytics/dashboard/admin có literal status và cast timestamp |
| Schema/bootstrap | `pom.xml`, main/test application YAML, các initializer liệt kê ở §2.5, migration mới, profile/compose cô lập mới |
| FE contract | `api/{contentGeneration,contentCreationService,schedules,connections,analytics}.ts`, `createData.ts`, `statusTokens.ts`, `i18n.ts`, `context/AppContext.tsx` khi điều hướng cần tham số |
| FE wizard/list | `App.tsx`, `pages/app/{CreateWizard,Create}.tsx`, `components/create/{WizardStepper,ContentList,ContentTable,ContentViewPanel,statusMeta}`, các steps Source/Generate/Finalize/Schedule |
| FE calendar | `pages/app/Calendar.tsx`, `components/calendar/{ScheduleModals,ScheduleDetailView,ScheduleDetailModal,MonthGrid,UpcomingPanel,StatCards,statusMeta,dateUtils}`, API và logic filter/focus ngày |
| FE bổ sung | `components/schedule/{SchedulePlanner,SchedulePlatformRow}`, ReadinessChecklist, settings UI, trang Dashboard/Analytics/FailedPosts/Admin tiêu thụ số liệu, `platformLimits.tsx` |
| Tài liệu/test | `backend/CLAUDE.md`, `docs/{PLAN,WORKFLOWS,DATA_MODEL,UI_API,REQUIREMENTS}.md`, tests content/posting/connection/account/analytics/dashboard/admin và FE tests |

Trước từng phase quét lại cả enum references, literal SQL/TS và các writer mới xuất hiện do thay đổi song song. Danh mục trên là phạm vi audit; không bắt buộc sửa file nếu contract không đổi.

## 4. Kế hoạch theo phase và tiêu chí nghiệm thu

### Phase 0 — stack cô lập, Flyway và thời gian

Files: cấu hình/schema/bootstrap ở §3; settings entity/repository/DTO, time utilities FE và schedule/posting/analytics DTO/repository dùng thời gian.

Migration dự kiến: V1 schema baseline; V2 publishing settings + chuyển timestamp. Số phiên bản chốt theo repository khi bắt đầu.

Thiết lập Postgres localhost:55432, BE :8092, FE :3100, Redis riêng và Meta/AI/email/payment giả. Cấu hình test độc lập không import `.env` thật; fail fast khi DB/endpoint ngoài allowlist. Dùng tài khoản/token giả. Scheduler chỉ được bật trong stack này theo test có kiểm soát.

Test: DB trống; bản sao legacy; migrate hai lần; Hibernate validate; CHECK/index/FK còn đủ; 23:30 VN qua ranh giới UTC; client/server khác timezone; lịch quá khứ bị BE từ chối. H2 hiện hữu chỉ dùng cho test không phụ thuộc PostgreSQL, không thay thế test migration/lock.

Rủi ro: schema drift, DDL ẩn ở initializer, dữ liệu timezone không đồng nhất. Không có bản sao schema thật thì chỉ xác nhận baseline theo repo/fixture, không tuyên bố production-ready.

**Dừng báo kết quả, chờ duyệt trước phase 1.**

### Phase 1 — D2 và resolver

Files: entity/enums/mapper/contract, toàn bộ writer và reader trong §3; cập nhật FE type/status mapping tối thiểu để build không vỡ giữa phase.

Migration V3: review_status, production status, item aggregate status, ánh xạ legacy có kiểm tra, revision/lock nếu cần. Không loại enum chưa xác minh dữ liệu.

Tests bắt buộc: `ContentItemStatusResolverTest` (mọi tổ hợp và thứ tự hoàn thành), `ContentItemServiceImplTest`, `PostScheduleServiceImplTest`, cập nhật worker tests; hai nền tảng success/failure đồng thời; cancel một/all lịch không mất review; analytics vẫn thu Post đã đăng khi item partial/failed; dashboard/filter/admin tương thích.

Rủi ro: đổi ngữ nghĩa API, lost update, dữ liệu review lịch sử không khôi phục được. Endpoint review lặp cùng trạng thái phải no-op hợp lệ.

**Dừng báo kết quả, chờ duyệt trước phase 2.**

### Phase 2 — duyệt, hold, sửa bài, snapshot và chặn IG

Files: services content/schedule/publish/accounts, scheduler, publishers, settings API/UI, notifications, snapshot DTO/mapper.

Migration V4: holds, snapshot/revision, notification dedupe. Snapshot cũ không có nội dung lịch sử phải đánh dấu không biết, không giả là nội dung thực lúc đăng.

Tests: bật/tắt policy; approve trước/sau hạn; nhiều hold đồng thời; reconnect chỉ gỡ ACCOUNT_ISSUE; account removed và pending-delete; sửa no-op; sửa scheduled/held; khóa POSTING; AI format hoàn tất trễ; sửa vs dispatch chạy đồng thời; retry dùng snapshot cũ; giữ nguyên retry 5/15/30 và không retry permanent/policy; IG bị BE chặn.

Rủi ro: job đang chạy, stale approval, hold bị gỡ nhầm. Quy tắc khi đổi setting được thực thi lại trên các lịch chưa dispatch trong cùng luồng có kiểm soát; bật policy không bỏ sót lịch cũ.

**Dừng báo kết quả, chờ duyệt trước phase 3.**

### Phase 3 — API lịch dùng chung

Files: PostSchedule controller/service/repository/DTO, dịch vụ claim/dispatch dùng chung với PostingDispatchJob, API FE schedules.

Migration V5: idempotency record với unique `(owner, operation, key)`, request hash và kết quả theo dòng. Mỗi dòng có clientRowId/idempotencyKey; transaction độc lập qua bean/proxy hoặc TransactionTemplate, không dùng self-invocation REQUIRES_NEW. Cùng key/cùng payload trả lại kết quả, key khác payload báo conflict. Dòng lỗi có thể retry mà không tạo lại dòng thành công.

API: POST `/schedules/batch`; POST đơn dùng cùng logic; POST `/schedules/{id}/publish-now` cho Calendar và mode NOW trong create/batch; GET `/schedules/suggested-slots?accountId=&from=&count=`; PUT lịch cho account cùng platform + giờ.

Kết quả batch nằm trong ApiResponse, mỗi dòng có code/message/schedule/job/warnings. Conflict cùng account theo cửa sổ cấu hình chỉ cảnh báo, không unique/block. Suggested slots kiểm tra ownership, timezone, loại lịch chiếm chỗ và giới hạn count; không tạo lịch hay giữ slot. Gợi ý có thể cũ trước lúc submit, server tính lại cảnh báo.

Tests: mixed success/failure, ownership từng dòng, idempotency sau reload và request đồng thời, crash sau commit trước response, publish-now vs scheduler, account mismatch/deleted, slot hết chỗ, ranh giới 60 phút, review/time/IG checks không bypass được.

**Dừng báo kết quả, chờ duyệt trước phase 4.**

### Phase 4 — SchedulePlanner dùng chung

Files: `components/schedule/SchedulePlanner.tsx`, `SchedulePlatformRow.tsx`, API adapter, date/time validation, Calendar CreateScheduleModal wrapper.

Chọn item rồi nạp version; một dòng mỗi platform; active account hợp lệ; IG bị khóa có lý do; NOW/SCHEDULE/SUGGEST/NONE; chung giờ; golden hours; mini MonthGrid; cảnh báo conflict; kết quả theo dòng và retry lỗi. Dùng giờ workspace, không slice chuỗi UTC để chọn ngày hiển thị.

Tests: logic chọn dòng, shared time, timezone, payload/idempotency key, partial response; browser trên :3100 cho mobile/desktop, keyboard/focus, lỗi API. Mọi key vi/en. Không thêm hàng đợi thật.

**Dừng báo kết quả, chờ duyệt trước phase 5.**

### Phase 5 — bước 3/4, resume URL, danh sách và Calendar

Files: wizard/steps/stepper/list/view panel/App routes/Calendar và i18n.

ReadinessChecklist theo platform; hành động sửa tại chỗ; CTA tiếp tục và lưu nháp & thoát. Có thể vào bước 4 để xử lý readiness, chỉ submit dòng đủ điều kiện. Duyệt ngay theo quyền server trả về. URL `/create/:id?step=N`, cập nhật ngay khi có shell, load detail trực tiếp cho chế độ chỉ lên lịch; lỗi ownership/not-found rõ ràng; reload/back-forward đúng bước. Lưu state planning (account/mode/time/shared-time) trên BE nếu yêu cầu reload bao gồm lựa chọn chưa submit; không lưu token. Đây là phần schema bổ sung V6 nếu cần, không nhét lịch thật vào wizard draft.

Sau khi lên lịch: bước 1–3 chỉ đọc; thành công có xem lịch focus ngày, tạo mới, về danh sách. ContentTable có Lên lịch và tiến độ theo trạng thái mới; Calendar edit mở đúng item và publish-now gọi API thật. Lưu nháp không được ngầm bỏ duyệt hoặc hủy lịch.

Tests: luồng hoàn chỉnh; APPROVED → bước 4 → quay lại → lưu lại; refresh bước 4; vào từ list/calendar; source không còn active nhưng bài có sẵn vẫn xem/lên lịch được; thành công một phần; lỗi 403/404; lịch qua nửa đêm; chặn chỉnh bước cũ sau submit.

**Dừng báo kết quả, chờ duyệt trước phase 6.**

### Phase 6 — sửa dữ liệu cũ và tài liệu bàn giao

Job một lần, chạy tường minh, mặc định dry-run, chia batch có khóa/revision; in itemId/trạng thái cũ/mới/lý do, không in nội dung/token. Apply dùng cùng resolver, kiểm tra lại dữ liệu thay đổi kể từ dry-run; chạy lần hai không thay đổi nữa. Không tự chạy job khi boot.

Báo cáo enum còn dùng, lịch IG, hold chưa phân loại, review không xác định và schema drift; chỉ dọn enum sau preflight đạt. Cập nhật PLAN với ngày hoàn thành từng phần đã implement + verify, WORKFLOWS kèm state machine, DATA_MODEL/UI_API/REQUIREMENTS và backend/CLAUDE. Viết runbook backup, maintenance dừng worker, migration, validate, backfill và rollback/restore; production do người dùng thực hiện.

Test toàn luồng trên :55432/:8092/:3100; dry-run không ghi; apply idempotent; đối chiếu tổng hợp và số liệu analytics; không phát sinh request ra Meta thật.

## 5. Gate chung cho mọi phase

- Test bắt buộc tương ứng resolver/worker/PostScheduleServiceImpl/ContentItemServiceImpl được thêm hoặc cập nhật khi phần đó thay đổi; chạy regression liên quan.
- Chạy backend build/test và frontend test/build trong cấu hình cô lập. Không chạy Maven Spring context với cấu hình production mặc định.
- Báo file/migration đã đổi, test pass/fail, rủi ro và phần chưa xác minh. Không tick PLAN cho phần chưa hoàn thành.
- Dừng sau từng phase như yêu cầu, không tự đi tiếp.

## 6. Những quyết định cần duyệt cùng kế hoạch

1. Dùng nhiều holdReasons và bổ sung USER_PENDING_DELETE/UNSUPPORTED_MEDIA thay cho một hold_reason đơn.
2. Settings theo User hiện tại; chủ bài được duyệt bài của mình. Chưa xây team/workspace mới.
3. Quy tắc tổng hợp ở §2.1; review/analytics tách khỏi aggregate enum, PARTIALLY_POSTED kèm chi tiết từng platform.
4. Lịch IG chưa đăng trên bản sao được hold thay vì cho chạy thất bại; production chỉ thực hiện theo runbook sau khi người dùng kiểm tra danh sách.
5. Phase 0 dùng baseline repo/fixture trước; xác nhận với bản sao schema/dữ liệu thật là điều kiện trước áp dụng production. Không truy cập Supabase trong phiên này.

Tiến độ thực tế và điểm tiếp tục được ghi tại [bàn giao cho Claude Code](CREATE_SCHEDULE_HANDOFF.md); checklist hoàn thành nằm trong [PLAN.md](PLAN.md). Phase 0–6 đã triển khai và kiểm chứng trên stack cô lập (2026-09-30); áp dụng production theo [runbook production](SCHEDULING_PRODUCTION_RUNBOOK.md).
