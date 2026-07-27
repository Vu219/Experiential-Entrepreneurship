# NHIỆM VỤ
Nâng cấp trang **Admin → Tổng quan (Overview / Dashboard)** của hệ thống AIMA:
đi từ giao diện hiện tại (đơn giản) sang bản thiết kế mới, đồng thời **nối API thật cho Backend**.
Yêu cầu bắt buộc: đồng bộ với codebase hiện có, KHÔNG tự sinh convention mới.

## 0. GIAI ĐOẠN KHẢO SÁT (làm trước, không viết code)
Trước khi sửa bất cứ file nào, hãy khảo sát và báo cáo lại cho tôi:

1. **Cấu trúc dự án**: cây thư mục FE/BE, framework, router, state management
   (React Query / Redux / Zustand / SWR?), cách gọi API (axios instance? fetch wrapper?).
2. **Các tab admin khác đang có** (Quản lý người dùng, Quản lý doanh thu, Quản lý gói,
   Token & hạn mức, Nhà cung cấp & API key, Model & định tuyến, Sử dụng & chi phí,
   Trạng thái hệ thống, Log hệ thống, Version API nền tảng):
    - Chúng đang lấy dữ liệu từ endpoint nào?
    - Dùng chung component nào (Card, Table, Badge, StatusPill, EmptyState, Skeleton...)?
    - Pattern loading / error / empty state ra sao?
3. **Design system hiện tại**: file token màu, spacing, radius, shadow, typography,
   Tailwind config / theme, cách đặt tên class, dark mode có không.
4. **i18n**: file ngôn ngữ (vi/en) đặt ở đâu, key đặt tên theo quy tắc nào.
5. **Backend**: cấu trúc module (controller/service/repository? router/handler?),
   cách validate, cách trả response (envelope `{data, message}`? interceptor?),
   cách phân trang, cách xử lý lỗi, middleware auth/role, ORM và schema DB hiện có.
6. **Phân quyền**: role admin được kiểm tra ở đâu (guard/middleware/HOC).

➡️ Xuất ra một **báo cáo ngắn + danh sách file sẽ sửa/tạo** rồi mới làm bước tiếp theo.

## 1. THAM KHẢO THIẾT KẾ
Trong repo có thư mục `overview/` chứa bản thiết kế mục tiêu.
- **Đọc kỹ để tham khảo BỐ CỤC (layout, thứ tự block, grid, khoảng cách) và TEXT/nhãn tiếng Việt.**
- **KHÔNG copy icon, hình trang trí, asset, illustration từ thư mục này.**
  Icon phải dùng đúng bộ icon mà dự án đang dùng sẵn.
- Màu sắc/spacing phải map về design token của dự án, không hardcode mã màu mới.

## 2. YÊU CẦU GIAO DIỆN (điểm khác biệt cần bổ sung)
So với bản hiện tại, trang Tổng quan mới phải có:

### 2.1 Hàng 4 thẻ KPI (Tổng người dùng / Hoạt động hôm nay / Nội dung đã tạo / MRR)
- Header thẻ: icon (nền pastel bo tròn) **nằm cùng hàng với nhãn**, không còn badge % ở góc phải.
- Số liệu lớn ở dưới nhãn.
- Dòng cuối: `+8.2% so với tuần trước` (màu xanh nếu tăng, đỏ nếu giảm) + **sparkline mini chart**
  ở góc phải thẻ (dùng thư viện chart dự án đã có; nếu chưa có, đề xuất trước khi cài).
- Text mốc so sánh khác nhau theo từng thẻ: "so với tuần trước" / "so với hôm qua".

### 2.2 Bảng "Người dùng gần đây"
- Đổi header cột đầu: `Tên` → `Người dùng`.
- Thêm **cột hành động (kebab ⋮)** ở cuối mỗi dòng: Xem chi tiết / Khoá / Đổi gói
  (menu phải tái sử dụng dropdown có sẵn và **gọi đúng action đã tồn tại ở tab Quản lý người dùng**,
  không viết logic trùng lặp).
- Link `Xem tất cả →` ở góc phải tiêu đề + **nút footer `Xem tất cả người dùng →`** trải ngang cuối bảng.
- Cả hai đều điều hướng sang tab Quản lý người dùng (giữ nguyên route hiện có).

### 2.3 Card "Phân bổ gói"
- Thêm link `Xem chi tiết` → trỏ sang tab Quản lý gói.
- Hiển thị `5,128 (42%)` thay vì `5,128 · 42%`.
- Thêm **dòng tổng kết dưới cùng**: `Tổng người dùng — 12,847` (nền nhấn nhẹ).
- Progress bar giữ màu phân biệt theo từng gói, lấy màu từ token gói dùng chung toàn hệ thống.

