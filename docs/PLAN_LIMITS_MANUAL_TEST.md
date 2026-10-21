# Kiểm thử giới hạn gói & khoá nền tảng (A–E) — chạy cô lập + checklist test tay

> Phạm vi: khoá/mở nền tảng toàn hệ thống (admin), nền tảng theo gói (`ALLOWED_PLATFORMS`), các lỗ hổng giới hạn
> đã vá (C1–C12), modal Thêm/Sửa gói mới và bảng so sánh. Chưa có key Instagram/Threads nên hai nền tảng này được
> kiểm chứng bằng test tự động (§1) + dữ liệu GIẢ (§3); test tay chỉ dùng Facebook thật (§4).
>
> ⚠️ **Không bao giờ** chạy backend bằng `backend/.env` cho các bước dưới đây — nó trỏ Postgres Supabase thật và
> bật scheduler đăng bài thật. Mọi lệnh ở đây dùng `isolated/application.yml` (không import `.env`).

## 0. Thành phần stack cô lập

| Thành phần | Địa chỉ | Ghi chú |
|---|---|---|
| Postgres 15 | `127.0.0.1:55432` / DB `aima_isolated` / user `aima_isolated` | container `aima-scheduling-isolated-postgres-1` |
| Redis | `127.0.0.1:56379` | container `aima-scheduling-isolated-redis-1` |
| Stub Meta / AI / email / payOS | `127.0.0.1:58080` | `backend/isolated/mock-services.mjs` |
| Backend | `http://localhost:8092/api/aima` | profile `isolated`, `app.scheduling.enabled=false` |
| Frontend | `http://localhost:3100` | mở bằng **localhost** (không 127.0.0.1 — cookie) |

`config/IsolatedStackConfig` (profile `isolated`) **từ chối khởi động** nếu DB/Redis/cổng/URL ngoài không đúng bảng
trên, hoặc scheduler đang bật.

## 1. Test tự động (thay cho test tay IG/Threads)

```powershell
cd backend
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot"
docker compose -f isolated/compose.yml up -d            # Postgres + Redis cô lập

# Kịch bản E2E trên Postgres cô lập (publisher Meta là mock — KHÔNG gọi Meta thật)
.\mvnw.cmd -o test "-Disolated.postgres=true" "-Dtest=PlatformEntitlementPgTest,PlanLimitsApiPgTest,PublishingMigrationTest"

# Toàn bộ suite (H2) — baseline có sẵn 15 test fail, xem memory/backend-build-test-quirks
.\mvnw.cmd -o test

cd ..\frontend; npm test; npm run build
```

| Kịch bản | Test |
|---|---|
| 1a giữ lịch Threads một lần sau seed + SCHEDULE_HELD không trùng | `PlatformEntitlementPgTest.s1a_initialSeed_holdsPreExistingThreadsSchedulesOnce_andNotifiesOnce` |
| 1b Threads: tạo / dời / đăng ngay bị chặn 2210 | `s1b_preConnectedThreadsAccount_createRescheduleAndPublishNow_blockedWith2210` |
| 1c dispatch + worker không gọi publisher, job FAILED không retry | `s1c_lockedPlatform_dispatchHoldsAndWorkerStopsWithoutCallingPublisher` |
| 1d admin khoá FB → giữ lịch → mở → user tiếp tục → đăng đúng 1 lần | `s1d_adminLocksFacebookViaApi_holdsSchedules_unlockKeepsHold_userResumes_publishesOnce` |
| 1e khoá khi worker đang chạy — kiểm tra cuối đọc DB | `s1e_lockWhileWorkerRunning_finalCheckReadsDatabaseNotCache` |
| 1f gói không gồm nền tảng: OAuth bỏ kênh, 2206, hạ gói giữ lịch | `s1f_platformNotInPlan_oauthSkipsChannel_createBlocked2206_downgradeHolds` |
| 1g hết hạn lười về FREE → lịch PRO cũ không đăng | `s1g_lazyExpiryToFreeWithoutScheduling_oldProScheduleNeverPublishes` |
| 1h lịch giữ do hệ thống không chiếm hàng đợi; tiếp tục kiểm lại quota + horizon | `s1h_systemHeldSchedulesFreeTheQueue_resumeRechecksQuotaAndHorizon` |
| 1i 2205/2206 (HTTP 403), song song, plan-usage, chu kỳ, analytics user hết hạn, 2211 | `PlanLimitsApiPgTest` (8 test) |

## 2. Chạy backend + frontend cô lập

