# Dark mode — tiến độ hoàn tất

> Cập nhật: 2026-10-05. Chưa commit gì (theo yêu cầu). Tham chiếu: bảng ánh xạ màu
> [`dark-mode-color-map.md`](dark-mode-color-map.md).

## 1. Trạng thái tóm tắt

**Đã hoàn tất các đợt còn lại**, gồm app, admin, Landing, Auth, Legal và Pricing.
Đã xử lý thêm phản hồi về logo/footer/CTA Landing và biểu đồ Tổng quan lỗi của FailedPosts.

- **Đợt 1 được người dùng duyệt ngày 2026-10-05**; đợt 2 hoàn tất cùng ngày, chưa commit.
- `npm test`: 22/22 qua; `npm run build`: thành công. Đã xem ảnh sáng/tối, mobile và tooltip.
- Ảnh mẫu gốc được nhắc ở phiên trước không có trong phiên này: đã đối chiếu token/bảng màu và
  baseline HEAD; người dùng đã duyệt kết quả hiện tại ngày 2026-10-05.
- Cờ `VITE_ENABLE_DARK_MODE` mặc định bật; lựa chọn ban đầu vẫn Sáng. Cờ `false` vẫn giữ mọi trang sáng
  và ẩn control. Chưa triển khai và chưa commit. Báo cáo hiện tại: [final/README.md](dark-mode-review/final/README.md).
- Các mục đợt 1/2 dưới đây giữ lại lịch sử kiểm tra; kết luận/cấu hình hiện tại nằm ở mục 3.6 và báo cáo cuối.

## 2. Quyết định đã chốt

| # | Nội dung |
|---|---|
| 1 | Phạm vi đã hoàn tất: app + admin, sau đó Landing/Auth/Legal/Pricing theo yêu cầu tiếp tục tới hết. |
| 2 | Lưu lựa chọn: chỉ localStorage (`aima-color-mode`). Đọc/ghi gom ở **một chỗ** (`colorModeStorage` trong `store/colorMode.ts`) để sau thêm đồng bộ backend. |
| 3 | Token: gộp có giới hạn — chỉ màu trung tính ΔE2000 < 3; không gộp màu thương hiệu/trạng thái. Bảng đã duyệt: `docs/dark-mode-color-map.md`. |
| 4 | Logo: tự tạo bản chữ trắng (repo không có SVG). |
| 5 | Mặc định "Sáng"; cờ `VITE_ENABLE_DARK_MODE` mặc định bật sau QA, cờ false vẫn ẩn nút. |
| + | Codemod chạy dry-run trước, có báo cáo. Hover đổi màu bằng JS → chuyển sang class CSS `:hover`. So sánh ảnh tự động trước/sau. **Không commit.** |

## 3. Đã làm

### 3.1 Hạ tầng (Bước 1)
- **`frontend/src/styles/tokens.css`** — thêm token `--c-*` cho cả hai chế độ:
  `:root` = giá trị sáng (đúng mã hex đang dùng), `:root.dark` = giá trị tối, bọc trong `@media screen`
  nên bản in/xuất PDF luôn sáng. Tách hẳn khỏi `data-theme` (bảng màu thương hiệu) → 3 bảng màu × 2 chế độ.
  Nhóm token: trung tính (surface, bg, border, thang chữ ink-200…ink-900), khung (shell, topbar),
  tone trạng thái (success/warning/danger/info/rose/orange/slate/gray + soft/tint), nhấn tím
  (accent-*, violet, promo-*), chart (grid/axis), hiệu ứng (shadow-card/pop/flyout, focus, scrollbar, skeleton…).
- **`frontend/src/styles/colors.ts`** (mới) — object `C` (`C.surface` = `'var(--c-surface)'`…) cho inline style
  + helper `alpha(color, opacity)` dùng `color-mix` (thay kiểu ghép hậu tố hex `${color}1f`).
- **`frontend/src/store/colorMode.ts`** (mới) — type `ColorMode`, cờ `DARK_MODE_ENABLED`, danh sách route
  hỗ trợ tối (`DARK_CAPABLE_PREFIXES`), `resolveDark()`, `colorModeStorage`, `applyDarkClass()`.
