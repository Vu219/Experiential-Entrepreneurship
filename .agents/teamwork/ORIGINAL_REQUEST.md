# Original User Request

## 2026-10-20T05:48:11Z

Lưu trữ và duy trì kết quả đánh giá Brand Voice (điểm số, nhận xét, độ phù hợp) trong suốt vòng đời nội dung, đảm bảo trong Quản lý nội dung (`ContentViewPanel`) hiển thị đầy đủ thông tin Brand Voice và cho phép lưu/kiểm tra lại.

Working directory: d:/SU26/EXE
Integrity mode: development

## Requirements

### R1. Kế thừa Brand Voice khi định dạng nội dung theo nền tảng
Khi hệ thống thực hiện định dạng nội dung cho các nền tảng mạng xã hội (từ bản gốc đã sinh sang các phiên bản nền tảng), các chỉ số Brand Voice (`voice_aligned`, `voice_score`, `voice_notes`) phải được kế thừa đầy đủ từ bản gốc thay vì bị reset về rỗng/null.

### R2. Hỗ trợ lưu trữ và cập nhật Brand Voice qua API
Hệ thống backend phải cho phép lưu trữ và cập nhật các trường dữ liệu Brand Voice của từng phiên bản nội dung (`content_versions`) khi người dùng chỉnh sửa hoặc chạy kiểm tra lại, bảo đảm tính toàn vẹn dữ liệu trong cơ sở dữ liệu.

### R3. Hiển thị và tương tác Brand Voice trong Quản lý nội dung
Trong màn hình chi tiết bài viết của Quản lý nội dung (`ContentViewPanel`):
- Hiển thị trực quan panel Brand Voice với điểm số % và nhận xét thực tế từ dữ liệu phiên bản.
- Hỗ trợ thao tác kiểm tra lại / đồng bộ Brand Voice khi người dùng chỉnh sửa nội dung bài viết và lưu lại.

## Acceptance Criteria

### Tính toàn vẹn của dữ liệu Brand Voice
- [ ] Sau khi sinh nội dung và hoàn tất bước định dạng (Platform Formatting), các bản ghi `content_versions` trong cơ sở dữ liệu vẫn lưu giữ đầy đủ `voice_score`, `voice_notes`, và `voice_aligned`.
- [ ] Khi truy cập màn hình Quản lý nội dung và xem chi tiết bài viết, panel "Kiểm tra brand voice" hiển thị thông tin thực tế (thanh tiến trình %, huy hiệu phù hợp/cần xem lại, nhận xét chi tiết) thay vì trạng thái "Chưa kiểm tra" hoặc trống dữ liệu.

### Chỉnh sửa và kiểm tra lại
- [ ] Khi chỉnh sửa nội dung bài viết (caption, script, hashtags, cta) và lưu trong Quản lý nội dung, dữ liệu Brand Voice tương ứng được cập nhật và lưu bền vững vào cơ sở dữ liệu.
- [ ] Chức năng kiểm tra Brand Voice có thể kích hoạt và phản ánh điểm số/nhận xét mới lên giao diện và DB.

### Kiểm thử và tính tương thích
- [ ] Toàn bộ test suite backend (`mvn test-compile` / unit tests liên quan) chạy thành công.
- [ ] Frontend biên dịch thành công (`npm run build`) không có lỗi type hoặc lint.
- [ ] Tuân thủ quy chuẩn mã nguồn, kiến trúc đa nền tảng và tài liệu của dự án.
