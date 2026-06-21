# AIMA Frontend

Single-page web app cho **AIMA – AI Marketing Assistant**. React 18 + TypeScript, build bằng
Vite, style bằng Tailwind + CSS thuần, gọi backend qua Axios.

> Đọc kèm: [`CLAUDE.md`](CLAUDE.md) (ngữ cảnh kiến trúc cho AI/dev) và
> [`rule.md`](rule.md) (quy tắc làm giao diện). Tài liệu sản phẩm tổng ở
> [`../CLAUDE.md`](../CLAUDE.md) và [`../README.md`](../README.md).

## Stack

TypeScript · React 18 · React Router DOM 6 · Zustand · Axios · Vite · Tailwind CSS · lucide-react · anime.js

## Chạy dự án

```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
npm run build     # tsc + vite build → dist/
npm run preview   # xem thử bản build
```

## Cấu hình môi trường (BẮT BUỘC)

Địa chỉ backend **không hardcode** trong code — đọc từ biến môi trường. Vite chỉ expose biến có
tiền tố `VITE_`.

1. Copy `.env.example` → `.env`.
2. Điền `VITE_API_BASE_URL` (gồm cả context-path của backend):

   ```env
   # Dev
   VITE_API_BASE_URL=http://localhost:8082/api/aima
   # Deploy: đổi sang URL backend trên Render
   ```

3. Đổi `.env` xong **phải restart `npm run dev`** (Vite chỉ đọc env lúc khởi động).

`.env` đã được `.gitignore` (không commit). `.env.example` là mẫu cho người khác.

### Cách dùng trong code

- Axios instance dùng chung: [`src/api/client.ts`](src/api/client.ts) đặt
  `baseURL: import.meta.env.VITE_API_BASE_URL`, `withCredentials: true`.
- Mọi module API gọi bằng **đường dẫn tương đối**: `client.get("/users/me")`,
  `client.post("/brand-profiles", input)` — không bao giờ ghép full URL.
- Điều hướng cả trang (vd đăng nhập Google) ghép từ env:
  `` `${import.meta.env.VITE_API_BASE_URL}/oauth2/authorization/google` `` (xem `src/api/auth.ts`).
- Không còn dev proxy trong `vite.config.ts`: FE gọi thẳng backend. Backend đã bật CORS cho
  `http://localhost:*` kèm credentials nên cookie HttpOnly vẫn chạy khi dev.

## Cấu trúc thư mục

```
frontend/
├── .env / .env.example      # VITE_API_BASE_URL
├── vite.config.ts           # Vite + plugin react, port 3000
├── tailwind.config.js
└── src/
    ├── main.tsx             # entry: Router + AuthProvider + AppProvider
    ├── App.tsx              # khai báo routes (public / guest / protected)
    ├── index.css            # CSS toàn cục, font, biến --brand
    ├── theme.ts             # THEMES (gradient), PLATFORMS, màu nền tảng
    ├── i18n.ts              # từ điển song ngữ vi/en
    ├── types.ts             # type dùng chung
    ├── api/                 # tầng gọi backend (Axios)
    │   ├── client.ts        # axios instance + baseURL từ env + interceptor lỗi
    │   ├── auth.ts          # đăng ký/đăng nhập/OTP/Google
    │   └── brandProfile.ts  # CRUD brand profile
    ├── auth/                # AuthContext, ProtectedRoute, GuestRoute
    ├── store/               # Zustand: useAppStore (lang/theme/profile…), useUiStore
    ├── context/AppContext   # hook useApp() bọc store + điều hướng
    ├── components/          # UI tái dùng (AppShell, Sidebar, ui.tsx, …)
    ├── hooks/               # useBreakpoint, useReveal
    └── pages/               # mỗi route 1 trang
```

## Kiến trúc nhanh

- **Routing** ([`App.tsx`](src/App.tsx)): public (`/`, `/login`…), `GuestRoute` (chỉ khách),
  `AppLayout` bọc `ProtectedRoute` + `AppShell` cho trang đã đăng nhập.
- **Auth** ([`auth/AuthContext.tsx`](src/auth/AuthContext.tsx)): token nằm trong cookie HttpOnly do
  backend set; FE không đọc token, luôn gọi `GET /users/me` để biết danh tính.
- **State**: [Zustand](src/store/useAppStore.ts) giữ lang/theme/profile/brand; `useApp()` là API công
  khai để component tiêu thụ.
- **API**: mọi response theo envelope `{ code, message, result }` (API-01). `client.ts` bóc lỗi thành
  `ApiError` mang `code` của backend.

## Phạm vi (MVP)

Chỉ Facebook → Instagram → Threads. Không sinh ảnh/video. Xem [`../CLAUDE.md`](../CLAUDE.md) cho
business rules đầy đủ.
