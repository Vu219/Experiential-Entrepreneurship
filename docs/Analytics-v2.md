# NHIỆM VỤ
Tái cấu trúc trang **Phân tích (Analytics)** phía người dùng của hệ thống AIMA:
sắp xếp lại bố cục, bổ sung block mới, làm lại thanh lọc, và responsive đầy đủ.
Bắt buộc đồng bộ với codebase hiện có — KHÔNG tự tạo convention mới.

## 0. KHẢO SÁT TRƯỚC (chưa viết code)
Báo cáo lại cho tôi trước khi sửa file nào:
1. File/route hiện tại của trang Phân tích, component con đang dùng.
2. Thư viện chart đang dùng, cách wrap, cách truyền theme màu.
3. Cách gọi API (axios instance / React Query / SWR), pattern loading–error–empty.
4. Design token: màu, spacing, radius, breakpoint Tailwind/theme, dark mode có không.
5. Các endpoint analytics hiện có, DTO trả về, có hỗ trợ tham số khoảng ngày & nền tảng chưa.
6. i18n: file ngôn ngữ, quy tắc đặt key.
7. Component dùng chung có sẵn: Card, Table (sortable?), Badge, Dropdown, DateRangePicker,
   Sheet/Drawer (cho mobile), Skeleton, EmptyState — liệt kê cái nào tái sử dụng được.
   ➡️ Xuất báo cáo + danh sách file sẽ tạo/sửa, rồi chờ tôi duyệt.

## 1. BỐ CỤC MỚI (desktop ≥1280px)
Thứ tự từ trên xuống:

**A. Header trang** — giữ nguyên tiêu đề "Phân tích", sửa mô tả thành
"Đo lường dữ liệu quan trọng để tối ưu hiệu suất nội dung".

**B. Thanh lọc** (xem mục 2).

**C. Hàng 4 thẻ KPI**: Lượt xem / Lượt thích / Bình luận / Chia sẻ
- Icon nền pastel + nhãn cùng hàng, số lớn bên dưới.
- Dòng cuối: `↑ 18.6% so với 06/07 - 12/07` (xanh nếu tăng, đỏ nếu giảm) —
  **hiển thị đúng khoảng kỳ trước đã tính**, không ghi chung chung "so với kỳ trước".
- Sparkline nhỏ ở góc phải thẻ.

**D. Hàng chính — 2 cột (trái ~2fr, phải ~1fr):**
- **Cột trái:**
    1. `Bài đã đăng & số liệu tổng quan` — line chart 4 chỉ số, có điểm marker,
       legend trên đầu, tooltip hiển thị cả 4 chỉ số theo ngày.
    2. `Top bài viết hiệu quả` — **bảng rút gọn** đặt ngay dưới chart:
       cột `#`, thumbnail, tiêu đề (ngày giờ nhỏ bên dưới), icon nền tảng,
       Lượt xem / Lượt thích / Bình luận / Chia sẻ.
       Các cột số **sort được** (chỉ báo mũi tên rõ ràng), mặc định sort theo Lượt xem giảm dần.
       Footer: nút `Xem tất cả bài viết →` trải ngang.
       Click 1 dòng → mở chi tiết bài viết (dùng route/modal đã có).
- **Cột phải:**
    1. `Hiệu suất theo nền tảng` — donut + danh sách nền tảng kèm số & %.
       **Chỉ render nền tảng hệ thống hỗ trợ và đã kết nối**; nền tảng chưa kết nối
       hiển thị mờ + nút `Kết nối ngay` (giữ hành vi hiện có).
    2. `Hiệu suất theo loại nội dung` — donut + legend (Hình ảnh / Video / Reels / Văn bản) kèm %.
    3. `Thời điểm hoạt động nhiều nhất` — heatmap 7 ngày × 24 giờ (gom theo mốc 3h),
       thang màu Thấp → Cao có chú thích. Tooltip hiện giá trị tương tác từng ô.
       *(Nếu backend chưa có dữ liệu cho block này, hãy báo tôi trước và đề xuất cách tính,
       không tự mock.)*

**E. Dải `Thông tin chi tiết`** — full width, cuối trang, 5 ô:
Tổng bài đã đăng / Bài hoạt động tốt / Bài cần tối ưu / Khung giờ vàng / Tỷ lệ tương tác TB.
Mỗi ô: icon nền pastel, số lớn, nhãn, delta %.
**Ô "Bài cần tối ưu" click được** → điều hướng sang trang "Bài lỗi & cần xử lý".

