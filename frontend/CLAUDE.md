# CLAUDE.md — AIMA Frontend

> Module frontend của **AIMA – AI Marketing Assistant**. File này giúp Claude Code / dev nắm nhanh
> kiến trúc, quy ước và phạm vi khi viết/sửa code FE. Đọc root [`../CLAUDE.md`](../CLAUDE.md) trước
> để hiểu scope sản phẩm, business rules (BR-xx) và state machine của post.
> Quy tắc làm **giao diện** chi tiết: [`rule.md`](rule.md). Hướng dẫn chạy: [`README.md`](README.md).

## 1. Tổng quan

| Field | Value |
|---|---|
| **Tên** | aima-frontend `0.1.0` |
| **Loại** | SPA React 18 + TypeScript |
| **Build** | Vite 8 (`tsc && vite build`) |
| **Dev server** | http://localhost:3000 (port cố định, `strictPort`) |
| **Style** | Tailwind CSS 3 + CSS thuần (`index.css`) + inline `CSSProperties` |
| **Router** | react-router-dom 6 |
| **State** | Zustand 5 + React Context |
| **HTTP** | Axios (instance dùng chung) |
| **Khác** | lucide-react (icon), anime.js (animation) |

## 2. Cấu trúc & vai trò file

```
src/
├── main.tsx              — entry: <BrowserRouter><AuthProvider><AppProvider><App/>
├── App.tsx               — toàn bộ <Routes>; AppLayout = ProtectedRoute + AppShell
├── index.css             — CSS toàn cục: font, .gradtext, .loader, biến --brand/--soft
├── theme.ts              — THEMES (3 gradient), PLATFORMS (FB/IG/TH), tagOf()
├── i18n.ts               — getDict(lang): từ điển vi/en
├── types.ts              — type/interface dùng chung (Route, ThemeKey, Platform…)
├── data.ts               — dữ liệu mock cho UI demo
├── api/
│   ├── apiClient.ts      — axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL }) + interceptor
│   ├── auth.ts           — register/login/logout/getProfile/OTP/completeProfile + GOOGLE_LOGIN_URL;
│   │                       changePasswordInit/Confirm, requestDeleteAccount/restoreAccount (dùng ở trang Hồ sơ).
│   │                       updateProfile nhận thêm avatarUrl (tuỳ chọn); uploadAvatar(file) → POST /files/avatar trả URL công khai.
│   │                       User có thêm status + deletionDate (banner chờ xóa) + avatarUrl. Nút Đăng xuất trong Hồ sơ chỉ hiện ở mobile/tablet.
│   ├── brandProfile.ts   — list/create/update/delete brand profile
│   ├── plans.ts          — gói dịch vụ từ DB: GET /plans/public (landing/pricing) + CRUD /admin/plans;
│   │                       map payload BE → shape UI (PricingPlan/ComparisonGroup). hooks/usePublicPlans
│   │                       cache 1 lần gọi/phiên, fallback config/plans.ts (hardcode cũ) khi API lỗi.
│   └── trendResearch.ts  — start/poll/list phiên Trend Research (async job, NFR-04);
│                           map sang shape UI ở src/trendsLive.ts — trang Trends dùng dữ liệu thật
│                           khi có phiên COMPLETED, mock trendsData.ts chỉ là fallback demo.
│                           "Research ngay" mở components/trends/ResearchStartModal (chọn hồ sơ
│                           thương hiệu + nền tảng, cảnh báo thiếu chiến lược ACTIVE)
├── auth/
│   ├── AuthContext.tsx   — user state, refreshUser() gọi /users/me, login/logout
│   ├── ProtectedRoute.tsx— chặn route nếu chưa đăng nhập
│   └── GuestRoute.tsx    — chặn route nếu đã đăng nhập (login/register)
├── store/
│   ├── useAppStore.ts    — Zustand: lang, theme, profile, brand, notif
│   └── useUiStore.ts     — trạng thái UI cục bộ
├── context/AppContext.tsx— useApp(): bọc store + điều hướng (go/route) + auth
├── components/           — AppShell, Sidebar, LandingHeader, UserMenu, ShareButton, ui.tsx,
│                           Modal (overlay dùng chung), ChangePasswordModal (đổi mật khẩu 3 bước),
│                           toast/ToastProvider (toast góc trên-phải: useToast().success/error/
│                           warning/info cho MỌI feedback thao tác nhất thời — không tự chế banner;
│                           KHÁC NotificationBell là hộp thư bền vững), …
├── hooks/                — useBreakpoint (responsive), useReveal (scroll reveal)
├── validations/          — logic kiểm tra dữ liệu dùng chung (1 nguồn, không lặp inline):
│                           password.ts (PASSWORD_RULE + độ mạnh), authValidation.ts
│                           (validEmail/otpValid/passwordsMatch), profileValidation.ts (phoneOk/validateStep1)
└── pages/                — 1 file / route: Landing, Auth, Dashboard, Create, Calendar,
                            Analytics, Trends, Brand, Profile, Settings, Admin,
                            ForgotPassword, CompleteProfile, GoogleCallback, BrandProfile
```

