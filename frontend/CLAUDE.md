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
│   │                       Đăng ký 2 bước: register (gửi OTP, CHƯA tạo tài khoản) → verifyRegister (tạo + set cookie) / resendRegisterOtp;
│   │                       startGoogleAuth(origin) ghi nguồn vào sessionStorage, consumeGoogleLinkedFromRegister đọc cờ linked=1 (chỉ báo khi đi từ /register).
│   │                       changePasswordInit/Confirm, requestDeleteAccount/restoreAccount (dùng ở trang Hồ sơ).
│   │                       updateProfile nhận thêm avatarUrl (tuỳ chọn); uploadAvatar(file) → POST /files/avatar trả URL công khai.
│   │                       User có thêm status + deletionDate (banner chờ xóa) + avatarUrl. Nút Đăng xuất trong Hồ sơ chỉ hiện ở mobile/tablet.
│   ├── brandProfile.ts   — list/create/update/delete brand profile
│   ├── payments.ts       — mua gói & lịch sử thanh toán của user (payOS): getBilling/list/get/
│   │                       checkout/cancel/verify + applyMockOutcome (DEV-ONLY) + 3 helper nhớ
│   │                       paymentId ở sessionStorage cho trang /billing/return. PaymentStatus/
│   │                       PaymentGateway RE-EXPORT từ revenue.ts (một nguồn cho cùng enum BE).
│   │                       Trang: pages/app/{Billing,BillingCheckout,BillingReturn,BillingMock}.tsx +
│   │                       components/billing/*. MỌI nút chọn gói → /billing/checkout?plan=<MÃ>
│   │                       ("Xem lại đơn hàng": getQuote chỉ đọc; checkout(planId, method,
│   │                       expectedAmount) chỉ gọi từ nút "Thanh toán ngay"). FE KHÔNG tự tính tiền —
│   │                       hiển thị nguyên văn báo giá. Phương thức thanh toán: registry
│   │                       config/paymentMethods.ts (thêm phương thức = thêm một mục).
│   │                       Đếm ngược hạn thanh toán tính theo `serverTime`
│   │                       trong response (KHÔNG theo đồng hồ máy) — xem useServerCountdown.ts;
│   │                       về 0 thì GỌI LẠI API lấy trạng thái thật, không tự coi là đã huỷ.
│   ├── adminPayments.ts  — quản trị ĐƠN HÀNG (/admin/payments): summary 3 badge hàng đợi +
│   │                       list/detail/cancel/mark-paid (gói của MỘT user: api/admin.ts). Mọi hàm GHI bắt
│   │                       buộc `reason`. rawPayload CHỈ có ở endpoint chi tiết.
│   │                       UI: tab "Đơn hàng" (?tab=orders) của pages/admin/Revenue.tsx ("Doanh thu &
│   │                       Đơn hàng" — cùng sổ cái payments) = components/admin/revenue/OrdersTab +
│   │                       PaymentDetailModal. /admin/payments chỉ còn redirect sang tab đó.
│   ├── plans.ts          — gói dịch vụ từ DB: GET /plans/public (landing/pricing) + CRUD /admin/plans;
│   │                       map payload BE → shape UI (PricingPlan/ComparisonGroup). hooks/usePublicPlans
│   │                       cache 1 lần gọi/phiên, fallback config/plans.ts (hardcode cũ) khi API lỗi.
│   ├── landing.ts        — nội dung Landing từ DB: GET /landing/public + /admin/landing (lưu nháp → xuất bản);
│   │                       type schema các section (chữ song ngữ L10n) + helper `tr(text, lang)`.
│   │                       hooks/useLandingContent cache 1 lần gọi/phiên, fallback config/landingDefaults.ts
│   │                       (dựng từ chuỗi i18n) khi API lỗi. Admin: pages/admin/Landing.tsx +
│   │                       components/admin/landing/*; validate ở validations/landingValidation.ts.
│   ├── publishErrorCatalog.ts — NGUỒN DUY NHẤT câu chữ lỗi đăng bài (vi/en): theo mã chuẩn backend
│   │                       `PublishErrorCode` → tiêu đề / chuyện gì / vì sao / các bước + nhãn nhóm & hành động.
│   │                       Backend KHÔNG gửi message gốc cho user; thêm mã mới ở BE → thêm vào catalog
│   │                       (test tests/publishErrorCatalog.test.ts so đúng danh sách mã).
│   ├── failedPosts.ts    — trang "Bài lỗi & cần xử lý" (/me/failed-posts): danh sách theo vòng đời, chi tiết
│   │                       + timeline, thử lại / bỏ qua / hàng loạt, sự cố nền tảng. UI: pages/app/FailedPosts.tsx +
│   │                       components/failedPosts/* (gom nguyên nhân chung ở rootCause.ts). Demo failedPostsMock chỉ ở DEV.
│   │                       Admin (components/admin/posts/*): chi tiết có phản hồi gốc đã redact, thử lại thay user,
│   │                       hàng đợi "Chưa phân loại" + ánh xạ mã — dùng chung catalog, KHÔNG tự đoán lý do từ message.
│   ├── aiAssist.ts       — AI sửa bài vi phạm + kiểm tra chính sách (/me/ai-assist): job chạy nền, FE poll.
│   │                       components/aiAssist/{AiFixModal (diff textDiff.ts + sửa + áp dụng), PolicyCheckNotice
│   │                       (dưới mỗi nền tảng ở SchedulePlanner — chỉ cảnh báo)}. Effect gọi AI có ref chống gọi đôi
│   │                       (StrictMode) — mỗi lần bấm chỉ MỘT job (tốn token + lượt).
│   ├── notifications.ts  — thông báo: 21 loại + nhóm (NotificationCategory) + params/refType; lọc status/category, xoá, xoá đã đọc.
│   │                       Câu hiển thị KHÔNG lấy title/message (tiếng Việt dự phòng) mà dựng ở notifications/text.ts.
│   ├── notificationPreferences.ts — cài đặt thông báo: email lỗi đăng bài (opt-in, banner hỏi 1 lần ở /failed-posts —
│   │                       EmailOptInBanner) + kênh theo nhóm (ma trận Cài đặt → Thông báo: components/settings/
│   │                       NotificationChannelsCard), trang công khai /unsubscribe.
│   ├── trendResearch.ts  — start/poll/list/deleteTrends phiên Trend Research (async job, NFR-04);
│                           input có `strategyId` + `articleCount` (1–20) ngoài brand/platform.
│                           Trang Trends GỘP tối đa 3 phiên COMPLETED gần nhất MỖI nền tảng
│                           (trendsLive.ts: mergedLiveData khử trùng lặp theo tên + remap idea;
│                           liveTrendStats tính trên dữ liệu ĐANG hiển thị) — research lại BỔ SUNG
│                           chứ không ghi đè; mock trendsData.ts chỉ là fallback demo.
│                           Tab "Trend nổi bật": ghim trend (localStorage aima_pinned_trends, nổi
│                           lên đầu) + chọn nhiều trend để xóa (live → DELETE /trend-research/trends
│                           soft delete backend; ẩn ngay qua localStorage aima_deleted_trends).
│                           "Research ngay" mở components/trends/ResearchStartModal (chọn hồ sơ +
│                           chiến lược + NHIỀU nền tảng — page research LẦN LƯỢT vì BE chặn phiên
│                           song song mã 1912 — + số ý tưởng + bộ lọc nâng cao áp cho kết quả).
│                           Modal chi tiết: IdeaDetailModal (ý tưởng + ngày ghi nhận trend),
│                           SessionDetailModal (phiên thật fetch theo id / phiên mock hiện trend demo),
│                           ScheduleModal (lịch research tự động — lưu backend GET/PUT /trend-research/schedule
│                           qua src/trendsSchedule.ts; job chạy mỗi giờ theo lịch, chưa đặt = 02:00).
│                           "Lưu ý tưởng" lưu backend (PUT /trend-research/ideas/{id}/saved, cờ `saved`);
│                           danh sách localStorage cũ aima_saved_ideas được chuyển lên một lần.
│   ├── planLimits.ts     — giới hạn tính năng theo gói (BE V18): danh mục PLAN_LIMIT_FIELDS (một nguồn cho form admin
│                           "Giới hạn tính năng", thẻ "Mức sử dụng trong kỳ" ở /billing, câu báo lỗi), GET /users/me/plan-usage
│                           (hooks/usePlanUsage cache theo phiên). Lỗi 2205/2206: apiClient dựng câu theo ngôn ngữ
│                           (utils/planLimitText) + toast "Nâng cấp gói"; khối không có trong gói dùng components/PlanLockedCard.
│                           Kết nối: CONNECTABLE_PLATFORMS ở connections.ts (hiện chỉ FACEBOOK — IG/Threads "Sắp hỗ trợ").
│   └── search.ts         — ô tìm kiếm toàn cục: GET /search (nội dung/chiến lược/lịch đăng của chính user, khớp
│                           không dấu); mục nội dung map bằng `toContentListItem` như trang Tạo nội dung.
├── search/               — lõi ô tìm kiếm toàn cục (Command Palette, Ctrl/⌘+K) — module thuần, test ở
│                           tests/globalSearch.test.ts: normalize.ts (bỏ dấu, đ→d, bản đồ vị trí để tô sáng),
│                           match.ts (chấm điểm + vùng tô sáng), rank.ts (lọc role/khu vực + giới hạn mỗi nhóm),
│                           history.ts (8 mục đã chọn gần nhất, localStorage `aima.search.history.<userId>`),
│                           registry.ts (trang lấy từ config/appNav.ts + config/adminNav.ts, tab/khu vực trong
│                           trang, hành động nhanh + TỪ ĐỒNG NGHĨA vi/en). Thêm trang vào menu = tự tìm được;
│                           thêm khu vực = đặt `id` trên khối + một dòng `block(...)` trong registry.
├── analytics/            — GA4 cho web AIMA (ga4.ts + Ga4Tracker gắn ở App): bật khi có VITE_GA4_MEASUREMENT_ID; page_view theo
│                           pathname (KHÔNG query string), bỏ qua /admin, sự kiện sign_up/purchase không kèm dữ liệu cá nhân.
├── realtime/             — luồng SSE GET /realtime/stream (một kết nối / tab): sseParser.ts (parser thuần + backoff),
│                           realtimeClient.ts (fetch + ReadableStream — NGOẠI LỆ của quy tắc "chỉ gọi qua axios client", xem §4;
│                           401 → refreshSession, watchdog 45s, tab ẩn > 5 phút đóng), events.ts (kiểu sự kiện = hợp đồng với enum
│                           backend RealtimeEventType + subscribeRealtime/useRealtimeEvent), waitForJob.ts (chờ job qua job.updated,
│                           poll an toàn 15s, mất luồng → nhịp poll cũ), aiPreview.ts (gộp ai.delta/ai.reset). Gắn ở AppShell bằng
│                           components/RealtimeConnector; trạng thái ở store/useRealtimeStore. Test tests/{sseParser,realtimeClient,
│                           waitForJob,aiPreview}.test.ts.
├── notifications/        — hàm thuần (test tests/notificationText.test.ts): text.ts (câu theo ngôn ngữ từ type + params, khoá
│                           ntf_<TYPE>_title/_body[_<variant>]; lỗi đăng bài lấy catalog theo params.code), links.ts (deep link theo
│                           refType/refId), toastGate.ts (tối đa 3 toast / 10s). Chuông + trang /notifications dùng hooks/useNotificationFeed
│                           (danh sách cập nhật realtime) + hooks/useUnreadCountSync (badge, poll dự phòng sau 30s mất kết nối);
│                           toast realtime ở components/NotificationToaster.
├── auth/
│   ├── AuthContext.tsx   — user state, refreshUser() gọi /users/me, login/logout; đăng ký handler hết phiên (refresh hỏng → user = null)
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
├── config/appNav.ts      — NGUỒN DUY NHẤT menu khu người dùng (cùng mẫu adminNav.ts): Sidebar + ô tìm kiếm cùng đọc.
├── components/search/    — CommandPalette (tái dùng Modal `bare`/`placement="top"`/`fullScreen`; combobox ARIA,
│                           ↑↓ Enter Esc, Enter bị bỏ qua khi bộ gõ tiếng Việt đang ghép chữ), SearchTrigger (ô trên
│                           topbar giữ nguyên khung cũ; mobile là nút icon), HighlightText. Gắn ở AppShell cùng phím
│                           tắt Ctrl/⌘+K (bỏ qua khi đang có hộp thoại khác) — state `paletteOpen` ở useUiStore.
├── hooks/                — useBreakpoint (responsive; resize gộp theo rAF — không dội re-render
│                           liên tục khi kéo giãn cửa sổ), useReveal (scroll reveal),
│                           useSearchActions (thực thi đích của mục tĩnh), useDataSearch (debounce + huỷ request),
│                           useSearchSuggestions (gợi ý ngữ cảnh, cache 60s theo user),
│                           useSectionFocus (`?focus=<id>` → chờ ≤5s, cuộn + tô sáng, xoá tham số; gắn ở AppShell),
│                           useTabParam (tab trên `?tab=` — Xu hướng, Bài lỗi; Thương hiệu đọc `?tab/strategy/new` một lần)
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
  **Ngoại lệ duy nhất:** `realtime/realtimeClient.ts` dùng `fetch` cho luồng SSE (axios không đọc được stream trên trình duyệt;
  `EventSource` gốc không thấy HTTP status / không đặt được Last-Event-ID) — vẫn đọc `VITE_API_BASE_URL`, `credentials: 'include'`.
- **Hết phiên:** `client` gặp 401 → `refreshSession()` (POST /auth/refresh, single-flight + khoá Web Locks giữa các tab — refresh token
  XOAY VÒNG nên hai lời gọi song song làm văng phiên) rồi thử lại 1 lần; hỏng → `endSession()`. Đừng tự gọi /auth/refresh ở chỗ khác.
- **Realtime:** nghe sự kiện bằng `useRealtimeEvent(name, handler)`; màn hình cần tự làm mới khi dữ liệu đổi → `useRealtimeRefresh(['post.updated', 'ready'], refetch)`
  (debounce; `ready` chỉ kích hoạt khi NỐI LẠI). Chờ job nền → `waitForJob` (không viết vòng poll mới).
- **Validation:** logic kiểm tra dữ liệu (email/OTP/mật khẩu/SĐT…) đặt ở `src/validations/`, import dùng lại;
  không viết lại regex/điều kiện inline trong component. Quy tắc mật khẩu ở `validations/password.ts` (đồng bộ
  `WEAK_PASSWORD` của backend: ≥8 ký tự gồm hoa, thường, số, ký tự đặc biệt).
- **Response envelope:** backend trả `{ code, message, result }` (API-01). Lỗi đã được interceptor bóc thành
  `ApiError` mang `.code` (vd 1072) — UI xử lý theo `code`, hiển thị `.message`.
- **Auth:** token nằm trong cookie HttpOnly (FE không đọc). Sau login/redirect, gọi `refreshUser()` →
  `GET /users/me`. Đừng tự lưu token vào localStorage.
- **State:** dữ liệu app dùng chung → `useAppStore` (Zustand); tiêu thụ qua `useApp()`. UI cục bộ → `useState`.
- **Điều hướng:** dùng `go(route)` từ `useApp()` hoặc `<Link>`/`navigate` của react-router. Route map ở `AppContext`.
  `go(route, search)` nhận thêm query (vd `go('settings', '?tab=connections')`) — giữ quy tắc `profileOrigin` của sidebar.
- **Deep-link cho ô tìm kiếm:** tab mới của trang nên đọc `?tab=` (hooks/useTabParam); khối muốn tìm tới được thì đặt
  `id` (Card nhận prop `id`) + khai báo trong `search/registry.ts`. Dropdown chuông thông báo mở qua
  `useUiStore.setNotificationsOpen`.
- **i18n:** chuỗi hiển thị lấy từ `t` (`useApp().t`), không hardcode tiếng Việt/Anh rải rác khi đã có key.
- **TypeScript:** không `any` tùy tiện; type request/response API ở `api/*.ts`. Build chạy `tsc` nên lỗi type sẽ fail build.
- **Hiệu năng trang danh sách** (mẫu tham chiếu: trang Trends): component hiển thị thuần bọc
  `React.memo`; mọi props truyền xuống phải ổn định — mảng/derived data qua `useMemo`, handler qua
  `useCallback` (card trong danh sách nhận callback dạng `(id) => ...` dùng chung, KHÔNG tạo closure
  mới cho từng item); ô tìm kiếm lọc danh sách dùng `useDeferredValue` để gõ phím không giật.

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
