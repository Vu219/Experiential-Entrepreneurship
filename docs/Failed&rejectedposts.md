## Bối cảnh
Dự án: AIMA — nền tảng AI Content Marketing (web app + khu vực admin).
Trang cần làm: tab "Bài đăng lỗi & bị từ chối" trong Admin (route: /admin/posts).

Hiện trạng: trang này mới chỉ có 2 tab ("Bị nền tảng từ chối" / "Lỗi hệ thống")
và 1 bảng rất sơ sài (Người dùng | Nền tảng | Trạng thái | Lý do | Hành động).
Tôi muốn nâng cấp trang này lên bản đầy đủ theo thiết kế mẫu (ảnh đính kèm).

## GIAI ĐOẠN 1 — KHẢO SÁT (làm trước, KHÔNG code)
Trước khi sửa bất cứ dòng nào, hãy đọc và tóm tắt lại cho tôi:

1. Cấu trúc thư mục tổng thể: app router / pages, layout admin, nơi khai báo route.
2. File hiện tại của trang /admin/posts và toàn bộ component con của nó.
3. Các trang admin KHÁC đã hoàn chỉnh hơn (ví dụ: Tổng quan, Quản lý nội dung,
   Quản lý người dùng, Quản lý doanh thu, Lịch đăng bài) — đọc để nắm:
    - Cách dựng page layout (header, breadcrumb, khoảng cách, container)
    - Component stat card / KPI card + sparkline đang dùng gì
    - Component bảng (table) dùng chung: pagination, sort, empty state, loading skeleton
    - Component filter bar: date-range picker, dropdown, nút "Bộ lọc", "Xuất báo cáo"
    - Component drawer / side panel chi tiết (nếu đã có ở trang khác)
    - Badge / Tag trạng thái và bảng màu (variant) đang quy ước
4. Design system: file tailwind config, theme token, biến màu, typography,
   quy ước spacing, icon set đang dùng (lucide? heroicons?), thư viện UI
   (shadcn/ui? antd? MUI?), thư viện chart (recharts? chart.js?).
5. Tầng data: API/service layer, hook fetch (react-query? swr? fetch thuần?),
   type/interface của Post, RejectedPost, PlatformError; các endpoint hiện có
   liên quan đến bài đăng lỗi/bị từ chối. Ghi rõ endpoint nào ĐÃ CÓ và
   endpoint nào CÒN THIẾU so với thiết kế.
6. Quy ước đặt tên file/component/hook/type, cách tổ chức i18n (trang đang
   có nút "Tiếng Việt" nên có thể đã có i18n — kiểm tra key namespace).

Xuất ra một bản KHẢO SÁT + KẾ HOẠCH TRIỂN KHAI (danh sách file sẽ tạo/sửa,
component tái sử dụng được, chỗ cần bổ sung). DỪNG LẠI và đợi tôi duyệt.

## GIAI ĐOẠN 2 — YÊU CẦU GIAO DIỆN (sau khi tôi duyệt)
Dựng lại trang theo mẫu, gồm các khối sau từ trên xuống:

A. Header trang
- Tiêu đề "Bài đăng lỗi & bị từ chối" + mô tả phụ
- Giữ nguyên header chung của admin (search, đổi ngôn ngữ, chuông thông báo, avatar)

B. Tab bar
- "Bị từ chối" (kèm badge số lượng) | "Lỗi hệ thống" (kèm badge số lượng)
- Bên phải cùng hàng: date-range picker (mặc định 7 ngày gần nhất),
  nút "Bộ lọc", nút "Xuất báo cáo"

C. 4 thẻ KPI (grid 4 cột, responsive về 2 cột / 1 cột)
- Tổng bài bị từ chối
- Vi phạm chính sách
- Lỗi kỹ thuật
- Người dùng bị ảnh hưởng
  Mỗi thẻ: icon trong khối bo tròn nhạt, số lớn, % thay đổi so với kỳ trước
  (mũi tên lên đỏ / xuống xanh) + sparkline mini bên phải.

D. Thanh filter nhanh (theo ảnh 3)
- Dropdown "Tất cả nền tảng" + các chip nền tảng: Facebook, Instagram,
  TikTok, Threads (có logo)
- Dropdown "Tất cả trạng thái"
- Dropdown sắp xếp "Mới nhất"

E. Bảng danh sách
Cột: Bài viết (thumbnail + tiêu đề + trích đoạn + mã #ID) | Nền tảng (logo)
| Người dùng | Lý do từ chối (badge phân loại + mô tả 2 dòng)
| Thời gian (ngày + giờ) | Trạng thái | Hành động (nút "Chi tiết" + menu ⋮)
Badge phân loại lý do: Vi phạm chính sách, Lỗi kỹ thuật, Nội dung bị cấm,
Vi phạm bản quyền, Quảng cáo bị hạn chế — mỗi loại 1 màu riêng, khai báo
tập trung ở 1 map constant, không hardcode rải rác.
Footer bảng: chọn số mục/trang (10/20/50) + pagination.

F. Drawer "Chi tiết bài viết" (mở khi bấm "Chi tiết", theo ảnh 3)
- Thumbnail + tiêu đề + #ID + nền tảng + thời gian
- Trạng thái
- Lý do từ chối (badge + mô tả)
- "Chi tiết vi phạm": danh sách bullet
- Khối "Đề xuất từ AI": gợi ý chỉnh sửa + nút "Xem gợi ý chỉnh sửa"
- Hành động: "Chỉnh sửa & gửi lại" (primary), "Sao chép nội dung" (secondary),
  "Xóa bài viết" (destructive)

G. Tab "Lỗi hệ thống": tái sử dụng cùng bộ khung (KPI + filter + bảng) nhưng
cột và badge phù hợp với lỗi hệ thống (mã lỗi, service, số lần retry...).
Nếu backend chưa có dữ liệu, dựng UI + mock theo đúng type đã định nghĩa.

## RÀNG BUỘC BẮT BUỘC
- Tuân thủ tuyệt đối cấu trúc thư mục, quy ước đặt tên, coding style hiện có
  của dự án (đọc file rule/lint/CONTRIBUTING/AGENTS.md/CLAUDE.md nếu có).
- ƯU TIÊN TÁI SỬ DỤNG component có sẵn. Chỉ tạo component mới khi thực sự
  chưa có; component mới phải đặt đúng thư mục dùng chung nếu có khả năng
  tái sử dụng.
- Dùng đúng thư viện đang có trong package.json. Nếu bắt buộc phải thêm
  thư viện mới → nêu lý do, so sánh 2 lựa chọn và hỏi tôi trước khi cài.
- Đồng bộ 100% với design system: màu, radius, shadow, spacing, font, icon.
  Không hardcode màu hex nếu đã có token.
- Toàn bộ text đi qua i18n theo đúng namespace hiện tại, không hardcode chuỗi.
- TypeScript strict: định nghĩa đầy đủ type/interface, không dùng any.
- Xử lý đủ các state: loading (skeleton), empty, error, và responsive
  (desktop / tablet / mobile).
- Tách logic fetch/filter ra custom hook, giữ component thuần trình bày.
- Không phá vỡ hay chỉnh sửa các trang admin khác.

## CÁCH LÀM VIỆC
- Làm từng bước, mỗi bước commit logic riêng, giải thích ngắn gọn thay đổi.
- Sau Giai đoạn 1, dừng chờ tôi duyệt kế hoạch.
- Cuối cùng: liệt kê file đã tạo/sửa, các endpoint backend còn thiếu cần bổ sung,
  và hướng dẫn chạy thử.