## 3. Cấu hình backend qua biến môi trường (QUAN TRỌNG)

**Không bao giờ hardcode địa chỉ backend.** Mọi URL backend đọc từ `import.meta.env.VITE_API_BASE_URL`.

- Biến sống trong `.env` (đã `.gitignore`); mẫu ở `.env.example`. Vite **chỉ** expose biến tiền tố `VITE_`.
- Type khai báo ở [`src/vite-env.d.ts`](src/vite-env.d.ts) (`ImportMetaEnv.VITE_API_BASE_URL`).
- Axios instance dùng chung [`src/api/apiClient.ts`](src/api/apiClient.ts) đặt `baseURL` = biến đó.
  **Mọi nơi gọi API dùng đường dẫn tương đối** (`client.get("/users")`), không ghép full URL.
- Điều hướng cả trang (Google login) ghép tuyệt đối: `` `${import.meta.env.VITE_API_BASE_URL}/...` ``.
- Đổi `.env` → **phải restart dev server**.
- `vite.config.ts` không còn proxy; FE gọi thẳng backend (backend đã bật CORS cho `localhost:*` + credentials).

## 4. Quy ước code

- **Gọi API:** luôn qua `client` trong `api/apiClient.ts`, không `fetch` trực tiếp, không tạo axios instance khác.
  Thêm endpoint mới → thêm hàm trong `api/*.ts` trả `data.result`, dùng type cho request/response.
- **Validation:** logic kiểm tra dữ liệu (email/OTP/mật khẩu/SĐT…) đặt ở `src/validations/`, import dùng lại;
  không viết lại regex/điều kiện inline trong component. Quy tắc mật khẩu ở `validations/password.ts` (đồng bộ
  `WEAK_PASSWORD` của backend: ≥8 ký tự gồm hoa, thường, số, ký tự đặc biệt).
- **Response envelope:** backend trả `{ code, message, result }` (API-01). Lỗi đã được interceptor bóc thành
  `ApiError` mang `.code` (vd 1072) — UI xử lý theo `code`, hiển thị `.message`.
- **Auth:** token nằm trong cookie HttpOnly (FE không đọc). Sau login/redirect, gọi `refreshUser()` →
  `GET /users/me`. Đừng tự lưu token vào localStorage.
- **State:** dữ liệu app dùng chung → `useAppStore` (Zustand); tiêu thụ qua `useApp()`. UI cục bộ → `useState`.
- **Điều hướng:** dùng `go(route)` từ `useApp()` hoặc `<Link>`/`navigate` của react-router. Route map ở `AppContext`.
- **i18n:** chuỗi hiển thị lấy từ `t` (`useApp().t`), không hardcode tiếng Việt/Anh rải rác khi đã có key.
- **TypeScript:** không `any` tùy tiện; type request/response API ở `api/*.ts`. Build chạy `tsc` nên lỗi type sẽ fail build.

## 5. Giao diện

Xem [`rule.md`](rule.md). Tóm tắt: theme bằng gradient (`--brand`), 3 nền tảng FB/IG/TH dùng
`PlatformTag`, primitive trong `components/ui.tsx` (`Card`, `Icon`, `Loader`…), responsive qua
`useBreakpoint`, không tự thêm màu/nền tảng ngoài scope.

## 6. Phạm vi (theo root CLAUDE.md)

1. Chỉ build Facebook → Instagram → Threads. Không thêm UI cho TikTok/YouTube/LinkedIn trừ khi được yêu cầu.
2. Không sinh ảnh/video — AI chỉ tạo **media prompt** (mô tả text).
3. Theo đúng post status state machine; không tự đặt status mới.
4. Mọi tác vụ AI/đăng bài là async ở backend — FE hiển thị trạng thái job, không chặn UI.

## 7. Lệnh

```bash
npm install      # cài deps
npm run dev      # dev http://localhost:3000
npm run build    # tsc + vite build → dist/
npm run preview  # xem bản build
```
