# rule.md — Quy tắc làm giao diện (AIMA Frontend)

> Quy ước thiết kế & dựng UI cho FE AIMA. Mục tiêu: giữ giao diện **nhất quán** với hệ thống
> hiện có để sau này đọc lại vẫn hiểu ngữ cảnh. Đọc kèm [`CLAUDE.md`](CLAUDE.md) (kiến trúc) và
> [`README.md`](README.md) (chạy dự án). Quy tắc nghiệp vụ/scope: [`../CLAUDE.md`](../CLAUDE.md).

## 0. Nguyên tắc chung

1. **Bám theo cái đang có, đừng phát minh phong cách mới.** Trước khi thêm component/màu/animation,
   tìm mẫu tương tự trong `components/`, `pages/`, `index.css` rồi tái dùng.
2. **Surgical**: chỉ sửa đúng phần được yêu cầu, không "tiện tay" đổi layout/màu/format chỗ khác.
3. **Đúng scope nền tảng**: chỉ Facebook → Instagram → Threads. Không thêm UI cho TikTok/YouTube/LinkedIn
   (icon footer landing là ngoại lệ trang trí sẵn có — không dùng làm nền tảng đăng bài).
4. **Không sinh ảnh/video**: UI liên quan media chỉ hiển thị **media prompt** (text).

## 1. Hệ màu & theme

- **3 theme gradient** trong [`theme.ts`](src/theme.ts): `aurora` (mặc định), `sunset`, `ocean`.
  Theme đang chọn được bơm vào CSS var `--brand` (và `--soft`) ở [`App.tsx`](src/App.tsx).
- **Dùng `var(--brand)`** cho mọi nền/chữ gradient thương hiệu — đừng hardcode lại chuỗi gradient.
  Chữ gradient: thêm class `.gradtext`. Ví dụ nút chính: `background: var(--brand)`.
- **Màu nền tảng** lấy từ `PLATFORM_BG` (FB `#1877f2`, IG gradient, TH `#000`). Không tự bịa mã màu nền tảng.
- **Bảng màu nền/chữ cơ bản** (theo `index.css`):
  - Nền trang: `#f7f6fd`; nền card: `#fff`; viền nhạt: `#efeaf8` / `#ece7f6`.
  - Chữ chính: `#1b1730`; chữ phụ/muted: `#6b6680` / `#8a85a0`.
  - Tím nhấn: `#7c3aed` / `#6d28d9`; thành công: `#16a34a`.

## 2. Typography

- Font chữ: **'Be Vietnam Pro'** (body) + **'Plus Jakarta Sans'** (tiêu đề lớn) — đã import trong `index.css`.
  Không thêm font ngoài; nếu cần, thêm vào `@import` của `index.css`.
- Quy ước cỡ/độ đậm hay dùng: tiêu đề `fontWeight: 700–800`, nhãn nhỏ `12–13px` + `letter-spacing`,
  text phụ `14px`. Bám theo các trang hiện có.

## 3. Cách viết style (QUAN TRỌNG — dự án dùng kiểu hỗn hợp có chủ đích)

Thứ tự ưu tiên khi tạo UI mới:

1. **Tái dùng primitive** trong [`components/ui.tsx`](src/components/ui.tsx): `Card` / `cardStyle`,
   `Icon`, `GradIcon`, `Loader`, `PlatformTag`. Đừng dựng lại card/loader/chip nền tảng từ đầu.
2. **Inline `CSSProperties`** cho style theo từng phần tử (đây là kiểu chủ đạo của các `pages/`).
   Khai báo object style đặt tên (vd `btnPrimary`) rồi gắn vào `style={...}`.
3. **Class CSS dùng chung** trong `index.css` cho:
   - **Micro-interaction**: `.btn-grad`, `.btn-outline`, `.btn-soft` (nút), `.lift-card` (card nổi khi hover),
     `.link-underline` (gạch chân trượt), `.logo-hover`. Các class `:hover` này dùng `!important` để
     thắng inline-style — cứ gắn thêm class, không cần viết lại hover bằng JS.
   - **Animation**: `.view-pop` (vào trang), `.menu-pop` (dropdown), keyframes `floaty`, `aima-*`…
