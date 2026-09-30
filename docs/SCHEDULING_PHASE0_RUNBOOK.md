# Phase 0 — schema và thời gian đăng bài

## Phạm vi

Flyway sở hữu schema PostgreSQL; Hibernate chỉ `validate`. V1 là baseline từ toàn bộ entity của repository ngày 2026-09-29 và DDL bổ sung trước đây nằm trong initializer. V2 chuyển sáu cột nghiệp vụ sang `timestamptz`: lịch đăng, ngày đăng, start/end/retry của posting job, ngày thu analytics; thêm settings đăng bài theo User. Audit `BaseEntity`, payment, usage và timezone JVM không đổi.

Đây **không phải bản dump đã đối chiếu với Supabase thật**. Test dùng PostgreSQL cô lập và fixture legacy. Không áp dụng V1 hoặc đánh baseline cho production chỉ vì Hibernate validate qua: Hibernate không xác nhận hết CHECK, index, trigger, RLS, extension hay dữ liệu lịch sử.

## Chạy cô lập

Từ thư mục repo:

```powershell
docker compose -f backend/isolated/compose.yml up -d --wait
node backend/isolated/mock-services.mjs
```

Trong terminal riêng:

```powershell
./backend/isolated/start-backend.ps1
./backend/isolated/start-frontend.ps1
```

- PostgreSQL: `127.0.0.1:55432/aima_isolated`, user `aima_isolated`, password `isolated-only`.
- Redis riêng: `127.0.0.1:56379`; BE `http://localhost:8092/api/aima`; FE `http://localhost:3100`.
- Config BE là file độc lập, không import `.env`. Script FE đặt `VITE_API_BASE_URL` trong process trước Vite, ghi đè giá trị `.env` mà không sửa file đó.
- Cấu hình giả không chứa khóa thật. Stub :58080 trả 503 cho thao tác chưa cấu hình, không forward request. Payment dùng mock. Không dùng chức năng OAuth đăng nhập/liên kết thật trên stack này.
- `IsolatedStackConfig` kiểm tra DB/Redis/endpoints trước khi tạo DataSource/Flyway. Scheduler tự động bị tắt; kiểm thử dispatcher/worker qua test điều khiển trực tiếp và MockWebServer.
- Không khởi động BE bằng cấu hình mặc định trong phiên thử nghiệm này. Không restore token thật vào stack có quyền gọi mạng.

Kiểm thử:

```powershell
cd backend
./mvnw.cmd "-Disolated.postgres=true" clean test
./mvnw.cmd -DskipTests package
cd ../frontend
npm test
npm run build
```

`PublishingMigrationTest` chỉ chấp nhận URL cố định :55432, tạo schema tên `phase0_<UUID>`, rồi xóa chính schema test đó. Không xóa database/volume. Các test H2 cũ được giữ cho các luồng không kiểm tra đặc thù PostgreSQL. Sau khi xóa/đổi tên class initializer, dùng `clean` để class cũ không còn trong output của Maven.

Dừng stack bằng `docker compose -f backend/isolated/compose.yml stop`. Không dùng `down -v` nếu cần giữ dữ liệu thử nghiệm.

## Contract thời gian

- POST/PUT lịch bắt buộc ISO-8601 có `Z` hoặc offset: `2026-10-01T00:30:00+07:00` tương đương `2026-09-30T17:30:00Z`. Chuỗi không timezone bị từ chối.
- DTO và service cùng kiểm tra thời gian tương lai. Client chỉ hỗ trợ UX.
- GET `/users/me/publishing-settings` yêu cầu đăng nhập, trả timezone của chính user; mặc định `Asia/Ho_Chi_Minh`. Phase 0 chỉ expose timezone; UI chỉnh policy và quyền duyệt thuộc Phase 2.
- API lịch trả Instant; adapter FE hiển thị ISO có offset timezone đăng bài. Không dùng `Date` theo timezone máy để chuyển giờ nhập thành giờ đăng. Giờ DST không tồn tại hoặc trùng hai lần bị từ chối.
- Báo cáo analytics/admin vốn theo ngày Việt Nam giữ nguyên contract ngày bằng `AT TIME ZONE 'Asia/Ho_Chi_Minh'` tường minh. Việc tùy biến timezone toàn bộ báo cáo không thuộc phase này.

## Chuẩn bị nâng cấp dữ liệu cũ — người dùng thực hiện production