## 2. LÀM LẠI THANH LỌC (phần quan trọng)
Vấn đề hiện tại: chip preset và 2 ô date bị trùng chức năng, filter nền tảng không có
trạng thái active rõ ràng, thanh lọc chiếm nguyên hàng ngang và mất khi cuộn.

Thiết kế mới — thanh lọc **căn phải, cùng hàng với header trang**, gồm 3 phần tử:
1. **Nút khoảng ngày**: hiển thị `13/07/2026 - 19/07/2026 ▾`.
   Click mở popover chứa: danh sách preset (Hôm nay, 7 ngày, 30 ngày, 90 ngày, Tùy chọn)
   ở cột trái + lịch chọn range ở cột phải. Ô nhập ngày chỉ hiện khi chọn "Tùy chọn".
2. **Nút `Bộ lọc`** (icon phễu) + badge đếm số filter đang áp dụng.
   Popover chứa: nền tảng (multi-select, có trạng thái checked rõ ràng),
   loại nội dung, và nút `Xoá bộ lọc`.
3. **Nút `Xuất báo cáo`** → xuất CSV (và PDF nếu dự án đã có sẵn util, không thì chỉ CSV).

Quy tắc:
- **Một nguồn filter duy nhất cho toàn trang.** KHÔNG đặt dropdown khoảng thời gian riêng
  trên từng card — mọi block đều đọc từ filter tổng.
- Trạng thái filter **đồng bộ vào URL query params** (`?from=&to=&platforms=&types=`)
  để chia sẻ link và F5 không mất.
- Thanh lọc **sticky** khi cuộn, có nền blur/đổ bóng nhẹ.
- Banner "Dữ liệu mẫu" thu gọn thành một dòng mảnh hoặc badge cạnh tiêu đề trang,
  không chiếm nguyên một hàng như hiện tại.
- Khi filter thay đổi: chỉ skeleton phần dữ liệu, **không remount cả trang**, không giật layout.

## 3. RESPONSIVE — LÀM CHO TẤT CẢ BREAKPOINT
- **≥1280px**: như mục 1.
- **1024–1279px**: KPI 4 cột giữ nguyên hoặc 2×2; vùng chính chuyển thành 1 cột,
  thứ tự: chart tổng quan → Hiệu suất nền tảng → Hiệu suất loại nội dung → Top bài viết → heatmap → Thông tin chi tiết.
- **768–1023px**: KPI 2 cột, tất cả block 1 cột.
- **<768px (mobile)**:
    - KPI: 1 cột hoặc carousel vuốt ngang.
    - **Thanh lọc thu gọn**: một hàng sticky duy nhất gồm nút khoảng ngày (rút gọn `7 ngày`)
        + icon phễu có badge. Bấm phễu mở **bottom sheet** chứa toàn bộ preset ngày, nền tảng,
          loại nội dung, với nút `Áp dụng` / `Xoá lọc` cố định ở đáy sheet.
          KHÔNG để chip preset trải ngang gây tràn màn hình.
    - **Top bài viết**: chuyển từ bảng sang **danh sách card** (tiêu đề + nền tảng + ngày,
      4 chỉ số xếp thành lưới 2×2 hoặc 1 hàng nhỏ). Không dùng bảng cuộn ngang.
    - **Heatmap**: cho phép cuộn ngang trong container, giữ cột thứ (T2–CN) dính bên trái.
    - **Chart**: giảm số nhãn trục X, ẩn gridline phụ, tooltip theo chạm.
    - Vùng chạm tối thiểu 44px.

## 4. BACKEND
- Kiểm tra endpoint analytics hiện có; nếu thiếu tham số `from`, `to`, `platforms`, `contentTypes`
  thì bổ sung theo đúng convention hiện tại (đặt tên route, DTO, validate, format response, xử lý lỗi).
- Bổ sung dữ liệu cho: hiệu suất theo loại nội dung, heatmap khung giờ, dải "Thông tin chi tiết",
  và **giá trị kỳ trước** để tính delta % chính xác (không tính ở FE bằng dữ liệu ước lượng).
- Cân nhắc gộp thành 1 endpoint `summary` hay tách nhiều endpoint —
  **đề xuất theo pattern dự án đang dùng rồi hỏi tôi trước khi làm**.
- Tối ưu query (index, tránh N+1), cache ngắn 30–60s cho số liệu tổng hợp.
- Dữ liệu phải là dữ liệu thật; cơ chế "dữ liệu mẫu" hiện có giữ nguyên, chỉ bật khi chưa kết nối nền tảng.