### 2.4 Card "Tình trạng hệ thống"
- Mỗi dòng có **icon ở đầu**, tên dịch vụ, **badge trạng thái**, và **cột giá trị riêng bên phải**
  (`99.98%`, `Operational`, `72% used`).
- Badge dùng nhãn tiếng Việt: `Hoạt động` / `Cảnh báo` / `Sự cố`.
- Thêm **banner tổng kết cuối card**: `Hệ thống hoạt động ổn định` + `Cập nhật lần cuối: HH:mm • DD/MM/YYYY`.
  Banner đổi màu/nội dung khi có dịch vụ ở trạng thái cảnh báo hoặc sự cố.
- Link `Xem chi tiết` → tab Trạng thái hệ thống.

### 2.5 Block mới "Lối tắt quản trị"
- Hàng các thẻ shortcut: Quản lý người dùng, Quản lý gói, Bài đăng lỗi, Token & hạn mức, Sử dụng & chi phí.
- Mỗi thẻ = icon + nhãn, click điều hướng đúng route.
- **Danh sách shortcut phải sinh từ cùng nguồn cấu hình menu sidebar** (single source of truth),
  và tự lọc theo quyền của user hiện tại.

### 2.6 Sidebar
- Item đang active dùng style của thiết kế mới.
- Thêm nút **`Thu gọn`** ở đáy sidebar (collapse/expand), lưu trạng thái vào localStorage.
- Badge số thông báo lấy từ API thật, không hardcode.

## 3. YÊU CẦU BACKEND
Tạo/điều chỉnh API phục vụ trang này. **Tuân thủ tuyệt đối** cấu trúc thư mục, quy tắc đặt tên
(file, class, hàm, biến, route, DTO), format response và cách xử lý lỗi đang dùng trong dự án.

Gợi ý endpoint (đặt tên lại theo convention thực tế của repo sau khi khảo sát):
- `GET /admin/overview/stats` → 4 KPI + % thay đổi + mảng điểm sparkline (7–14 điểm gần nhất).
- `GET /admin/overview/recent-users?limit=5` → danh sách user mới nhất.
- `GET /admin/overview/plan-distribution` → số lượng + tỉ lệ từng gói + tổng.
- `GET /admin/overview/system-health` → trạng thái từng dịch vụ + giá trị + `lastUpdatedAt`.
- (Tuỳ chọn) `GET /admin/overview/summary` gộp tất cả trong 1 request để giảm round-trip —
  hãy đề xuất phương án nào phù hợp hơn với pattern hiện tại của dự án.

Bắt buộc:
- Có middleware/guard kiểm tra **role admin**; trả 403 đúng chuẩn nếu không đủ quyền.
- **Tái sử dụng service/repository đã có** của module user, plan, revenue — không viết query trùng lặp.
- Query tổng hợp phải có index phù hợp; tránh N+1; cân nhắc **cache ngắn (30–60s)** cho số liệu thống kê.
- Số liệu phải là **dữ liệu thật từ DB**, không mock. Nếu chưa có nguồn cho chỉ số nào
  (ví dụ MRR hoặc uptime), hãy nêu rõ và đề xuất cách tính trước khi implement.
- Viết DTO/type dùng chung FE-BE nếu dự án có thư mục shared types.

## 4. CHẤT LƯỢNG & CHI TIẾT KHÔNG ĐƯỢC BỎ QUA
- **Loading**: skeleton cho từng block (không dùng spinner toàn trang).
- **Error**: mỗi block tự hiển thị lỗi + nút Thử lại, một block lỗi không làm sập cả trang.
- **Empty state**: khi chưa có user/dữ liệu.
- **Responsive**: 4 cột → 2 cột (tablet) → 1 cột (mobile); bảng cuộn ngang hoặc chuyển sang dạng card.
- **i18n**: toàn bộ text mới đưa vào file ngôn ngữ, không hardcode chuỗi trong component.
- **Format số/tiền/ngày**: dùng đúng helper format đang có (12,847 / $48.6K / DD/MM/YY).
- **Accessibility**: aria-label cho nút icon, focus ring, contrast đạt chuẩn.
- **Auto refresh**: dữ liệu tự làm mới sau N giây (cấu hình được) hoặc có nút refresh thủ công.
- Nếu dự án có test, viết test cho service/endpoint mới theo đúng pattern test hiện có.

## 5. CÁCH LÀM VIỆC
1. Khảo sát → báo cáo → **chờ tôi duyệt**.
2. Đề xuất kế hoạch: danh sách file tạo mới / sửa, tên endpoint, tên component, tên i18n key.
3. Implement BE trước, FE sau, commit tách bạch theo từng phần.
4. Sau khi xong: liệt kê thay đổi, cách chạy thử, và những điểm còn giả định cần tôi xác nhận.
   Không tự ý cài thêm thư viện hay đổi kiến trúc khi chưa hỏi tôi.