- **`frontend/src/store/useAppStore.ts`** — thêm `colorMode` + `setColorMode`.
- **`frontend/src/hooks/useColorModeSync.ts`** (mới, gọi trong `App.tsx`) — gắn/gỡ class `dark` trên `<html>`
  theo lựa chọn + hệ điều hành (`matchMedia`) + route.
- **`frontend/src/hooks/useIsDark.ts`** (mới) — theo dõi class `dark` (dùng cho `src` logo).
- **`frontend/index.html`** — script chống nháy màu: áp class `dark` trước paint (đọc cờ qua `%VITE_ENABLE_DARK_MODE%`).
- **`frontend/src/components/ColorModeToggle.tsx`** (mới) — nút Sáng / Tối / Theo hệ thống ở topbar (cạnh
  "Tiếng Việt"), tự ẩn khi cờ tắt. Chuỗi i18n `cmLabel/cmLight/cmDark/cmSystem` (vi + en) trong `i18n.ts`.
- **`frontend/tailwind.config.js`** — `darkMode: 'class'`.
- **`frontend/src/vite-env.d.ts`**, **`frontend/.env.example`** — khai báo `VITE_ENABLE_DARK_MODE`.
- **`frontend/tests/colorMode.test.ts`** (mới) — kiểm tra danh sách route trong `index.html` khớp TS,
  logic `resolveDark` (mode/hệ thống/route/cờ).
- **Logo tối**: `frontend/public/aima-h-dark.png`, `aima-v-dark.png` — chữ AIMA trắng; ảnh gốc có viền
  matte trắng (alpha nhị phân) nên đã tách ngược thành alpha thật → viền mượt, không quầng sáng trên nền tối.
  Đã soi phóng to 6× trên nền navy. Sidebar + topbar mobile đổi `src` theo `useIsDark()`.

### 3.2 CSS toàn cục (Bước 2) — `frontend/src/index.css`
- body (chữ/nền), focus ring, mọi scrollbar (`::-webkit-scrollbar`, `.custom-scrollbar`, `.sb-scroll`,
  `.scrollbar-thumb-slate-200`), loader, share menu, `.btn-outline/.btn-soft:hover`, `.lift-card/.strategy-card:hover`,
  `.link-underline:hover`, skeleton (`.sk`, `.skeleton`), `.toast-close:hover`, `.row-hover` → `var(--c-*)`.
- `.ambient-surface`: chế độ tối dùng nền navy phẳng, tắt lớp tint ambient.
- Class hover mới (thay state `onMouseEnter`): `.menu-item` (UserMenu), `.ntf-row` (NotificationBell),
  `.flyout-item` (flyout sidebar, gồm `:focus` cho bàn phím).
- `frontend/src/components/ui.tsx`: `cardStyle` (nền/viền/shadow token — tối không shadow), `Loader`,
  `PlatformTag` thêm viền mảnh chỉ hiện ở chế độ tối (chip Threads nền đen).

### 3.3 Token dùng chung
- `statusTokens.ts` (`TONE_COLORS`, `STATUS_COLORS`, `STATUS_NEUTRAL`, `STATUS_PENDING`) → token. Ảnh hưởng
  mọi badge trạng thái toàn app.
- Đã sửa 3 chỗ ghép hậu tố hex vào màu token (sẽ hỏng với `var()`): `calendar/ScheduleDetailModal.tsx`,
  `calendar/ScheduleDetailView.tsx`, `pages/Settings.tsx` → `alpha()`.
- `dashboard/dashboardTokens.ts` (`GRID_LINE`, `AXIS_TEXT`, `STAT_TONES`), `notificationMeta.ts` (`TYPE_META`) → token.

### 3.4 Khung app + Dashboard
- Codemod (dry-run → áp dụng) trên 20 file: **150 chỗ thay**, 7 chỗ đánh dấu sửa tay, 18 chỗ giữ trắng
  (chữ/icon trên nền màu), 68 màu ngoài bảng → đã sửa tay phần thuộc đợt này.
