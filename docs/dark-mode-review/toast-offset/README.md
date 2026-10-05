# Toast dưới header — 2026-10-05

Thông báo góc phải nằm dưới header AppShell 16px: top 86px từ 760px trở lên,
78px trên mobile. Header và toast cùng đọc `--app-header-height` trong CSS.
Khi khung app mount sau login, toast hiện có cũng chuyển xuống ngay.

Chrome/API fixture: 6 tổ hợp 1440/760/390px × sáng/tối đạt. Kiểm tra login thực qua
form với API giả lập, success/error/warning/info/loading, stack, cuộn, resize và admin.
Trang chưa có AppShell giữ top 16px. Số đo: [results.json](results.json).
22/22 test và build đạt. Không tác động backend/dữ liệu thật, không commit.

- [Desktop tối](login-1440-dark.png)
- [Mobile tối](login-390-dark.png)

Chạy QA frontend port 3100, rồi `node frontend/scripts/dark-mode/verify-toast-offset.mjs`.