## 5. CHẤT LƯỢNG BẮT BUỘC
- Skeleton riêng từng block; một block lỗi không làm sập trang (có nút Thử lại).
- Empty state riêng cho: chưa kết nối nền tảng nào / có kết nối nhưng chưa có bài / filter không ra kết quả.
- Toàn bộ text mới đưa vào file i18n, không hardcode.
- Dùng đúng helper format số, %, tiền, ngày đang có (lưu ý: hiện tại có chỗ hiển thị `7.037`
  lẫn lộn dấu phân cách — hãy chuẩn hoá thống nhất toàn trang).
- Accessibility: aria-label cho nút icon, focus ring, chart có bảng dữ liệu thay thế hoặc aria-description.
- Không cài thêm thư viện khi chưa hỏi tôi.

## 6. THAM CHIẾU
Ảnh 3 là bố cục mục tiêu — **chỉ tham khảo cách sắp xếp, thứ tự block và nhãn tiếng Việt**.
KHÔNG lấy icon, ảnh minh hoạ, asset trang trí; icon dùng đúng bộ icon dự án đang có,
màu sắc map về design token sẵn có.

## 7. CÁCH LÀM VIỆC
Khảo sát → báo cáo & chờ duyệt → kế hoạch file/endpoint/i18n key → làm BE → làm FE
→ kiểm tra responsive ở 375 / 768 / 1024 / 1440px → tổng kết thay đổi + điểm còn giả định cần tôi xác nhận.

---
---

# 📌 TIẾN ĐỘ & BÀN GIAO — Analytics v2 (cập nhật 2026-07-28)

> Phần này gom **toàn bộ khảo sát + quyết định đã chốt + việc đã làm + việc còn lại** để phiên sau
> KHÔNG phải khảo sát lại. Đợt v1 (khối A–E) bàn giao ở `docs/Analytics.md` — đọc kèm khi cần.
>
> **Trạng thái: BACKEND XONG (30/30 test, đang nằm trong index chờ commit) · FRONTEND XONG
> (`npm run build` sạch). Còn lại: kiểm thị giác 375/768/1024/1440 với backend chạy thật.**

## A. QUYẾT ĐỊNH ĐÃ CHỐT (không hỏi lại)

**Chốt ở lượt duyệt 1:**
1. **Header trang:** GIỮ tiêu đề ở Topbar dùng chung (`AppShell.PAGE_KEYS.analytics`) — không đụng
   AppShell. Thanh lọc là **hàng đầu của trang**, sticky, căn phải. Chỉ sửa `pageSubAnalytics`
   thành "Đo lường dữ liệu quan trọng để tối ưu hiệu suất nội dung".
2. **API:** tách 3 endpoint riêng cho 3 khối mới (không gộp `/overview`) — đúng pattern slice
   `/analytics/*` sẵn có, để mỗi block tải/skeleton/retry độc lập.
3. **Heatmap:** tô màu theo **tương tác TB mỗi bài** (không phải tổng — tổng chỉ phản ánh tần suất đăng).
4. **Insights:** "Bài hoạt động tốt" = tương tác **trên mức TB của kỳ**; "Bài cần tối ưu" = **bài
   đăng THẤT BẠI** (khớp đích điều hướng là trang "Bài lỗi & cần xử lý").

**Chốt bổ sung ở lượt duyệt 2 (6 điểm — BE đã làm đủ, FE phải tôn trọng):**
1. **Chống méo heatmap do mẫu nhỏ:** `max`/`min` CHỈ tính trên ô có `posts >= 3`. FE: ô `posts = 0`
   → **nền trung tính, NGOÀI thang màu** ("chưa từng đăng"); ô `0 < posts < 3` → **có màu nhưng
   đánh dấu chưa đủ dữ liệu** (viền nét đứt / giảm opacity). Hai thứ này **khác nghĩa, không được
   hiển thị giống nhau**. Tooltip luôn hiện **cả `avgEngagement` VÀ `posts`**.
2. **`goldenHour` cũng lọc `posts >= 3`**; không ô nào đạt → `null` → FE hiện "Chưa đủ dữ liệu",
   TUYỆT ĐỐI không bịa khung giờ.
3. **`engagementRatePct` dễ hiểu sai:** views null ở Facebook → chỉ số này thực chất chỉ tính trên
   Instagram/Threads. BE trả kèm `ratedPosts`/`excludedPosts`; **FE bắt buộc chú thích rõ trên ô**
   (title hoặc dòng phụ), đại ý "không tính bài Facebook do nền tảng không trả lượt xem".
4. **Hai ngoại lệ bộ lọc (không phải một):** donut nền tảng bỏ qua lọc nền tảng; donut loại nội dung
   bỏ qua lọc loại nội dung. **Cả hai card đều phải ghi chú** ("Tính trên tất cả nền tảng" /
   "Tính trên tất cả loại nội dung").