- Sửa tay: `AppShell.tsx` (nền topbar, logo mobile, gắn nút chuyển), `Sidebar.tsx` (nền shell, nút Quản trị,
  thẻ token AI, thẻ nâng cấp, nút thu gọn, logo), `SidebarGroupFlyout.tsx`, `UserMenu.tsx`, `NotificationBell.tsx`
  (shadow/header menu, badge role/plan bằng `alpha()`, hover → class), `pages/app/Dashboard.tsx` và
  `components/dashboard/*` (ActivityAllModal, ActivityList, ActivityTimeline, ContentTypeDonut,
  DashboardSkeleton, DemoBadge, PerformanceChart, PlatformPanel, SetupChecklist, StatCard, TopTopics).
- Nút "Tạo nội dung mới" trên banner: **giữ nền trắng cố định** ở cả hai chế độ (codemod đã đổi nhầm, đã trả lại).

### 3.5 Đợt 2 — component dùng chung & Giao diện (2026-10-05)
- Codemod theo bảng màu đã duyệt: dry-run trước rồi áp dụng **60 chỗ**, 10 chỗ cần sửa tay,
  7 chỗ giữ trắng trên nền màu, 56 mã ngoài bảng đã rà. Báo cáo lưu ở
  `docs/dark-mode-review/batch2-codemod-{dry,apply}.md`.
- Modal/Drawer: token nền, chữ, overlay và shadow; giữ nguyên focus trap, Escape, backdrop,
  scroll lock/restore và biến thể docked. ConfirmModal giữ màu fill cảnh báo/xóa và chữ trắng.
- DatePicker: token trigger/panel, disabled/today/selected, lỗi nhập; hover sang CSS, giữ min/max/chọn/xóa ngày.
- ToastProvider: nền/viền/shadow/title/message/close dùng token; giữ gradient trạng thái, timer và pause/resume.
- Onboarding + đổi mật khẩu: token các bước, input, lỗi, OTP, checklist; icon và hover suggestion hỗ trợ tối.
  PasswordStrengthBar dùng tone theo mức yếu/vừa/mạnh; màu fill icon có dấu check giữ cố định để hợp chữ trắng.
- Settings chỉ migrate tab Giao diện + thanh tab. Selector radio native vi/en dùng cùng Zustand/localStorage
  với topbar, có Arrow keys và chế độ hệ thống; ẩn sau DARK_MODE_ENABLED. Tab còn lại chờ đợt migrate trang.
- Thêm token cho các màu ngoài bảng, giữ chính xác màu sáng; không gộp màu thương hiệu/trạng thái.
- **QA cuối:** 22/22 test, build đạt; mở rộng test tương phản thành **50 cặp** ≥4,5:1.
  Chrome fixture ở 1440/390px: modal/drawer/focus/Escape/backdrop, date hover/min-max/select/clear,
  5 loại toast/đóng, đổi mật khẩu 3 bước + lỗi, onboarding, radio/OS/bàn phím đạt; không lỗi JavaScript.
  POST đổi mật khẩu bị chặn bằng fixture, không đổi tài khoản thật hay gửi email.
- **So 18 ảnh sáng với HEAD e0562ed:** 0 pixel ΔE2000 >3; max **2,343140**. Selector mới ẩn khi so ảnh
  vì baseline chưa có; screenshot so ảnh không hover. Hàm so màu kiểm tra kết quả hữu hạn.
- Trang Settings thật: đồng bộ hai chiều với topbar, localStorage/reload, print sáng đạt.
  Production: Dashboard + Settings vẫn sáng, ẩn cả hai control khi cờ tắt dù lưu lựa chọn tối.
  Phát hiện .env local đang bật trong phiên này, đã đưa về `VITE_ENABLE_DARK_MODE=false` và build lại.
- Ảnh/kết quả: `docs/dark-mode-review/batch2/`; công cụ QA mới và hướng dẫn ở
  `frontend/scripts/dark-mode/README.md`. Entry SharedPreview.tsx chỉ do runner QA dùng, không nằm trong app.
- Các tab Settings dài bị cắt trong harness 390px cũng có ở baseline; để xử lý cùng đợt migrate Settings toàn trang.

### 3.6 Các đợt còn lại và phản hồi giao diện (2026-10-05)