```powershell
cd backend
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot"   # cần JDK 21 (mỗi cửa sổ chạy Maven)
docker compose -f isolated/compose.yml up -d
node isolated/mock-services.mjs                # cửa sổ 1 — stub 127.0.0.1:58080
.\isolated\start-backend.ps1                   # cửa sổ 2 — BE 8092, scheduler TẮT
.\isolated\start-frontend.ps1                  # cửa sổ 3 — FE 3100 (VITE_API_BASE_URL → 8092)
```

Admin seed: `admin@gmail.com` / `Admin123`. Flyway tự chạy V20/V21 trên DB cô lập khi khởi động.

## 3. Dữ liệu mẫu DEV-ONLY (xem giao diện khoá / Tạm giữ không cần key)

`backend/src/main/java/com/aima/config/init/DevPlanLimitsSeeder.java` — chỉ chạy khi **đủ cả ba**: profile `isolated`,
cờ `--aima.dev-seed.plan-limits=true`, và kết nối thật của DataSource là `127.0.0.1|localhost:55432/aima_isolated`
(sai → log `[DevSeed] TỪ CHỐI seed`, không ghi gì). Idempotent: đã có `free.dev@aima.local` thì bỏ qua.

```powershell
cd backend
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.jvmArguments=-Duser.timezone=Asia/Ho_Chi_Minh' '-Dspring-boot.run.arguments=--spring.config.location=file:./isolated/application.yml --spring.profiles.active=isolated --aima.dev-seed.plan-limits=true'
```

Mật khẩu mọi tài khoản: `Dev12345!`

| Tài khoản | Gói | Ghi chú |
|---|---|---|
| `free.dev@aima.local` | FREE | 3 kênh (vượt hạn mức 1 kênh — xem "còn 0 kênh") |
| `plus.dev@aima.local` | PLUS | |
| `pro.dev@aima.local` | PRO | |
| `allplatforms.dev@aima.local` | `DEV_ALL` (gói tự tạo, ẩn, cho phép FB/IG/Threads) | thấy khoá do HỆ THỐNG, không do gói |

Mỗi user: 1 thương hiệu, Trang Facebook + Threads + Instagram GIẢ (token giả, không gọi Meta), 1 bài với 3 lịch
(+1/+2/+3 ngày). Lịch Threads/IG → **Tạm giữ** `PLATFORM_DISABLED` + thông báo `SCHEDULE_HELD` (như khi admin khoá).

Kiểm nhanh (đăng nhập `free.dev`):
- [ ] Cài đặt → Kết nối: Threads/IG hiện huy hiệu khoá + lý do; dòng "còn 0 kênh"; Facebook bình thường.
- [ ] Lịch / Tạo nội dung: chip Threads/IG bị vô hiệu kèm ổ khoá; lịch Threads/IG hiện "Tạm giữ" đúng lý do.
- [ ] Chuông: 2 thông báo "lịch bị tạm giữ" (Threads, Instagram), bấm mở đúng trang.
- [ ] Thanh toán → Mức sử dụng: dòng nền tảng của gói, thương hiệu, kênh 3/1.

Xoá dữ liệu mẫu để seed lại: dừng BE rồi xoá các user `%.dev@aima.local` (và gói `DEV_ALL`) trên DB **cô lập** —
hoặc đơn giản `docker compose -f isolated/compose.yml down -v` (xoá sạch DB cô lập).

## 4. Checklist test tay với Facebook THẬT

Profile `isolated` cấm URL Meta thật, nên dùng lớp phủ `backend/isolated/application-realmeta.yml` (DB/Redis vẫn là
container cô lập; scheduler vẫn TẮT — chỉ đăng bằng "Đăng ngay").

1. Meta App (Facebook Login) → Valid OAuth Redirect URIs thêm `http://localhost:8092/api/aima/connections/FACEBOOK/callback`.
2. Chạy BE (PowerShell, cửa sổ riêng — key chỉ nằm trong biến phiên, không ghi file):
   ```powershell
   cd backend
   $env:META_FACEBOOK_APP_ID = "<app id>"; $env:META_FACEBOOK_APP_SECRET = "<app secret>"
   # $env:META_FACEBOOK_CONFIG_ID = "<config id>"   # nếu dùng Facebook Login for Business
   .\mvnw.cmd spring-boot:run '-Dspring-boot.run.jvmArguments=-Duser.timezone=Asia/Ho_Chi_Minh' '-Dspring-boot.run.arguments=--spring.config.location=file:./isolated/application.yml,file:./isolated/application-realmeta.yml'
   ```
   FE như §2 (`start-frontend.ps1`). Đăng nhập bằng user seed §3 (vd `pro.dev@aima.local` — chạy §3 một lần trước;
   stub email không lưu OTP nên đừng đăng ký user mới ở stack này).
