# Dark mode — đợt 2, 2026-10-05

Đợt 1 được duyệt; đợt 2 hoàn tất: component dùng chung và Cài đặt › Giao diện. Chưa commit.

- [Cài đặt trong ứng dụng](settings-app-dark.png)
- [Cài đặt mobile](settings-dark-390.png)
- [Lịch chọn ngày mobile](date-dark-390.png)
- [Đổi mật khẩu mobile](password-new-dark-390.png)
- [Toast mobile](toast-dark-390.png)
- [Onboarding](onboarding-dark-1440.png)
- [Kết quả so ảnh và API fixture](results.json)

22/22 test, build đạt; 50 cặp chữ/nền tối kiểm tra đạt ≥4,5:1. Các luồng tương tác desktop/mobile
và đồng bộ Settings/topbar/reload/print đạt. Production cờ tắt ẩn cả hai control và luôn sáng.

18 ảnh sáng so với HEAD `e0562ed`: 0 pixel ΔE2000 >3, max 2,343140. Selector mới được ẩn trong
ảnh so sánh. Các ảnh modal/drawer dùng nội dung QA tối giản để kiểm tra frame/focus/scroll;
các form con do trang chưa migrate truyền vào vẫn cần kiểm tra ở từng đợt tiếp theo.
POST đổi mật khẩu dùng fixture, không thay đổi tài khoản thật. ShareButton chỉ thuộc landing khoá sáng.

Các tab Settings khác, Create/CreateWizard và các trang app/admin còn lại chưa được migrate trong đợt này.
Cách tái chạy ở [README công cụ QA](../../../frontend/scripts/dark-mode/README.md).