- App/admin: migrate Create/Wizard, Calendar/Schedule, Analytics, Trends, Brand, FailedPosts,
  Settings/Profile/Billing và toàn bộ cụm Admin. Codemod neutral: 2.177 thay thế; các màu ngoài bảng
  dùng alias giữ màu sáng chính xác. Báo cáo dry-run/apply ở `dark-mode-review/reports/`.
- Chart grid/axis/Threads dùng token; status dùng TONE_COLORS; alpha không ghép đuôi hex vào var().
  25 cặp hover chỉ đổi style chuyển sang CSS; hover có hành vi giữ nguyên.
- Public: mở dark-capable routes và selector Landing/Auth; màu nền/chữ/viền dùng token.
  Artwork AimaHero/AimaScene, logo nền tảng và fill thương hiệu giữ nguyên.
- Landing: header/footer dark dùng `/aima-v-dark.png`; footer và CTA cuối dùng gradient tối dịu,
  chữ CTA có token riêng. Print đổi logo và palette về sáng.
- FailedPosts: bỏ circle trắng ở tâm donut; tăng rõ số tổng, chú giải có nền, mã lỗi có nền/viền token.
  Tổng hợp vẫn theo danh sách đã lọc; không đổi cách phân loại hay xử lý lỗi.
- Settings mobile: thanh tab cuộn ngang, không cắt nhãn; logo/header mobile không bị co méo.
- Phản hồi tiếp: nút ngôn ngữ Login/Register/ForgotPassword dịch trái 36px khi cờ bật trên desktop;
  60 kiểm tra ngôn ngữ/mode/viewport đạt. Card cột phải của chi tiết nội dung và wizard dùng nền/viền
  của panel AI thương hiệu; 20 trạng thái sáng/tối desktop/mobile đạt.
- QA: 168 trường hợp trang, 38 trạng thái tương tác, 12 tổ hợp Landing, 16 tổ hợp FailedPosts;
  không lỗi JavaScript. Cờ production bật/tắt kiểm tra trên 7 route mỗi bản; switch/OS/reload/keyboard/print đạt.
  `npm test` 22/22, `npm run build` đạt. Kiểm tra mọi tham chiếu token có khai báo.
- So sáng trước phản hồi thiết kế panel: 41/42 ảnh không pixel ΔE2000 >3; ảnh Wizard còn 160 pixel
  ở hai icon do dịch theo trục y 0,46875px; màu/kích thước giống baseline, có báo cáo geometry.
  Panel FailedPosts được thay đổi bố cục nhẹ theo yêu cầu mới, ghi nhận riêng thay vì coi là sai lệch màu.
- Chỉ kiểm tra frontend với API fixture; không thay dữ liệu backend, không gửi email/đăng bài/thanh toán thật.
  Cờ local, `.env.example` và fallback Vite đã bật; lựa chọn mặc định Sáng được giữ. **Không commit.**

## 4. Kết quả kiểm tra đợt 1 (lịch sử)

- **Kiểm tra mới ngày 2026-10-04:** `npm test` 22/22, `npm run build` thành công (gồm TypeScript).
- Đã tăng giá trị tối của `text-faint`, `ink-350`, `text-muted`, `chart-axis`; test kiểm tra 35 cặp
  chữ/nền trung tính đạt ≥4,5:1. Không tuyên bố toàn app đạt WCAG; các trang chưa migrate vẫn đang chờ.
- Đã sửa menu chuyển chế độ bị cắt ở 320px; bổ sung ArrowUp/Down, Home/End, Tab, Escape và trả focus.
- `vite.config.ts` cấp mặc định chuỗi `false` cho cờ khi thiếu env: TS và script trước paint nhận cùng
  giá trị, build không còn cảnh báo placeholder env chưa khai báo. Không bật cờ trong `.env`.
- Chrome headless + API fixture: chuyển 3 chế độ, localStorage/reload, đổi OS khi ở chế độ hệ thống,
  bàn phím, topbar/menu ở 1440/1280/1024/800/390/320px, public/auth luôn sáng, print luôn sáng: đạt.
  SVG nhãn trục thực sự nhận `var(--c-chart-axis)` → `rgb(140,150,176)`; lưới/icon/tooltip đã xem trên ảnh.
  Không có lỗi JavaScript. Bản production cờ không đặt vẫn sáng và ẩn nút dù lưu lựa chọn tối.