5. **Nhãn:** "Bài cần tối ưu" → đổi thành **"Bài lỗi & cần xử lý"** (khớp tên trang điều hướng tới);
   "Bài hoạt động tốt" cần dòng phụ/title **"Tương tác trên mức trung bình kỳ"**; hai ô này **không
   được đặt cạnh nhau kiểu gợi ý cùng một thang** (không progress bar chia đôi, không dấu "/" giữa
   hai số); click ô "Bài lỗi & cần xử lý" **mang theo khoảng ngày đang lọc**.
6. **Trần export = 50.000 dòng** (mã 2053), FE hiện thông báo **hướng dẫn được** (gợi ý thu hẹp
   khoảng ngày), không phải toast lỗi trống.

**Giả định đã duyệt (D1–D5):** không thumbnail ở Top bài viết (DB chỉ có media prompt text — FR-29);
click 1 dòng → modal chi tiết dựng từ `GET /analytics/posts/{postId}` (đã có sẵn); export **chỉ CSV**
qua BE + PDF bằng `window.print()` (KHÔNG thêm POI/OpenPDF đợt này); chuẩn hoá định dạng số về một
helper trong `utils/format.ts`; không thêm thư viện nào (heatmap viết bằng CSS grid).

## B. KHẢO SÁT CÔ ĐỌNG (đủ để code tiếp)

- **Stack FE:** React 18 + TS, Vite, React Router 6, Zustand + Context. Data-fetch = **axios thuần**
  (`src/api/apiClient.ts`, KHÔNG react-query). Chart = **recharts ^3.9**. i18n tự chế (`src/i18n.ts`,
  object `t.<key>` vi/en). Không có dark mode, không có Tailwind theme cho trang app (UI viết bằng
  inline `CSSProperties`).
- **Design token thực tế:** `.page-shell` (`index.css`) giữ `--page-max: 1600px`,
  `--page-pad-x: 14px` (<760) / `24px`, gap dọc 24px — trang **bắt buộc** bọc `<PageContainer>`.
  Card = `ui.tsx › cardStyle` (viền `#efeaf8`, radius 20, padding 24). Chữ: `#211c38` / `#6b6680` /
  `#8a85a0` / `#a59fbb`; brand tím `#7c3aed`–`#8b5cf6`, gradient qua `useApp().brandGradient`.
- **Breakpoint:** `useBreakpoint` chỉ có mobile `<760` / tablet `760–1024` / desktop `>1024` —
  **chưa có mốc 1280**, phải thêm cho bố cục 2 cột theo đề bài.
- **Component tái dùng được:** `Card`, `PlatformTag`, `Modal` (portal + focus trap),
  `calendar/DaySheet` (**bottom sheet mobile có footer dính đáy** — dùng cho bộ lọc mobile),
  `admin/RowActionsMenu` (**khuôn popover: portal, đóng khi Esc/scroll/click ngoài, mobile tự thành
  bottom sheet**), `DatePicker` (chọn MỘT ngày, có lưới lịch + min/max — tái dùng logic lưới cho
  range picker), `dashboard/StatCard`, `dashboard/ContentTypeDonut` (mẫu donut + legend),
  skeleton class `.sk`. **KHÔNG có sẵn:** DateRangePicker, primitive Badge/EmptyState, heatmap.
- **Trang Phân tích hiện tại:** `pages/app/Analytics.tsx` + `components/analytics/{AnalyticsToolbar,
  AnalyticsTrendChart, PlatformBreakdown, PostsTable, TopPostsTable, AllPostsModal,
  AnalyticsSkeleton, analyticsTokens}`, API ở `api/analytics.ts` (+ `analyticsMock.ts` fallback).
- **Export mẫu có sẵn:** BE `util/CsvUtil` + `ActivityLogServiceImpl.exportCsv` (CSV **chuỗi trong
  `result`**, FE tự tạo Blob); FE `pages/admin/Revenue.tsx:158-190` (Blob + BOM) và PDF =
  `window.print()` (đã có CSS `@media print`).

**Bốn phát hiện cần xử lý ở FE:**
1. **Sticky sai offset:** toolbar hiện đặt `top: 0` nhưng Topbar cũng sticky, cao **70px desktop /
   62px mobile** → thanh lọc chui dưới Topbar. Bản mới phải `top: 70/62`.
2. **Định dạng số lẫn lộn:** `formatCompactNumber(7037)` → `7K` (KPI) trong khi
   `formatGroupedNumber(7037,'vi')` → `7.037` (bảng/tooltip/donut). Chuẩn hoá: KPI compact + `title`
   số đầy đủ; bảng/tooltip/donut/heatmap grouped theo `lang`; gom về một helper.
