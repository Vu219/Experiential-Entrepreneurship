# Prompt cho Claude Code — Refactor UI/UX dự án AIMA

Bạn đang làm việc trên dự án **AIMA — AI Content Marketing** (Next.js, chạy ở `localhost:3000`, UI tiếng Việt).
Hệ thống có 2 khu vực: **App người dùng** (`/dashboard`, `/usage`, `/failed-posts`, ...) và **Admin** (`/admin/*`).

Hãy thực hiện các thay đổi dưới đây. **Trước khi sửa, hãy khảo sát codebase** để tìm layout component, sidebar component, design tokens/theme, và các trang liên quan; báo cho tôi kế hoạch file sẽ sửa rồi mới làm. Ưu tiên sửa ở tầng layout dùng chung thay vì sửa lặp lại từng trang.

---

## 1. Chuẩn hoá khung layout nội dung (áp dụng TOÀN BỘ các tab, cả app lẫn admin) [x]

Vấn đề: trên màn hình PC rộng, vùng nội dung bị đẩy quá xa sidebar, card trải rộng và loãng, khoảng cách không đồng nhất giữa các trang.

Yêu cầu:
- Tạo (hoặc chuẩn hoá lại nếu đã có) một component dùng chung `PageContainer` / `PageShell` đảm nhiệm toàn bộ padding và max-width của vùng nội dung.
- Quy ước:
  - `max-width` vùng nội dung: **1440px**, căn trái theo sidebar (không `mx-auto` để nội dung không bị trôi ra giữa màn hình rộng).
  - Padding trái sát sidebar: **24px** ở `lg`, **32px** ở `2xl`. Padding phải tương ứng.
  - Padding trên đầu trang: **24px**. Khoảng cách dọc giữa các section/card: **24px** (một token duy nhất, không mỗi trang một kiểu).
- Refactor **tất cả** các trang để dùng component này, xoá các `padding`/`max-w`/`margin` hardcode rải rác.
- Header trang (tiêu đề + mô tả, ví dụ "Bảng điều khiển / Trung tâm điều khiển nội dung") phải căn thẳng hàng trái với card đầu tiên bên dưới.

Kiểm tra chấp nhận: mở lần lượt `/dashboard`, `/usage`, `/failed-posts`, `/admin`, `/admin/users`, `/admin/usage`, `/admin/system` ở 1920px — lề trái nội dung của tất cả các trang phải trùng khớp pixel-perfect.

---

## 2. Căn thẳng logo sidebar với header [x]

Vấn đề: logo AIMA ở đầu sidebar đang lệch so với khối "Bảng điều khiển / Trung tâm điều khiển nội dung" bên phải.

Yêu cầu:
- Khối logo trong sidebar và khối header của vùng nội dung phải có **cùng chiều cao cố định** (ví dụ `h-16` / 64px, chọn theo giá trị đang có sẵn trong code) và **cùng trục căn giữa theo chiều dọc**.
- Đường kẻ dưới (border-bottom) của sidebar header và của topbar phải nằm cùng một đường ngang.
- Kiểm tra ở cả trạng thái sidebar mở rộng và sidebar thu gọn (nút collapse hình mũi tên).

---

## 3. Chia cụm sidebar cho app người dùng [x]

Vấn đề: sidebar app hiện là một danh sách phẳng, trong khi sidebar admin đã có nhóm ("VẬN HÀNH NỘI DUNG", "NGƯỜI DÙNG & DOANH THU", ...).

Yêu cầu: chia sidebar app thành các cụm với style nhãn nhóm **giống hệt** sidebar admin (chữ hoa nhỏ, màu nhạt, letter-spacing):

```
TỔNG QUAN
  - Bảng điều khiển
  - Phân tích
  - Xu hướng

NỘI DUNG
  - Quản lý nội dung
  - Lịch đăng bài            (giữ badge số)
  - Bài lỗi & cần xử lý

THƯƠNG HIỆU
  - Hồ sơ thương hiệu
  - Kênh kết nối             (nếu đã có route; nếu chưa, bỏ qua mục này)

TÀI KHOẢN (ko bỏ vào sidebar vì đã có trong dropdown bên góc phải)
  - Cài đặt                  (chứa Token & mức dùng — xem mục 7)
```