- Script trước paint được chạy riêng trong VM với 120 tổ hợp cờ/route/lựa chọn/OS, thêm storage bị chặn.
- **So ảnh mới Dashboard với HEAD `e0562ed`:** 1440×1285, cùng fixture và đồng hồ, ẩn nút chuyển khi
  so sánh. 317 pixel ΔE76 >3: topbar 30, dòng so sánh trong thẻ số liệu 256, icon hoạt động trống 31.
  **0 pixel CIEDE2000 >3**, cao nhất 2,5039 (`#a39bbf` → `#9b94b5`, trong bảng màu đã gộp).
  27,915% pixel khác chính xác do màu nền/viền được gộp. Không cần sửa bản sáng.
- Ảnh chụp phải chờ font, tắt animation/transition, cố định text rasterization (`--disable-lcd-text`,
  `--font-render-hinting=none`) để tránh nhiễu ở chữ đậm. Công cụ kiểm tra đã lưu trong repo,
  xem [`frontend/scripts/dark-mode/README.md`](../frontend/scripts/dark-mode/README.md).
- Ảnh và báo cáo: [`dark-mode-review/README.md`](dark-mode-review/README.md),
  [`light-comparison.json`](dark-mode-review/light-comparison.json). Các ảnh dùng dữ liệu kiểm tra,
  chưa phải test tích hợp backend; backend/DB không cần chạy.

So sánh 27 trang từ phiên trước (không chạy lại toàn bộ ở phiên này):
  - Nhiễu sẵn có của baseline: admin ~0,01%, admin-system ~0,05%, landing/pricing ~2–3% khác chính xác (dải logo chạy).
  - Hiện tại: khác **nhìn thấy được** (ΔE76 > 3) ≈ **0,002%** mỗi trang app (≈ 30 px), dashboard 0,017% (≈ 300 px);
    admin/admin-system/profile ≈ 0,05% (trong mức nhiễu). Khác **chính xác** 13–72% do nền `.ambient-surface`
    và các màu gộp ΔE < 3 theo bảng — đúng dự kiến.
  - Phần lệch Dashboard đã được xác minh lại như trên; không phải lỗi bố cục.

## 5. Checklist đã hoàn tất

### Để xong đợt 1 (rồi dừng cho bạn duyệt Dashboard)
- [x] Xác minh phần lệch sáng bằng ΔE2000, không cần sửa — done 2026-10-04.
- [x] Xem ảnh tối, chỉnh chữ phụ/nhãn chart theo tương phản; đối chiếu bảng token — done 2026-10-04.
- [x] Kiểm tra `var()` trong SVG tối, lưới/nhãn trục/icon/tooltip — done 2026-10-04.
- [x] Nút chuyển/OS/reload/script trước paint/public/auth/mobile — done 2026-10-04.
- [x] Tương phản AA của các cặp chữ/nền tối trung tính chính — done 2026-10-04.
- [x] `npm run build` + `npm test` — done 2026-10-04.
- [x] Lưu ảnh Dashboard sáng + tối để duyệt — done 2026-10-04.
- [x] Người dùng duyệt Dashboard và cho tiếp tục đợt sau — done 2026-10-05.

### Sau khi Dashboard được duyệt
- [x] Bước 4 — Modal, Drawer, ConfirmModal, DatePicker, ToastProvider, OnboardingModal, ChangePasswordModal
      (+ PasswordStrengthBar) — done 2026-10-05. ShareButton đã rà: chỉ hiện ở landing khoá sáng, không đổi.
- [x] Thêm lựa chọn Sáng/Tối/Theo hệ thống vào Cài đặt › Giao diện — done 2026-10-05.
- [x] Bước 5 — từng trang (codemod dry-run → báo cáo → áp dụng → sửa tay → so ảnh): Create/CreateWizard →
      Calendar/Schedule → Analytics → Trends → Brand → FailedPosts → Settings/Profile/Billing (+ BillingCheckout) → Admin — done 2026-10-05.