3. **Click dòng Top bài viết** hiện `go('create')` (chưa có route chi tiết theo id) → thay bằng modal
   chi tiết từ `/analytics/posts/{postId}`.
4. **Trang "Bài lỗi & cần xử lý"** (`pages/app/FailedPosts.tsx`) lọc ngày **client-side theo
   `failedAt`**, state React **chưa đọc URL param** → muốn mang `from`/`to` sang thì phải thêm đọc
   `useSearchParams` vào state khởi tạo của trang đó (thay đổi nhỏ, nằm ngoài file Analytics).

## C. ĐÃ LÀM — BACKEND (commit `ffba0c6`)

### Hợp đồng API sau đợt này

Bộ lọc dùng chung: `from`, `to` (yyyy-MM-dd, mặc định 7 ngày gần nhất), `platforms` (CSV enum),
**`contentTypes` (MỚI — CSV nhãn `media_format` IN HOA: `IMAGE,VIDEO,TEXT,OTHER`; `OTHER` = bản chưa
định dạng)**. Kỳ so sánh luôn là kỳ liền trước cùng độ dài. Lỗi: 2050 khoảng ngược, 2051 quá 366 ngày,
2053 export vượt trần.

| Endpoint | Bộ lọc nhận | Trả về |
|---|---|---|
| `GET /analytics/summary` | from,to,platforms,**contentTypes** | 4 KPI + `compareFrom/compareTo` + `deltaPct` + `series[]` |
| `GET /analytics/timeseries` | from,to,platforms,**contentTypes** | points theo ngày (zero-fill) |
| `GET /analytics/by-platform` | from,to,**contentTypes** (⚠️ **KHÔNG** nhận platforms) | đủ 3 nền tảng + `connected` + `sharePct` |
| `GET /analytics/by-content-type` **(MỚI)** | from,to,platforms (⚠️ **KHÔNG** nhận contentTypes) | `[{label, posts, views, likes, comments, shares, engagement, sharePct}]` — chỉ loại CÓ bài |
| `GET /analytics/activity-heatmap` **(MỚI)** | from,to,platforms,contentTypes | `{from, to, cells[], max, min, minPostsForScale, scaledCells}` |
| `GET /analytics/insights` **(MỚI)** | from,to,platforms,contentTypes | 5 ô + delta (xem dưới) |
| `GET /analytics/export` **(MỚI)** | from,to,platforms,contentTypes,sort | CSV **chuỗi trong `result`**; >50.000 dòng → 2053 |
| `GET /analytics/top-posts` | from,to,platforms,**contentTypes**,sort,limit(≤50) | list bài |
| `POST/DELETE /analytics/dev-seed` | — | seeder dev-only (cờ `aima.dev.analytics-seed-enabled`) |

**`cells[]` của heatmap:** `{dow (1=T2…7=CN), slot (0..7), hourStart, posts, engagement,
avgEngagement, lowSample}`. **Chỉ ô CÓ bài mới được trả về** — ô vắng mặt = "chưa từng đăng", FE tự
điền lưới 7×8. `lowSample = posts < minPostsForScale (3)`. `max`/`min` = `null` khi `scaledCells = 0`.

**`/insights`:** `{from, to, compareFrom, compareTo, totalPosts, totalPostsDeltaPct, goodPosts,
goodPostsDeltaPct, avgEngagementPerPost, needsAttentionPosts, needsAttentionDeltaPct,
goldenHour: {dow, slot, hourStart, hourEnd, posts, avgEngagement} | null, engagementRatePct | null,
engagementRateDeltaPct, ratedPosts, excludedPosts}`.

### Cách tính (đã cài, đừng tính lại ở FE)

- **Heatmap:** gộp theo `(extract(isodow), floor(hour/3))` của `posts.published_at` — timestamp đã
  lưu theo `APP_TIMEZONE` (Asia/Ho_Chi_Minh) nên **không quy đổi thêm**. `avgEngagement =
  engagement / posts`, làm tròn 1 chữ số.
- **`goodPosts`:** đếm bài có `engagement > TB của chính kỳ đó` (ngưỡng động, không cố định). Kỳ so
  sánh dùng TB của riêng nó.
- **`needsAttentionPosts`:** đếm bài `status = FAILED` + lịch `FAILED`, lọc theo **thời điểm thất bại
  = `MAX(posting_jobs.end_time)` của job FAILED** — đúng trường `failedAt` mà trang "Bài lỗi & cần
  xử lý" đang lọc, để hai màn hình cho cùng một con số.
