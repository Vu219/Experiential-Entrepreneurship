# Dark mode — kiểm tra cuối 2026-10-05

Đã hoàn tất app/admin/public và các phản hồi giao diện. Không commit, không triển khai.
`VITE_ENABLE_DARK_MODE` mặc định true; lựa chọn mặc định vẫn Sáng. Đặt cờ false để giữ toàn bộ trang sáng.
API được chặn bằng fixture, không thao tác tài khoản hoặc dữ liệu backend thật.
Server QA đã dừng; các script sửa một lần và log tạm đã xoá. Build QA cờ false ở
`frontend/.dark-mode-flagoff-dist` còn giữ lại do chính sách công cụ chặn xoá thư mục.

| Phạm vi | Kết quả / bằng chứng |
|---|---|
| Unit tests + TypeScript/production build | `npm test` 22/22, `npm run build` đạt |
| 42 route, 1440/390px, sáng/tối | 168 trường hợp không lỗi JS/chế độ sai — [current-results.json](current-results.json) |
| Dialog/tab/menu và trạng thái phụ | 38 trường hợp — [interactions/results.json](interactions/results.json) |
| Landing, 3 theme × 2 mode × 2 viewport | 12 trường hợp; logo dark đúng, bản in sáng — [landing/current-results.json](landing/current-results.json) |
| FailedPosts, dữ liệu hỗn hợp/chỉ policy/chỉ technical/rỗng | 16 trường hợp sáng/tối desktop/mobile — [failed-posts/results.json](failed-posts/results.json) |
| Login/Register/ForgotPassword, 2 ngôn ngữ × 2 mode × 5 viewport | 60 kiểm tra nút ngôn ngữ hiển thị, không chồng nút mode — [auth-controls/results.json](auth-controls/results.json) |
| Cột phụ nội dung: nguồn/tạo/hoàn thiện/lên lịch/chi tiết | 20 trạng thái sáng/tối desktop/mobile — [content-asides/results.json](content-asides/results.json) |
| Cờ production | 7 route với cờ bật và 7 route với cờ false; mode/control đúng, không lỗi JS |
| Token | Mọi tham chiếu `--c-*` có khai báo; 376 token — [token-catalog.json](token-catalog.json) |

Kiểm tra chuyển Sáng/Tối/Theo hệ thống, lưu/reload, đổi OS, bàn phím, 6 viewport 1440–320px,
SVG và print đã đạt trong runner `verify.mjs`/`verify-settings.mjs`. Bài test tương phản gồm 50 cặp
chữ/nhãn trên nền trung tính; đây không phải kiểm toán WCAG toàn ứng dụng.

## Các điều chỉnh theo phản hồi

- Landing header/footer dùng `/aima-v-dark.png` khi tối; footer và CTA cuối có gradient tối dịu,
  title/body/button dùng token riêng. Print chuyển palette/logo về sáng.
- Tổng quan lỗi: bỏ circle trắng ở tâm donut, làm rõ tổng lỗi, chú giải và các hàng mã lỗi.
- Login và các màn dùng cùng bố cục: dịch nút ngôn ngữ 36px sang trái ở desktop khi cờ bật;
  khoảng cách tới nút mode tối thiểu 24px. Cờ tắt giữ vị trí cũ.
- Chi tiết nội dung và wizard: các card nguồn, brand voice, preview, tổng quan nguồn,
  readiness/trạng thái dùng gradient và viền của card AI ở hồ sơ thương hiệu.
  Tăng tương phản nhãn; khung feed bên trong preview vẫn dùng nền riêng, phân cấp rõ với card ngoài.

| Ảnh | Nội dung |
|---|---|
| [Chi tiết nội dung tối](content-asides/detail-1440-dark.png) | Cột phải sau chỉnh |
| [Wizard hoàn thiện tối](content-asides/finalize-1440-dark.png) | Preview và readiness nổi bật |
| [Tổng quan lỗi tối](failed-posts/1440-dark-mixed.png) | 14 lỗi, tỷ lệ 5/9 |
| [Login tối](auth-controls/1919-dark.png) | Hai nút không chồng nhau |
| [CTA tối](landing/cta-1440-dark-ocean.png) | Banner cuối Landing |
| [Footer tối mobile](landing/footer-390-dark-ocean.png) | Logo/nền/chữ |

## Đối chiếu sáng

Baseline: HEAD `e0562ed`, API fixture và đồng hồ cố định, font được chờ nạp; ẩn selector mới để so.
Trước các yêu cầu đổi hình thức riêng: **41/42 ảnh có 0 pixel CIEDE2000 >3**, max của các ảnh đó ≤2,8874.
[Báo cáo trước phản hồi](light-comparison-before-feedback.json) giữ kết quả này.
Ảnh Wizard còn 160 pixel ở hai icon của cụm nút sticky do dịch y **0,46875px**;
màu, kích thước và font không đổi: [wizard-svg-geometry.json](wizard-svg-geometry.json).

Các thay đổi card FailedPosts, dịch nút ngôn ngữ và tô nền cột phụ nội dung được người dùng yêu cầu
sau đối chiếu, nên không áp tiêu chí giữ nguyên bố cục sáng cho các vùng đó.
[light-comparison.json](light-comparison.json) ghi chênh lệch sau các chỉnh sửa này.
CTA/Footer sáng kiểm tra riêng desktop/mobile: **0 pixel ΔE2000 >3**, max 1,7579 —
[landing/light-comparison.json](landing/light-comparison.json).

Đây là kiểm tra frontend với fixture. Google callback và billing return có ảnh trạng thái lỗi đầu vào
có chủ đích; không xác minh Google OAuth, gửi bài, email hoặc giao dịch backend thật.

Phản hồi bổ sung 2026-10-05: hai palette thay bằng Tím sương/Hồng sương, đồng bộ foreground
trên nền pastel; [báo cáo palette](../brand-palettes/README.md) có 12 kiểm tra Settings và 64 trường hợp
trên 8 route. Toast nằm dưới header 16px, [6 tổ hợp login/responsive](../toast-offset/README.md) đạt.
22/22 test và build đạt. Không commit.