- [x] Tiếp tục chuyển JS hover sang CSS ở các trang còn lại; đợt 2 đã chuyển DatePicker và PasswordStrengthBar
      (7 handler `onMouseEnter` đổi màu, cùng `onMouseLeave`). Hover pause/resume của toast giữ nguyên hành vi — done 2026-10-05.
- [x] Token hoá `analytics/analyticsTokens.ts`, `admin/revenue/chartTokens.ts`, `calendar/statusMeta.ts`,
      `create/statusMeta.ts` — done 2026-10-05.
- [x] `analytics/PostDetailPanel.tsx`: ghép hậu tố hex → `alpha()` — done 2026-10-05.
- [x] Shadow tím ở `DashboardSkeleton`/`PerformanceChart` dùng alias; glow/fill thương hiệu giữ cố định
      theo quy tắc, trạng thái dùng token — done 2026-10-05.
- [x] Bật `VITE_ENABLE_DARK_MODE`; giữ lựa chọn mặc định "Sáng", có tùy chọn "Theo hệ thống" — done 2026-10-05.
- [x] Landing, Auth, Legal, Pricing (gỡ khoá sáng — `DARK_CAPABLE_PREFIXES` + `index.html`) — done 2026-10-05.
- [x] Thêm tiến độ đợt 1 và phần còn lại vào `docs/PLAN.md` — done 2026-10-04.
- [x] Hướng dẫn token cho code mới trong `frontend/rule.md` — done 2026-10-04.

## 6. Môi trường đang chạy & dọn dẹp

- Ghi nhận của phiên trước (không còn listener ở 3 port này khi bắt đầu phiên mới): mock dịch vụ ngoài `127.0.0.1:58080`, backend cô lập `:8092`
  (`backend/isolated`, scheduler tắt, DB docker `aima-scheduling-isolated-postgres-1`), frontend `:3100`
  (bản hiện tại, cờ dark mode **bật**).
- Docker Desktop đã được bật (kéo theo các container `restart: always` như `aima_postgres`, `uml_*`).
- Git worktree baseline tại scratchpad `head-wt` (HEAD e0562ed), `frontend/node_modules` là **junction** trỏ về
  `D:\SU26\EXE\frontend\node_modules`. Checkout và junction được giữ nguyên sau QA.
- Công cụ cũ vẫn nằm trong scratchpad phiên trước: `shoot.mjs` (chụp 27 trang),
  `compare.mjs` (so ΔE), `codemod.mjs` + `mapping.json` (codemod theo bảng), `gen-logo.js` (tạo logo tối),
  báo cáo codemod `reports/batch1-*.md`. Công cụ mới `verify.mjs`/`compare-light.mjs` + cách cài dependency
  riêng đã lưu ở `frontend/scripts/dark-mode/`; ảnh lưu ở `docs/dark-mode-review/`.
- Phiên tiếp tục chỉ chạy frontend/preview để kiểm tra với API fixture, không bật backend/DB/Docker.
  Các tiến trình frontend `:3100`, baseline `:3101`, preview `:3102` của đợt 1/2 đã được dừng sau QA.
- Kết thúc đợt cuối: đã dừng 4 server QA `:3100/:3101/:3102/:3103`, xoá log build và script sửa một lần.
  Giữ bản build cờ true trong `frontend/dist`, công cụ kiểm tra, ảnh/báo cáo, checkout baseline và junction.
  Không dừng frontend người dùng ở `:3000`. Thư mục build QA cờ false `frontend/.dark-mode-flagoff-dist`
  còn giữ lại vì thao tác xoá bị hệ thống phê duyệt tự động chặn (`blocked by policy`).
- Theo lựa chọn mới của người dùng, `npx impeccable update` đã nâng skill lên v4.5.0 ở `.agents` và
  `.claude`, kèm engine/hooks/agent config do trình cập nhật tạo. Các thay đổi này cũng chưa commit.
- Ghi chú nhỏ: 3 file (`SidebarGroupFlyout.tsx`, `statusTokens.ts`, `tailwind.config.js`) đang là LF trong working
  copy; git sẽ tự chuyển CRLF (autocrlf) — không ảnh hưởng nội dung.