- **`engagementRatePct`:** `tương tác / lượt xem` **chỉ trên bài có `views != null && views > 0`**.
  `PostEngagementProjection.getViews()` để kiểu `Long` (nullable) CỐ Ý — không coalesce về 0.
  Không bài nào có lượt xem → `null` (khác hẳn 0%).
- **Chuẩn hoá loại nội dung:** SQL dùng `upper(coalesce(nullif(trim(media_format),''),'OTHER'))`;
  service uppercase giá trị lọc. Lưu ý **dữ liệu MVP không có "Reels"** (AI chỉ sinh image/video/text)
  → donut chỉ render nhóm có thật, FE không được bịa lát Reels.

### File BE đã tạo/sửa

- Controller: `AnalyticsController` (+4 endpoint, +`contentTypes` cho 4 endpoint cũ)
- Service: `AnalyticsService` (+record `AnalyticsQuery(from,to,platforms,**contentTypes**)`,
  +hằng `HEATMAP_SLOT_HOURS=3`, `HEATMAP_SLOTS=8`, `MIN_HEATMAP_POSTS=3`, `MAX_EXPORT_ROWS=50000`),
  `Impl/AnalyticsServiceImpl` (+4 method, +`buildHeatmap` dùng chung cho khối G và goldenHour,
  +cache thủ công **45 giây** — tự xoá khi dev-seed)
- DTO mới (5): `Analytics{ContentType,HeatmapCell,Heatmap,GoldenHour,Insights}Response`
- Projection mới (3): `{ContentTypeMetric,HeatmapCell,PostEngagement}Projection`
- Repo: `PostAnalyticsRepository` (+4 query native: content-type, heatmap, per-post engagement,
  count export; +`typeCsv` cho 3 query cũ), `PostRepository` (+`countFailedForUserInRange`)
- Entity: `Post` (+index `posts(status, published_at)`), `PostAnalytics`
  (+index `post_analytics(post_id, milestone_hours)` khớp `DISTINCT ON`) — `ddl-auto=update` tự tạo
- ErrorCode: +`ANALYTICS_EXPORT_TOO_LARGE(2053)`
- Test: `AnalyticsAggregateTest` **30/30 pass** (17 cũ + 13 mới: ngưỡng mẫu heatmap, lowSample,
  max/min null, goldenHour đủ mẫu/null, goodPosts theo TB kỳ, tỷ lệ tương tác loại bài views null,
  hai ngoại lệ bộ lọc, export vượt trần + nội dung CSV)

## C-bis. ĐÃ LÀM — FRONTEND (2026-07-28)

**File mới** (`frontend/src/components/analytics/`): `AnalyticsFilterBar.tsx` (thanh lọc + 2 popover +
bottom sheet mobile + menu xuất báo cáo), `FilterPopover.tsx` (khuôn popover portal — **không đóng khi
cuộn** mà tính lại vị trí, vì trigger nằm trên thanh sticky), `RangeCalendar.tsx` (lịch chọn KHOẢNG,
dự án chỉ có `DatePicker` một ngày), `dateRange.ts` (preset/`activePreset`/`formatRangeLabel` — thay
helper cũ trong `AnalyticsToolbar`), `ContentTypeBreakdown.tsx`, `ActivityHeatmap.tsx`,
`InsightsStrip.tsx`, `PostsCardList.tsx` (bản mobile của bảng), `PostDetailModal.tsx`, `BlockError.tsx`.

**File sửa:** `api/analytics.ts` (gom bộ lọc thành `AnalyticsFilter`, thêm `contentTypes`, 4 hàm mới +
`exportAnalyticsCsv`), `api/analyticsMock.ts` (mock 3 khối mới, tôn trọng cả 2 chiều bộ lọc và 2 ngoại
lệ), `pages/app/Analytics.tsx` (viết lại bố cục + vòng đời tải), `components/analytics/{AnalyticsSkeleton,
TopPostsTable, AllPostsModal, PlatformBreakdown}.tsx`, `components/dashboard/StatCard.tsx` (thêm
`title` = số đầy đủ theo `lang` bên cạnh số rút gọn), `pages/app/FailedPosts.tsx` (đọc `?from&to`),
`i18n.ts` (≈45 key `ana*` vi+en, sửa `pageSubAnalytics`). **Đã xoá** `AnalyticsToolbar.tsx` (bị thanh
lọc mới thay hoàn toàn).

