# Dark mode — ảnh và báo cáo

**Hiện tại (2026-10-05): hoàn tất app/admin/public và phản hồi giao diện, không commit.**
Cờ mặc định bật, lựa chọn ban đầu Sáng. Xem [báo cáo cuối](final/README.md) và ảnh trong `final/`.

## Dashboard — bản duyệt đợt 1 (lịch sử)

Kiểm tra ngày 2026-10-04. Chưa commit, cờ production mặc định tắt.
Các ảnh dùng API fixture, đồng hồ cố định; không phải dữ liệu tài khoản thật.

| Ảnh | Mục đích |
|---|---|
| [Dashboard sáng](dashboard-light.png) | Bản sáng có nút chuyển trong môi trường QA |
| [Dashboard tối](dashboard-dark.png) | Nền/card/chữ/badge/chart/sidebar/topbar |
| [Tooltip tối](dashboard-dark-tooltip.png) | Tooltip Recharts khi hover |
| [Mobile tối, 390px](dashboard-dark-mobile.png) | Topbar gọn, nội dung xếp dọc |
| [HEAD sáng](dashboard-baseline-light.png) | Baseline commit `e0562ed` |
| [Bản mới sáng, ẩn nút chuyển](dashboard-light-no-toggle.png) | So với baseline khi cờ production tắt |
| [Diff sáng](dashboard-light-diff.png) | Vàng = khác trong dung sai, đỏ = CIEDE2000 >3 |

`npm test`: **22/22**. `npm run build`: thành công.
Chrome kiểm tra chuyển Sáng/Tối/Theo hệ thống, lưu/reload, thay đổi OS, bàn phím
(mũi tên/Home/End/Tab/Escape), topbar/menu ở 6 chiều rộng 1440–320px,
SVG nhận màu token, bản in sáng, các route public/auth sáng, không lỗi JavaScript.
Bản build khi không đặt cờ vẫn sáng và ẩn nút dù đã lưu lựa chọn tối.

So ảnh với HEAD bằng CIEDE2000: **0 pixel >3**, cao nhất **2,5039**.
317 pixel vượt ΔE76 =3 thuộc icon tìm kiếm (30), dòng so sánh số liệu (256),
icon hoạt động trống (31); đều do `#a39bbf` gộp thành `#9b94b5` theo bảng màu.
Xem số liệu đầy đủ trong [light-comparison.json](light-comparison.json).
Text rasterization được cố định và font được chờ tải để tránh nhiễu chữ đậm.

Đã chỉnh 4 token tối cho chữ phụ và trục chart, kiểm tra 35 cặp chữ/nền trung tính
đạt ≥4,5:1. Đây là kiểm tra phần đang migrate, chưa phải kiểm toán WCAG toàn app.
Ví dụ: chữ phụ trên nền phụ 4,99:1; nhãn trục trên card 5,98:1;
chữ muted trên vùng nền nhẹ 6,25:1; tiêu đề trên card 15,95:1.
Ảnh mẫu gốc từ phiên trước chưa có ở phiên này; ảnh hiện tại được đối chiếu với bảng token
và baseline HEAD. **Chờ người dùng duyệt hình thức trước khi migrate thêm các trang.**

Cách chạy lại: [frontend/scripts/dark-mode/README.md](../../frontend/scripts/dark-mode/README.md).