- Mục **Quản trị hệ thống** giữ nguyên vị trí ghim ở đáy sidebar, tách khỏi các cụm trên bằng một divider.
- Component sidebar của app và của admin nên dùng chung một `SidebarSection` / `SidebarItem` để đảm bảo đồng bộ về sau.

---

## 4. Sửa nút "Quay lại ứng dụng" bị che khi hover [x]

Vấn đề: ở khu vực admin, khi hover vào card/nút "Quay lại ứng dụng", phần trên của nó bị cắt mất.

Yêu cầu:
- Tìm nguyên nhân: nhiều khả năng do container cha có `overflow: hidden`, hoặc do hiệu ứng hover có `transform: translateY(-Nx)` khiến phần tử tràn ra ngoài vùng clip, hoặc do `z-index` thấp hơn header.
- Sửa bằng cách: bỏ `overflow-hidden` ở container cha (hoặc đổi thành `overflow-visible`), thêm padding-top cho vùng chứa đủ chỗ cho hiệu ứng hover, và nâng `z-index` của phần tử khi hover.
- Đảm bảo shadow / glow khi hover hiển thị đầy đủ 4 phía.

---

## 5. Tab "Token & hạn mức" (admin) — Heatmap và mục "Theo gói" [x]

### 5a. Chú thích màu cho Heatmap [x]
- Thêm **legend thang màu** vào **bên trong card Heatmap**, đặt ở hàng ngay **dưới** nhóm nút `Token | Request | Chi phí | Latency TB`, căn phải cho cùng trục với nhóm nút đó.
- Legend dạng thang gradient rời rạc 5 bậc, kèm nhãn hai đầu: `Ít` → `Nhiều`, và hiển thị giá trị thực tế của bậc cao nhất (ví dụ `0` ... `12.4K token`).
- Legend phải **đổi đơn vị theo tab đang chọn**: token → số token, Request → số request, Chi phí → USD, Latency TB → ms.
- Thêm tooltip khi hover từng ô: ngày, khung giờ, giá trị.
- Áp dụng **cùng legend đó** cho heatmap trong trang chi tiết từng người dùng (`/admin/usage/users/[id]`, card "Hoạt động 7 ngày × 24 giờ").

### 5b. Thiết kế lại mục "Theo gói" [x]
Vấn đề hiện tại: trang trộn lẫn *cấu hình gói* (vốn thuộc trang Quản lý gói) với *mức tiêu thụ thực tế*. Cột "So tổng trần" tính `token dùng / (số user × hạn mức)` nên gói Free luôn hiện 100% đỏ — chỉ số này gây hiểu nhầm và không dẫn tới hành động nào.

Yêu cầu: thiết kế lại thành bảng **giám sát tiêu thụ theo gói**, chỉ đọc, bỏ hoàn toàn phần trùng lặp với Quản lý gói (chỉ giữ một link nhỏ "Sửa hạn mức gói →" trỏ sang trang Quản lý gói).

Các cột mới:

| Cột | Ý nghĩa |
|---|---|
| Gói | Tên gói + badge màu |
| Số user | Số user đang ở gói |
| Hạn mức/user | Chỉ đọc |
| Tổng hạn mức cấp phát | `số user × hạn mức/user` |
| Token đã dùng | Token thực dùng kỳ này + % so với tổng hạn mức cấp phát |
| Chi phí | Tổng chi phí + chi phí trung bình/user |
| User cần chú ý | `N user ≥ 80%` · `M user đã chạm trần` — đây là cột hành động chính, tô màu cảnh báo |