**Quyết định lúc code (khác/bổ sung so với mục D bên dưới — đọc kỹ):**
1. **Dữ liệu mẫu không còn "nuốt" lỗi và không còn che empty state.** Trang chỉ rơi về mock khi tài
   khoản **chưa từng** có số liệu thật; đã thấy dữ liệu thật một lần (`everReal`) thì lọc ra 0 kết quả
   sẽ hiện **empty state thật** (3 loại: chưa kết nối / chưa có bài / lọc không ra), còn lỗi API hiện
   **nút Thử lại** — bản cũ đổi sang demo nên người dùng tưởng số liệu tụt.
2. **Thứ tự tải:** khối lõi (summary + timeseries) quyết định thật/mẫu trước, các khối còn lại chờ
   quyết định đó (`demo: boolean | null`) rồi mới tải — tránh nửa trang thật nửa trang mẫu.
3. **`go()` không nhận query string** → ô "Bài lỗi & cần xử lý" dùng `navigate('/failed-posts?from=&to=')`.
4. **Không tách `useBreakpoint`**: mốc 1280 tính tại chỗ từ `width` sẵn có, không sửa hook dùng chung.
5. **Mobile có thêm nút xuất báo cáo** (icon-only, 44px) cạnh nút ngày + phễu — đề bài chỉ nêu 2 nút,
   nhưng thiếu nút xuất thì mobile mất tính năng; vẫn một hàng, không tràn ở 375px.
6. **Hai ô "Bài hoạt động tốt" / "Bài lỗi & cần xử lý"** vẫn theo thứ tự đề bài nhưng khác tone màu,
   khác dòng phụ, và **không** có thanh chia đôi/dấu "/" nào giữa hai số (đúng ràng buộc A-5).

**Chưa làm:** kiểm thị giác thật ở 375/768/1024/1440 (cần backend chạy + đăng nhập; `.env` đang trỏ
Postgres từ xa + scheduler đăng bài thật nên KHÔNG tự boot).

## D. YÊU CẦU FE (đã hoàn thành — giữ làm tham chiếu khi sửa tiếp)

**D1. Thanh lọc mới (mục 2 đề bài)**
- `AnalyticsFilterBar` — một hàng **sticky `top: 70` desktop / `62` mobile**, nền blur + shadow nhẹ,
  căn phải, 3 phần tử: nút khoảng ngày `13/07/2026 - 19/07/2026 ▾` · `Bộ lọc` (icon phễu + badge đếm)
  · `Xuất báo cáo`.
- `DateRangePopover` (desktop): preset cột trái (Hôm nay/7/30/90/Tùy chọn) + lịch chọn range cột phải;
  ô nhập ngày **chỉ hiện khi chọn "Tùy chọn"**. `FilterPopover`: nền tảng multi-select (trạng thái
  checked rõ ràng) + loại nội dung + `Xoá bộ lọc`. Cả hai theo khuôn portal của `RowActionsMenu`.
- Mobile `<768`: một hàng sticky rút gọn (`7 ngày` + phễu có badge) → mở **bottom sheet** dựng trên
  `DaySheet`, footer `Áp dụng`/`Xoá lọc` dính đáy. **KHÔNG để chip preset trải ngang.**
- URL params `?from=&to=&platforms=&types=&sortField=&sortDir=` (giữ `patchParams` sẵn có).
  **Một nguồn filter duy nhất** — không dropdown thời gian riêng trên từng card.
- Banner "Dữ liệu mẫu" thu về **badge/1 dòng mảnh** cạnh thanh lọc.
- Đổi filter: **chỉ skeleton phần dữ liệu**, không remount cả trang, không giật layout.

**D2. Bố cục mới (mục 1 đề bài)** — A header → B 4 KPI (delta ghi rõ **khoảng kỳ trước đã tính**,
không ghi "so với kỳ trước" chung chung → dùng `compareFrom`/`compareTo`) → D 2 cột (trái 2fr: chart
+ bảng Top rút gọn với footer "Xem tất cả bài viết →"; phải 1fr: donut nền tảng, donut loại nội dung,
heatmap) → E dải "Thông tin chi tiết" full width 5 ô.