3. User: Cài đặt → Kết nối → kết nối Facebook thật; tạo bài, lên lịch 2 bài vào Trang (một giờ xa, một giờ gần).

**Khoá Facebook** (admin → Quản trị → Version API, cột "Liên kết"):
- [ ] Gạt tắt Facebook → hộp thoại hiện số tài khoản đang kết nối + số lịch chưa đăng; lý do VI/EN bắt buộc (trống → báo lỗi).
- [ ] Xác nhận → toast số lịch bị tạm giữ; cột hiện "Đã khoá" + người/ngày đổi.
- [ ] User: Cài đặt → Kết nối: Facebook hiện khoá + lý do đúng ngôn ngữ (đổi VI/EN); nút kết nối bị vô hiệu.
- [ ] Gọi lại kết nối (nếu còn tab cũ) → về Cài đặt với lỗi "nền tảng tạm khoá".
- [ ] Lịch: 2 lịch Facebook "Tạm giữ — nền tảng tạm khoá"; tạo lịch mới chọn Trang FB → chặn (chip khoá / lỗi 2210).
- [ ] "Đăng ngay" trên lịch đang giữ → bị từ chối, không có bài lên Trang.
- [ ] Chuông: đúng MỘT thông báo "lịch bị tạm giữ" cho Facebook (khoá lại lần nữa không nhân đôi trong cùng lượt).

**Mở lại:**
- [ ] Admin gạt bật → tài khoản Facebook hết khoá ngay (≤ 30 s cache), lịch **vẫn** Tạm giữ (không tự đăng lại).
- [ ] User: mở lịch giờ xa → "Kích hoạt lại" → về Đã lên lịch. Lịch đã quá giờ → bắt chọn giờ mới.
- [ ] "Đăng ngay" một lịch đã kích hoạt lại → bài lên Trang đúng một lần; trạng thái Đã đăng.

## 5. Checklist giao diện — modal gói + bảng so sánh

Admin → Gói dịch vụ (`/admin/plans`). Kiểm ở cả **light/dark**, VI/EN, desktop ≥ 1280 px và mobile 375 px.

Modal Thêm/Sửa gói:
- [ ] Rộng ~1180 px, header + footer dính khi cuộn; không có thanh cuộn ngang ở mọi bề rộng.
- [ ] Menu dọc 5 mục; mục có lỗi hiện chấm/số lỗi; bấm nhảy đúng mục.
- [ ] Cột phải: thẻ xem trước cập nhật tức thì; nút VI/EN đổi ngôn ngữ thẻ.
- [ ] Giới hạn: nhóm + mục lục dính; segmented [Giới hạn | Không giới hạn | Tắt | Mặc định]; ô số có đơn vị;
      "Mặc định" chỉ có ở gói lõi (FREE/PLUS/PRO); gói tự tạo để trống → lỗi bắt buộc, không lưu được (2211).
- [ ] Nền tảng: 3 chip; Threads/IG ghi chú "đang khoá toàn hệ thống".
- [ ] Danh sách tính năng: thêm/xoá/kéo (chỉ ở tay nắm)/↑↓; "Tạo gợi ý từ giới hạn" sinh đúng số thật, nền tảng khoá ghi "(Sắp ra mắt)";
      cảnh báo vàng khi dòng nói sai (vd "Đủ 3 nền tảng" trên gói chỉ có Facebook).
- [ ] Sửa rồi bấm đóng → hỏi bỏ thay đổi. Lưu gói đang có người dùng → hộp xác nhận nêu số người đăng ký.

Bảng so sánh (tab Xem trước của admin, `/pricing`, khu bảng giá Landing):
- [ ] Mọi ô căn giữa, cột đều nhau (table-layout fixed); ✓ / — / chữ hiển thị giống nhau ở admin và landing.
- [ ] Dòng gắn giới hạn có nhãn "Tự động" (admin) và giá trị khớp giới hạn gói; dòng thủ công có cảnh báo ở admin.
- [ ] Dòng nền tảng: "Facebook · Threads (Sắp ra mắt)" khi Threads đang khoá; khoá/mở ở Version API → bảng đổi theo.
- [ ] Mobile: bảng cuộn ngang, cột tên tính năng dính trái; không vỡ khung trang.
