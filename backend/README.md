# AIMA Backend

REST API cho **AIMA – AI Marketing Assistant**. Java 21 + Spring Boot, xác thực JWT (cookie HttpOnly)
+ Google OAuth2, PostgreSQL, Redis.

> Đọc kèm [`CLAUDE.md`](CLAUDE.md) để hiểu chi tiết kiến trúc, luồng xác thực, quy ước code và rules.
> Tài liệu sản phẩm tổng ở [`../CLAUDE.md`](../CLAUDE.md) và [`../README.md`](../README.md).

## Stack

Java 21 · Spring Boot 4 · Spring Security + JWT (Nimbus JOSE) · OAuth2 Client (Google) · Spring Data JPA / Hibernate ·
PostgreSQL · Redis · Spring Mail · MapStruct · Lombok · springdoc-openapi (Swagger)

## Yêu cầu

- **JDK 21** (`JAVA_HOME` phải trỏ JDK 21, nếu không sẽ lỗi `release version 21 not supported`).
- PostgreSQL + Redis: chạy bằng Docker (`docker-compose.yml`) hoặc dùng dịch vụ managed (Supabase / Upstash)
  qua biến môi trường.

## Cấu hình môi trường

Tạo `backend/.env` từ [`.env.example`](.env.example) rồi điền giá trị. `.env` đã được `.gitignore` —
**không commit secrets**.

| Nhóm | Biến |
|---|---|
| App | `APP_NAME`, `SERVER_PORT` (dev `8082`), `CONTEXT_PATH` (dev `/api/aima`), `APP_TIMEZONE` |
| Database | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` |
| pgAdmin (Docker) | `PGADMIN_EMAIL`, `PGADMIN_PASSWORD`, `PGADMIN_PORT` |
| JWT | `JWT_SIGNER_KEY`, `JWT_ACCESS_TOKEN_EXPIRATION` (3600s), `JWT_REFRESH_TOKEN_EXPIRATION` |
| OAuth2 / FE | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_CALLBACK_URL`, `FRONTEND_BASE_URL` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_SSL_ENABLED` |
| Email (OTP) | `MAIL_USERNAME`, `MAIL_PASSWORD` (SMTP Gmail) |
| Supabase Storage | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (⚠️ `service_role` — **chỉ backend**, không lộ ra FE), `SUPABASE_ANON_KEY` |

> Danh sách đầy đủ + giá trị mặc định: xem [`CLAUDE.md`](CLAUDE.md) §6 và `application.yml`.

## Chạy

```bash
docker compose up -d                 # PostgreSQL + pgAdmin + Redis (nếu chạy local)
./mvnw.cmd spring-boot:run           # Windows   |  ./mvnw spring-boot:run (macOS/Linux)
./mvnw.cmd package -DskipTests       # build JAR → target/*.jar
./mvnw.cmd test                      # chạy test
```

## Runtime URLs

Port/context-path lấy từ env (dev: `8082` + `/api/aima`):

```
API base:     http://localhost:8082/api/aima
Swagger UI:   http://localhost:8082/api/aima/swagger-ui.html
OpenAPI JSON: http://localhost:8082/api/aima/v3/api-docs
Health:       http://localhost:8082/api/aima/actuator/health
```

**Google Cloud Console — redirect URI cần đăng ký:** `{CONTEXT_PATH}/login/oauth2/code/google`

## Kết nối với Frontend

- API tuân theo envelope thống nhất: `{ "code", "message", "result" }` (API-01). `code` là số định danh
  **duy nhất** cho từng loại lỗi (định nghĩa trong `ErrorCode`) — FE có thể dựa vào `code` để phân biệt lỗi,
  không phụ thuộc vào `message`.
- Access/refresh token được trả qua **cookie HttpOnly** — FE không đọc token, chỉ gọi `GET /users/me`
  để biết danh tính.
- **Frontend gọi thẳng backend** bằng URL tuyệt đối lấy từ `VITE_API_BASE_URL` (xem `frontend/.env`),
  **không qua dev proxy**. CORS trong `SecurityConfig` đã cho phép `http://localhost:*` (+ `*.vercel.app`…)
  kèm credentials nên cookie hoạt động khi dev.
- Đổi host/port/context-path của API → cập nhật `VITE_API_BASE_URL` bên FE và thêm origin FE deploy vào
  CORS allow-list nếu chưa khớp.
- Cookie: dev `SameSite=Lax`, `Secure=false`. Khi FE/BE khác site (vd 2 subdomain khác nhau lúc deploy)
  cần `AUTH_COOKIE_SAME_SITE=None` + `AUTH_COOKIE_SECURE=true` (HTTPS).

## Tài liệu

| File | Nội dung |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Kiến trúc, cấu trúc package, luồng auth, quy ước code, rules |
| [`../docs/`](../docs/) | REQUIREMENTS / DATA_MODEL / WORKFLOWS / UI_API / GLOSSARY |