1. Dừng scheduler và các writer/worker, đợi việc đang chạy kết thúc. Ghi nhận job đang POSTING/RUNNING và kết quả Meta để tránh đăng trùng khi phục hồi.
2. Backup toàn bộ DB bằng công cụ PostgreSQL/Supabase phù hợp, gồm schema, dữ liệu, quyền/trigger/RLS cần thiết. Kiểm tra restore trên DB cô lập trước khi tiếp tục. Không đưa secret/token thật vào log hay repo.
3. Tạo bản sao đã làm sạch credential trong stack :55432. So sánh schema với V1: bảng/cột/kiểu/nullability/default/unique/FK/CHECK/index, cả `shedlock` và `system_config`. Nếu khác, lập migration điều hòa riêng; không tự bỏ constraint để vượt lỗi.
4. Đối chiếu `system_config.app.timezone` và lịch sử cấu hình JVM/JDBC. V2 chỉ nhận `Asia/Ho_Chi_Minh` hoặc alias `Asia/Saigon`; không có bằng chứng hoặc dữ liệu lẫn timezone thì dừng. Không sửa metadata sang VN để qua guard.
5. DB có dữ liệu, chưa có `flyway_schema_history`: sau khi đối chiếu đạt, dùng Flyway CLI **baseline tường minh version 1**, với URL và credential do người vận hành chọn. `baseline-on-migrate=false` luôn giữ nguyên. Baseline không kiểm chứng schema thay người vận hành.
6. Chạy migrate/validate trên bản sao, xem chênh lệch timestamp theo instant, số lượng/FK/CHECK/index, chạy test và báo cáo lịch IG. Chưa chạy job resolver/backfill trạng thái ở Phase 0.
7. Chỉ sau backup/restore rehearsal và kiểm chứng bản sao mới làm lại quy trình đã duyệt trên production. Backend cũ dùng LocalDateTime không tương thích schema V2; không rollback mỗi binary. Nếu cần rollback, dừng writer và restore cả DB/binary từ backup đã kiểm chứng. Không dùng Flyway clean trên production.

DB trống: Flyway chạy V1 rồi V2. DB đã baseline V1: chỉ chạy V2. V2 chạy trong transaction; sai timezone rollback, không để nửa cột đã đổi kiểu. Chạy migrate lại không thực thi migration đã hoàn thành.

## Quy tắc thay schema sau này

Thêm migration mới khi đổi enum/cột/index. Không sửa migration đã áp dụng, không đưa DDL trở lại CommandLineRunner. Test PostgreSQL kiểm tra enum CHECK theo entity thay cho cơ chế tự sửa `PaymentDataInitializer.ENUM_COLUMNS`. Seed dữ liệu mặc định vẫn nằm trong initializer, schema thì không.

Nguồn đối chiếu cấu hình: [Spring Boot database initialization](https://docs.spring.io/spring-boot/how-to/data-initialization.html), [Flyway baseline-on-migrate](https://documentation.red-gate.com/fd/flyway-baseline-on-migrate-setting-277578974.html).

## Kết quả Phase 0 — 2026-09-30

- PostgreSQL :55432: 4 test migration đạt (DB trống, fixture legacy, timezone guard/rollback, baseline tường minh), Flyway rerun/validate và Hibernate validate đạt.
- Test liên quan đạt: isolated guard (3), thời gian HTTP/JSON/validation (3), schedule service (2), publishing worker (4), Meta integration (9), account deletion (8), analytics aggregate (30). Frontend 8 test đạt; backend package và frontend production build đạt.
- Smoke HTTP trên BE :8092: đăng nhập local, timezone riêng user, tạo lịch `+07:00` trả UTC, đổi lịch, từ chối giờ quá khứ/thiếu offset với 400, hủy lịch; không tạo Post/dispatch. Script chạy từ repo root: `node backend/isolated/smoke.mjs`. Script dùng tài khoản admin seed của stack thử nghiệm, tạo fixture giả mới mỗi lần và giữ lịch đã hủy để kiểm tra.
- Lần chạy toàn bộ backend: 447 test, 14 failure, 0 error, 2 skipped (trước khi thêm test HTTP hồi quy). 8 failure ở AccountManagementTest và 5 ở BrandProfileTest dùng route auth cũ bị 401; 1 ở SubscriptionLifecycleTest dùng mốc cố định 2026-09-22 đã hết hạn so với đồng hồ hiện tại. Các test/service này không sửa trong Phase 0. Toàn bộ suite chưa xanh; log local tại `backend/target/phase0-full-test.log`.
- Chưa đối chiếu schema/dữ liệu production. Không chạy Supabase, Meta thật hoặc job tự đăng. D2/resolver, duyệt, hold_reason, chặn IG và wizard nối lịch còn ở các phase sau.
