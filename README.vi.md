# AIMA — Quản lý Mạng xã hội bằng AI

AIMA tự động hóa việc tạo nội dung, lên lịch đăng và phân tích mạng xã hội thông qua hệ thống AI Agent phối hợp với nền tảng web full-stack.

> English version: [README.md](README.md)

---

## Cấu trúc Repository

```
repo/
├── frontend/          # Ứng dụng web React + TypeScript
├── backend/           # REST API Java 21 + Spring Boot
├── ai/                # Backend AI Agent Python 3.14
└── docs/              # Tài liệu dự án
```

---

## Các Service

### Frontend (`frontend/`)
Ứng dụng SPA React 18 xây dựng bằng TypeScript, Tailwind CSS và React Router. Giao tiếp với backend thông qua RESTful API qua Axios.

**Công nghệ:** TypeScript · React · Tailwind CSS · React Router DOM · Axios · Vite

```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
npm run build     # build production → dist/
```

---

### Backend (`backend/`)
REST API Spring Boot 3 xử lý business logic, xác thực, lên lịch đăng và thao tác cơ sở dữ liệu.

**Công nghệ:** Java 21 · Spring Boot · Spring Security + JWT · OAuth2 · PostgreSQL · Spring Data JPA · Hibernate · Lombok · MapStruct · Validation · Email Service

```bash
cd backend
./mvnw spring-boot:run    # http://localhost:8080
./mvnw package            # build → target/*.jar
```

Cấu hình biến môi trường trong `backend/src/main/resources/application.yml`:

| Biến | Mô tả |
|---|---|
| `DB_USERNAME` / `DB_PASSWORD` | Thông tin đăng nhập PostgreSQL |
| `JWT_SECRET` | Khóa ký JWT |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth2 Google |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | Thông tin SMTP |

---

### AI Backend (`ai/`)
Hệ thống AI Agent Python thu thập dữ liệu từ các nền tảng mạng xã hội, phân tích xu hướng và tạo nội dung bằng LangChain và Antigravity SDK.

**Công nghệ:** Python 3.14 · uv · LangChain · Antigravity SDK · Requests

```bash
cd ai
uv python install 3.14
uv sync
uv run main.py
```

Sao chép `ai/.env.example` thành `ai/.env` và điền thông tin:

| Biến | Mô tả |
|---|---|
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Token Meta Graph API |
| `FACEBOOK_PAGE_ID` | ID Fanpage Facebook |
| `TIKTOK_ACCESS_TOKEN` | Token TikTok API |
| `INSTAGRAM_ACCESS_TOKEN` | Token Instagram API |

---

## Tài liệu

| File | Mô tả |
|---|---|
| [`docs/Technical.md`](docs/Technical.md) | Chi tiết công nghệ sử dụng |
| [`docs/Business_Analysis.md`](docs/Business_Analysis.md) | Phân tích nghiệp vụ và yêu cầu |
| [`docs/Implementation_Strategy.md`](docs/Implementation_Strategy.md) | Lộ trình triển khai |