4. **Tailwind** có sẵn (`@tailwind` trong `index.css`) — dùng được cho layout nhanh, nhưng **đừng trộn
   lung tung**: trong một component hãy theo kiểu đang dùng ở component đó (đa số là inline + class).

> Quy tắc: nếu một hiệu ứng đã có class trong `index.css`, **dùng lại class** thay vì copy CSS hoặc
> làm bằng `onMouseEnter`. Nếu cần hiệu ứng mới dùng nhiều nơi → thêm class vào `index.css`.

## 4. Component & layout

- **Khung app đã đăng nhập**: [`AppShell`](src/components/AppShell.tsx) (sidebar + topbar) bọc mọi trang
  trong `AppLayout`. Trang mới chỉ render nội dung, không tự dựng lại sidebar/topbar.
- **Card** là đơn vị bố cục chính: bo góc `20`, viền `#efeaf8`, shadow nhẹ (xem `cardStyle`).
- **Icon**: dùng `Icon`/`GradIcon` (single-path SVG) hoặc `lucide-react`. Giữ `strokeWidth ~1.8`.
- **Loading**: dùng `<Loader />` (bouncing-ball). `fullScreen` để căn giữa viewport khi chờ auth/fetch.
- **Nút nổi chia sẻ** (`ShareButton`) là global, đặt ở `App.tsx` — không thêm bản sao ở trang khác.

## 5. Responsive

- Breakpoint qua hook [`useBreakpoint`](src/hooks/useBreakpoint.ts) khi cần đổi layout trong JS
  (vd `isMobile ? 'column' : 'row'`).
- Lưới responsive bằng class trong `index.css`: `.grid-split`, `.grid-split-wide`, `.grid-2`, `.grid-4`
  (tự về 1 cột ở mobile). Ưu tiên dùng các class này thay vì media query rời rạc.
- Mobile chặn tràn ngang ở `html,body { overflow-x: clip }` — đừng đổi thành `hidden` (làm hỏng `sticky`).

## 6. Animation & accessibility

- **Luôn tôn trọng `prefers-reduced-motion`**: mọi animation/transition trong `index.css` đã có nhánh
  `@media (prefers-reduced-motion: reduce)` tắt hiệu ứng. Thêm animation mới → thêm nhánh tắt tương ứng.
- **Focus**: giữ `:focus-visible` rõ ràng (outline/box-shadow) như các nút hiện có; đừng bỏ outline.
- Dùng `aria-hidden` cho icon trang trí (xem `PlatformTag`/logo SVG).

## 7. Nội dung, i18n & dữ liệu

- **Song ngữ**: chuỗi hiển thị lấy từ `t` (`useApp().t`, từ điển [`i18n.ts`](src/i18n.ts)) khi đã có key —
  không hardcode rải rác. Thêm chuỗi mới → thêm cả `vi` và `en`.
- **Dữ liệu**: trang demo dùng mock trong [`data.ts`](src/data.ts). Dữ liệu thật **luôn qua tầng `api/`**
  (Axios `client`), không `fetch` thẳng, không ghép URL — xem [`CLAUDE.md`](CLAUDE.md) §3.
- Xử lý lỗi API: hiển thị `ApiError.message`; rẽ nhánh theo `ApiError.code` khi cần (vd OTP sai).

## 8. Checklist trước khi xong một thay đổi UI

- [ ] Tái dùng primitive/class sẵn có, không nhân bản style.
- [ ] Màu/gradient qua `var(--brand)` & `PLATFORM_BG`, không hardcode.
- [ ] Có hover/focus nhất quán (dùng `.btn-*`, `.lift-card`, `:focus-visible`).
- [ ] Responsive ổn ở mobile (dùng `useBreakpoint` / `.grid-*`).
- [ ] Animation mới có nhánh `prefers-reduced-motion`.
- [ ] Chuỗi hiển thị qua `t` (vi + en).
- [ ] Không hardcode URL backend; gọi qua `client` + đường dẫn tương đối.
- [ ] `npm run build` (tsc) không lỗi type.