- Thanh progress giữ lại nhưng chỉ dùng cho cột "Token đã dùng", và **chỉ tô đỏ khi thực sự vượt 100%**, vàng ở 80–100%, xanh dưới 80%.
- Mỗi dòng gói cho phép click để mở drill-down: danh sách user thuộc gói đó, sắp xếp theo % tiêu thụ giảm dần.
- Thêm một hàng "Tổng cộng" ở cuối bảng.
- Bổ sung bộ chọn kỳ (kỳ này / kỳ trước / 30 ngày) áp dụng chung cho toàn bộ tab.

---

## 6. Trang "Trạng thái hệ thống" (`/admin/system`) — realtime [x]

Vấn đề: số liệu chỉ cập nhật khi reload trang.

Yêu cầu:
- Chuyển các chỉ số sang cập nhật tự động. Ưu tiên **SSE hoặc WebSocket** nếu backend hỗ trợ; nếu không, dùng polling qua React Query / SWR với `refetchInterval`:
  - Cơ sở dữ liệu (PostgreSQL), Redis, Bộ máy AI: **5 giây**
  - Tài nguyên container (CPU, heap, đĩa): **5 giây**
  - Sức khoẻ cấu hình AI, Hoạt động hệ thống, Cảnh báo: **15 giây**
- Thêm chỉ báo "đang live": chấm xanh nhấp nháy + dòng chữ nhỏ `Cập nhật lúc HH:mm:ss`, và nút tạm dừng/tiếp tục auto-refresh.
- Khi giá trị thay đổi, dùng transition số mượt (count-up ngắn ~300ms) thay vì nhảy giật; **không** hiển thị skeleton loading ở mỗi lần refetch (chỉ ở lần tải đầu), tránh nhấp nháy.
- Xử lý lỗi: nếu một lần poll thất bại, giữ giá trị cũ và hiện badge "mất kết nối", tự retry với backoff.

Bổ sung cho card **"Hoạt động hệ thống"**:
- Thêm **tỉ lệ lỗi (%)** bên cạnh số lỗi tuyệt đối — số 11 lỗi không có mẫu số thì không đánh giá được.
- Thêm **latency p50 / p95 / p99** thay vì chỉ trung bình.
- Thêm **throughput (request/phút)** dạng sparkline.
- Thêm **hàng đợi job**: số job đang chờ / đang chạy / thất bại — hiện tại chỉ có một số "0 Job" không rõ nghĩa.
- Thêm **uptime** và thời điểm sự cố gần nhất.
- Biểu đồ hiện đang dồn toàn bộ cột vào một mốc thời gian: sửa lại để trục thời gian trải đều theo khoảng đã chọn (1 giờ / 24 giờ / 7 ngày / 30 ngày / 1 năm) và hiển thị nhãn trục X ở nhiều mốc, không chỉ hai đầu.
- Danh sách Cảnh báo: gộp các lỗi trùng nhau thành một dòng kèm số lần lặp (`×11`) thay vì liệt kê 5 dòng giống hệt, và rút gọn stack trace có nút "xem chi tiết".

---

## 7. Đưa "Token & mức dùng" vào trang Cài đặt [x]

Yêu cầu:
- Bỏ mục "Token & mức dùng" khỏi danh sách điều hướng chính của sidebar app; đưa nó thành **một tab bên trong trang Cài đặt** (cụm `TÀI KHOẢN`).
- Trang Cài đặt tổ chức theo tab dọc hoặc ngang: `Hồ sơ` · `Token & mức dùng` · `Gói & thanh toán` · `Thông báo` · `Bảo mật`.
- Giữ route cũ `/usage` nhưng **redirect** sang `/settings/usage` để không vỡ link cũ.
- Giữ nguyên widget tóm tắt token ở đáy sidebar, cho click để nhảy thẳng vào tab này.