**D3. Ba khối mới** — `ContentTypeDonut` (analytics), `ActivityHeatmap`, `InsightsStrip`, theo đúng
6 điểm ở mục A (ô 0 bài vs ô <3 bài phải khác nhau; tooltip có cả avg và posts; goldenHour null →
"Chưa đủ dữ liệu"; chú thích engagementRate; ghi chú 2 ngoại lệ trên 2 donut; nhãn "Bài lỗi & cần
xử lý" + dòng phụ "Tương tác trên mức trung bình kỳ"; hai ô không cùng thang).

**D4. Responsive** — ≥1280 như trên; 1024–1279 một cột theo thứ tự chart → nền tảng → loại nội dung →
Top bài viết → heatmap → Thông tin chi tiết; 768–1023 KPI 2 cột; <768 KPI 1 cột/carousel, Top bài
viết chuyển **danh sách card** (không bảng cuộn ngang), heatmap cuộn ngang **giữ cột thứ dính trái**,
chart giảm nhãn trục X, vùng chạm ≥44px. Kiểm ở **375 / 768 / 1024 / 1440**.

**D5. Chất lượng** — skeleton + **nút Thử lại** riêng từng khối (một khối lỗi không sập trang);
empty state riêng cho *chưa kết nối nền tảng nào* / *có kết nối chưa có bài* / *filter không ra kết
quả*; a11y (aria-label nút icon, focus ring, chart có bảng dữ liệu thay thế hoặc aria-description);
chuẩn hoá định dạng số; **mọi text mới vào i18n vi+en**.

**D6. i18n key dự kiến** (tiền tố `ana*`): `anaFilterBtn, anaFilterClear, anaFilterApply,
anaFilterCount, anaDateRange, anaExport, anaExportCsv, anaExportTooLarge, anaExportFailed,
anaContentTypes, anaTypesTitle/Sub/Empty/AllTypesNote, anaPlatformAllNote, anaHeatmapTitle/Sub/Empty,
anaHeatLow, anaHeatHigh, anaHeatNoPost, anaHeatLowSample, anaHeatTooltip, anaNotEnoughData,
anaInsightsTitle, anaTotalPostsStat, anaGoodPosts, anaGoodPostsHint, anaNeedsAttention,
anaGoldenHour, anaAvgEngRate, anaAvgEngRateNote, anaRetry, anaBlockError, anaEmptyNoConnection,
anaEmptyNoPosts, anaEmptyNoResult, anaVsRange` (thay `anaVsPrev`), `anaSlot0..7`, `anaDow1..7`.
Sửa `pageSubAnalytics` → "Đo lường dữ liệu quan trọng để tối ưu hiệu suất nội dung".

**D7. Ngoài file Analytics** — thêm đọc `from`/`to` từ URL vào `pages/app/FailedPosts.tsx` để ô
"Bài lỗi & cần xử lý" điều hướng mang theo khoảng ngày; cập nhật `docs/PLAN.md` (UI-08) khi FE xong.

## E. CÁCH CHẠY & VERIFY

- **JDK 21 bắt buộc:** `JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot`.
- **Chạy test (cách verify chính thức):**
  `mvnw.cmd -f backend/pom.xml -q -o test "-Dtest=AnalyticsAggregateTest" "-Dsurefire.failIfNoSpecifiedTests=false"`
  → đọc `backend/target/surefire-reports/com.aima.analytics.AnalyticsAggregateTest.txt`.
- **⚠️ KHÔNG boot app để test:** `.env` trỏ Postgres Supabase **từ xa** và scheduler đăng bài **thật**
  mỗi 60 giây. Verify bằng test hoặc JDBC read-only.
- **Có dữ liệu demo:** đặt `AIMA_DEV_ANALYTICS_SEED=true` → `POST {CONTEXT_PATH}/analytics/dev-seed`
  (seeder tự xoá cache 45s nên số liệu hiện ngay), `DELETE` để dọn. FE còn cơ chế dữ liệu mẫu tự động
  (`api/analyticsMock.ts`) — **khi làm FE nhớ bổ sung mock cho 3 khối mới**, nếu không các khối đó sẽ
  trống trong lúc trang còn lại hiện dữ liệu mẫu.

## F. LƯU Ý KHI COMMIT (quan trọng)

Cây làm việc đang có **công việc khác chạy song song** (Admin Overview + Plans:
`AdminOverviewController`, `Plan*`, `Sidebar.tsx`, `pages/admin/Overview.tsx`, `useUiStore.ts`,
`config/adminNav.ts`…). Commit BE đợt này đã **chỉ add theo đường dẫn tường minh**; riêng
`ErrorCode.java` bị lẫn thay đổi của cả hai bên nên đã **tách hunk** — chỉ dòng 2053 được commit,
`PLAN_BILLING_INTERVAL_INVALID(1989)` của phía kia vẫn nằm ngoài index.

**Rủi ro đã biết cho phiên FE:** `frontend/src/i18n.ts` cũng đang bị phía kia sửa. Nếu các dòng thêm
mới nằm xen kẽ thì **không tách hunk sạch được** — khi đó DỪNG và hỏi chủ dự án thay vì commit lẫn
phần của người khác.