## 7. Dùng token cho code mới (tóm tắt)

- Inline style: `import { C, alpha } from '../styles/colors'` → `background: C.surface`, `color: C.textMuted`,
  ``border: `1px solid ${C.border}` ``. Độ trong suốt: `alpha(C.primary, 0.1)` — **không** ghép `${color}1a`.
- CSS: `var(--c-surface)`… Hover đổi màu viết bằng class `:hover` trong `index.css`, không `onMouseEnter`.
- Badge/chip trạng thái: lấy từ `TONE_COLORS` / `STATUS_COLORS` (`statusTokens.ts`).
- Thêm token: khai báo ở **cả** `:root` và `:root.dark` trong `tokens.css`, rồi thêm vào `C` trong `colors.ts`.
- Chữ/icon trên nền gradient thương hiệu dùng `C.onBrand` / `var(--c-on-brand)`:
  Đại dương trắng, palette pastel tím đậm. Nền màu nền tảng/trạng thái vẫn dùng foreground riêng.

## 8. Thay bảng màu thương hiệu (2026-10-05)

- Theo lựa chọn được duyệt: Aurora → **Tử tinh** (`#6D28D9 → #7C3AED → #9333EA`),
  Hoàng hôn → **Phong lan** (`#DB2777 → #C026D3 → #9333EA`); Đại dương giữ nguyên.
- Mẫu màu trong Cài đặt dùng đúng gradient mới; tên tiếng Anh Amethyst/Orchid.
  Nền ambient có tint dịu riêng; không đổi token nền/chữ sáng/tối.
- Giữ key `aurora`/`sunset` để lựa chọn đã lưu trong localStorage tiếp tục áp dụng.
- Chrome/API fixture: 12 tổ hợp 3 palette × 2 mode × 2 viewport, tên vi/en, đổi màu,
  lưu/reload đạt; không lỗi JavaScript. 6 màu mới đạt tương phản chữ trắng ≥4,5:1.
  `npm test` 22/22 và `npm run build` đạt. Không commit.
- Ảnh và báo cáo: [brand-palettes/README.md](dark-mode-review/brand-palettes/README.md).

### Điều chỉnh pastel theo phản hồi (2026-10-05)

- Thay Tử tinh → **Tím sương** (`#B7A6DA → #C6B6E6 → #D5C6EF`),
  Phong lan → **Hồng sương** (`#DFA9C0 → #D6AFD5 → #C9B8E3`); giữ nguyên Đại dương và key đã lưu.
- Đồng bộ chữ/icon trên nút, badge, avatar và mục đang chọn bằng `C.onBrand`;
  hai palette mới dùng `#35274D`, tương phản với 6 chặng gradient **6,12–8,49:1**.
  Gradient chữ dùng tông đậm khi sáng, pastel khi tối.
- Settings: 12 tổ hợp palette/mode/viewport, vi/en và reload đạt; báo cáo hiện tại
  [pastel/results.json](dark-mode-review/brand-palettes/pastel/results.json).
- 8 route đại diện × 2 palette × 2 mode × 2 viewport = **64 trường hợp** đạt;
  [surface-results.json](dark-mode-review/brand-palettes/pastel/surface-results.json).
  `npm test` 22/22, production build và kiểm tra 377 token đạt. Không commit.

## 9. Vị trí thông báo sau đăng nhập (2026-10-05)

- Toast góc phải nằm dưới header **16px**, top **86px desktop / 78px mobile**.
  `--app-header-height` dùng chung cho AppShell và `.toast-stack`; CSS `body:has(.app-topbar)`
  cập nhật ngay khi header xuất hiện, kể cả thông báo đang tồn tại từ login.
- Chrome/API fixture: 6 tổ hợp 1440/760/390px × sáng/tối đạt: login thành công,
  các loại toast xếp chồng, cuộn, resize qua breakpoint, app/admin; guest không có AppShell dùng top 16px.
  Không lỗi JavaScript; 22/22 test, production build đạt. Không commit.
- [Ảnh và số đo](dark-mode-review/toast-offset/README.md).