Cải tiến nội dung tab Token & mức dùng:
- **Dự báo cạn hạn mức**: dựa trên tốc độ dùng trung bình 7 ngày, hiển thị "Với tốc độ hiện tại, bạn sẽ dùng hết hạn mức vào khoảng ngày DD/MM" — hoặc "Dự kiến dùng ~X% hạn mức kỳ này".
- **So sánh với kỳ trước**: mũi tên tăng/giảm kèm %, và biểu đồ đường chồng kỳ này vs kỳ trước.
- **Breakdown theo model** bên cạnh breakdown theo tính năng đang có.
- **Giải thích token quy đổi**: hiện tại chuỗi "token thô — chưa quy đổi hạn mức" xuất hiện nhiều nơi mà không giải thích. Thêm tooltip/accordion nói rõ token thô khác token tính vào hạn mức thế nào, kèm hệ số quy đổi đang áp dụng.
- **Cảnh báo ngưỡng**: banner khi vượt 80% hạn mức, kèm CTA "Nâng gói" / "Mua thêm token".
- **Lịch sử các kỳ trước** dạng bảng (kỳ, token dùng, % hạn mức, chi phí) + nút xuất CSV.
- Bỏ card "1M / Hạn mức kỳ này" đứng riêng — thông tin này đã lặp lại 3 lần trên cùng màn hình (card, thanh progress, card Gói hiện tại). Gộp còn một chỗ.

---

## 8. Tab "Bài lỗi & cần xử lý" (`/failed-posts`) [x]

- **Thiếu header**: trang này không có khối tiêu đề ở topbar như các trang khác (`Bảng điều khiển / Trung tâm điều khiển nội dung`). Thêm `Bài lỗi & cần xử lý` + mô tả phụ, dùng đúng component header dùng chung.
- **Bảng bị cắt cột "Trạng thái"**: hiện phải cuộn ngang mới thấy. Sửa:
  - Cho bảng dùng `table-layout: fixed` với tỉ lệ cột hợp lý; cột "Bài viết" co giãn và `truncate` bằng ellipsis (kèm tooltip full text), các cột còn lại rộng cố định.
  - Cột "Lý do thất bại" hiện bị cắt giữa chừng (`Nội dung vi phạm Tiêu...`) — rút gọn bằng ellipsis có tooltip thay vì cắt cứng.
  - Nếu vẫn không đủ chỗ: ghim cột "Trạng thái" bằng `position: sticky; right: 0` với nền và shadow trái để luôn nhìn thấy.
  - Dưới `lg`, chuyển bảng sang dạng danh sách card thay vì cuộn ngang.
  - Hai badge "Failed" và "Vi phạm CS/Lỗi kỹ thuật" đang xếp chồng gây cao dòng: gộp thành một badge duy nhất hoặc xếp ngang.

---

## Ràng buộc chung
- Tuân thủ cấu trúc code, thư mục, rule
- Giao diện đồng bộ
- **Không đổi logic nghiệp vụ, không đổi API contract** trừ những chỗ nêu rõ ở mục 6 (realtime) và 5b (dữ liệu cột mới — nếu backend chưa có, hãy tính ở client từ dữ liệu sẵn có và ghi chú lại chỗ nào cần API bổ sung).
- Giữ nguyên hệ màu, gradient tím–xanh và ngôn ngữ thiết kế hiện tại.
- Toàn bộ chuỗi hiển thị bằng tiếng Việt, đi qua hệ thống i18n đang dùng (có nút chuyển "Tiếng Việt") — **không hardcode chuỗi**.
- Đảm bảo dark mode (nếu dự án có) không vỡ.
- Sau khi xong, chạy build/lint và liệt kê cho tôi: các file đã sửa, các chỗ cần API backend bổ sung, và những quyết định thiết kế bạn tự chọn.

## Thứ tự thực hiện đề nghị

1. Mục 1 + 2 (layout nền tảng, ảnh hưởng mọi trang)
2. Mục 3 + 7 (cấu trúc điều hướng)
3. Mục 4 + 8 (lỗi hiển thị cụ thể)
4. Mục 5 (heatmap + theo gói)
5. Mục 6 (realtime, phức tạp nhất)

Làm xong từng nhóm thì dừng lại báo cáo trước khi sang nhóm tiếp theo.
