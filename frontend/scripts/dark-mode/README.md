# Kiểm tra dark mode

Các công cụ này dùng riêng cho QA, không thêm dependency vào ứng dụng.

```powershell
npm install --prefix frontend/scripts/dark-mode

# Terminal frontend (cờ bật chỉ trong tiến trình QA):
$env:VITE_ENABLE_DARK_MODE = 'true'
$env:VITE_API_BASE_URL = 'http://localhost:8092/api/aima'
npm --prefix frontend run dev -- --host 127.0.0.1 --port 3100

# Terminal khác:
node frontend/scripts/dark-mode/verify.mjs
```

Chrome mặc định: `C:/Program Files/Google/Chrome/Application/chrome.exe`.
Runner chặn các request `/api/aima/**` và trả fixture, không cần backend/DB và không đăng bài.
Ảnh ghi ở `docs/dark-mode-review/`. Dữ liệu trong ảnh là dữ liệu kiểm tra.
Đồng hồ cố định 09:00 ngày 2026-10-04 (Asia/Ho_Chi_Minh), font được chờ nạp,
animation/transition được tắt khi chụp; Chrome tắt LCD text/hinting để cố định cách raster chữ.

Runner kiểm tra chuyển 3 chế độ, lưu/reload, đổi màu OS khi ở chế độ hệ thống,
bàn phím, topbar/menu ở 1440/1280/1024/800/390/320px, màu SVG, in sáng,
landing/pricing/legal/auth theo lựa chọn màu (từ đợt cuối), và lỗi JavaScript.

So với HEAD: chạy frontend của checkout HEAD ở port 3101 với cờ tắt và cùng API base URL,
chạy `node frontend/scripts/dark-mode/verify.mjs --baseline`, rồi chạy `compare-light.mjs`.
Chỉ ẩn nút chuyển ở ảnh so sánh của bản mới; ảnh duyệt vẫn có nút.

Kiểm tra cờ tắt: ở terminal đặt `VITE_ENABLE_DARK_MODE=false` (fallback hiện tại là true),
chạy build rồi preview ở port 3102, chạy `node frontend/scripts/dark-mode/verify.mjs --production`.
Runner lưu lựa chọn tối nhưng xác nhận ứng dụng vẫn sáng và ẩn nút.

## Đợt 2 — component dùng chung và Settings

`SharedPreview.tsx` là entry QA do runner đưa vào HTML giả lập. Không có route/entry mới trong ứng dụng.
API được chặn hoàn toàn, kể cả ba POST đổi mật khẩu; không cần backend và không gửi email thật.

Chuẩn bị frontend của checkout baseline HEAD (cùng dependency, API base URL như trên):

```powershell
node frontend/scripts/dark-mode/prepare-shared-baseline.mjs <absolute-baseline-frontend-directory>
# Trong frontend baseline:
npm run dev -- --host 127.0.0.1 --port 3101 --config dark-mode-qa.config.mjs
```

Config QA dùng cache `.vite-dark-mode-qa` riêng. Khi node_modules là junction dùng chung,
hai Vite server dùng chung cache mặc định có thể làm sai runtime React; cần cache riêng cho baseline.

```powershell
# Frontend hiện tại vẫn ở 3100, cờ bật trong tiến trình QA:
node frontend/scripts/dark-mode/verify-shared.mjs --baseline
node frontend/scripts/dark-mode/verify-shared.mjs
node frontend/scripts/dark-mode/verify-settings.mjs
# Sau build với cờ tắt và preview 3102:
node frontend/scripts/dark-mode/verify-settings.mjs --production
```

Runner shared kiểm tra desktop 1440px/mobile 390px; modal, drawer/docked, confirm, onboarding,
date picker, 5 toast, đổi mật khẩu, Settings. Đồng hồ 09:00 ngày 2026-10-05.
So 18 ảnh sáng bằng CIEDE2000 (assert số hữu hạn + không pixel ΔE >3), ẩn selector mới khi so baseline.
Runner Settings dùng trang ứng dụng thật để kiểm tra đồng bộ hai chiều với topbar, lưu/reload, print và cờ tắt.
Kết quả/ảnh ở `docs/dark-mode-review/batch2/`. Sau QA có thể gỡ hai file entry/config do prepare tạo
và cache QA của baseline; giữ nguyên checkout và junction node_modules.

```powershell
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run preview -- --host 127.0.0.1 --port 3102
node frontend/scripts/dark-mode/verify.mjs --production
```

`npm test` có thêm kiểm tra script áp màu trước React và tương phản AA của token chữ tối
trên 5 nền trung tính. Đây chưa phải kiểm toán WCAG toàn ứng dụng hoặc test tích hợp backend.

## Đợt cuối — trang và phản hồi

`page-fixtures.mjs` chỉ trả dữ liệu giả lập; mỗi runner chặn mọi request API. Current Vite port 3100,
baseline port 3101 (cache riêng như trên), production true port 3103, production false port 3102.

```powershell
node frontend/scripts/dark-mode/verify-pages.mjs --baseline
node frontend/scripts/dark-mode/verify-pages.mjs
node frontend/scripts/dark-mode/verify-interactions.mjs
node frontend/scripts/dark-mode/verify-landing.mjs --baseline
node frontend/scripts/dark-mode/verify-landing.mjs
node frontend/scripts/dark-mode/verify-failed-posts.mjs
node frontend/scripts/dark-mode/verify-auth-controls.mjs
node frontend/scripts/dark-mode/verify-content-asides.mjs
node frontend/scripts/dark-mode/verify-brand-palettes.mjs
node frontend/scripts/dark-mode/verify-pastel-surfaces.mjs
node frontend/scripts/dark-mode/verify-toast-offset.mjs
node frontend/scripts/dark-mode/compare-pages.mjs
node frontend/scripts/dark-mode/compare-landing.mjs
node frontend/scripts/dark-mode/check-token-references.mjs
node frontend/scripts/dark-mode/token-catalog.mjs
node frontend/scripts/dark-mode/verify-release.mjs
node frontend/scripts/dark-mode/verify-release.mjs --disabled
```

`verify-pages --only /path,/path` chụp lại phần cần kiểm tra và gộp kết quả vào report hiện có.
Codemod/inventory/report lưu trong thư mục này và `docs/dark-mode-review/reports/`;
ảnh và giới hạn đối chiếu xem [báo cáo cuối](../../../docs/dark-mode-review/final/README.md).

Palette/Toast chạy frontend QA ở port 3100, chặn API bằng fixture.
`codemod-brand-foreground.mjs` dry-run mặc định, `apply` chỉ đổi chữ/icon trắng trên
nền brand đã nhận diện; helper truyền gradient và nền trạng thái vẫn phải rà thủ công.
`--remaining` ở surface/toast runner tiếp tục các tổ hợp chưa có trong report nếu môi trường QA bị ngắt.
