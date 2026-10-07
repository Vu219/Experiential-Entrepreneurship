# Hướng dẫn cấu hình webhook Facebook Page (`feed`) cho AIMA

> Cập nhật 2026-10-07 (đã test thật thành công) · Thuộc analytics dữ liệu thật **Giai đoạn 3** (`analytics-real-data-plan.md` mục D.7).
> Mục tiêu: Meta báo ngay cho AIMA khi Trang có bài mới, bài bị xoá, hoặc có bình luận / cảm xúc / chia sẻ, để AIMA đồng bộ
> số liệu sớm thay vì chờ lịch. Webhook **không mang số đếm** — số vẫn lấy qua Graph API như cũ.
>
> **Không có webhook thì AIMA vẫn chạy đúng**, chỉ chậm hơn: quét Trang 1 giờ/lần, đồng bộ bài theo lịch thưa dần, nút "Làm mới".

---

## 1. AIMA làm gì khi nhận webhook

| Sự kiện Meta (`changes[].value`) | AIMA làm |
|---|---|
| `item` = status/post/photo/video, `verb=add` | Quét danh sách bài của Trang ở lượt job kế tiếp (≤ 5 phút) → bài tự đăng hiện trên trang Phân tích |
| `item` = comment/reaction/share/like (mọi `verb`) trên bài đang theo dõi | Đồng bộ số liệu bài đó sau ~5 phút (gom nhiều sự kiện liên tiếp thành một lần gọi Meta) |
| `item` = status/post/photo/video, `verb=remove` | Trạng thái riêng **"Đã xoá trên nền tảng"** (nhãn xám, trung tính) + ngừng đồng bộ, giữ số liệu cuối cùng đã thu. **Không** đổi trạng thái bài AIMA (không FAILED) và **không** gửi thông báo "bị nền tảng gỡ" — Meta không cho biết bài bị gỡ hay người dùng tự xoá |
| Sự kiện test từ App Dashboard (`entry.id` = `0`) | Chỉ lưu với trạng thái `IGNORED` để biết webhook đã thông — không xử lý, không ghi log lỗi |
| Còn lại / Trang không kết nối với AIMA | Bỏ qua (vẫn lưu `IGNORED` để soi lại) |

**Cách xử lý (an toàn + nhanh):**
- Chữ ký `X-Hub-Signature-256` = HMAC-SHA256(**App Secret**, body) được kiểm **trước mọi thứ**. Sai / thiếu → bỏ qua (vẫn trả 200 để Meta không gửi lại payload hỏng), ghi `system_logs` module `webhook.meta`.
- Mỗi thay đổi lưu một dòng `meta_webhook_events` (khoá chống trùng = SHA-256 của id Trang + thời điểm + nội dung) → **trả 200 ngay**.
  Meta gửi lại cùng payload → bị bỏ qua.
- Worker nền (`metaWebhookExecutor`) xử lý; sự kiện còn `PENDING` quá 2 phút (app khởi động lại, hàng đợi đầy) được `MetaWebhookEventJob` (mỗi phút) xử lý lại, tối đa 3 lần rồi `FAILED`.
- Khi kết nối Facebook, AIMA tự gọi `POST /{page-id}/subscribed_apps?subscribed_fields=feed` cho từng Trang (sau khi lưu kết nối).
  Thất bại (thường do thiếu quyền `pages_manage_metadata`) → ghi `account_sync_state.webhook_error_code`, lượt quét Trang sau (1 giờ/lần) tự thử lại.
- Sự kiện đã xử lý được dọn sau 30 ngày (`WEBHOOK_EVENT_RETENTION_DAYS`).

---

## 2. Điều kiện của Meta cần biết

- **App phải ở chế độ Live mới nhận webhook dữ liệu thật** (đã kiểm thật 07/10/2026): ở Development, Meta **chỉ gửi webhook
  test** từ nút "Test" của App Dashboard (`entry.id` = `0`), kể cả khi người thao tác có vai trò trong app. Xem mục 6.
- **Quyền:** webhook `feed` của Trang cần `pages_manage_metadata` + `pages_show_list`, và người kết nối phải có quyền quản lý Trang.
  Hiện Login configuration **chưa có `pages_manage_metadata`** → phải thêm (mục 3, bước 4).
- **Live mode:** webhook không cần App Review riêng, nhưng muốn nhận sự kiện của người **không** có vai trò trong app thì quyền
  `pages_manage_metadata` cần **Advanced Access** (qua App Review + Business Verification).
- **Không có webhook cho bài quảng cáo (Ad Posts).**
- URL callback phải là **HTTPS công khai** — Meta không gọi được `localhost` (dùng tunnel ở mục 4).
- Từ 31/03/2026 Meta ký chứng chỉ client mTLS của webhook bằng CA riêng (`meta-outbound-api-ca-2025-12.pem`). AIMA **không** kiểm chứng chỉ client nên không ảnh hưởng; nếu sau này đặt proxy/WAF kiểm mTLS thì phải tin CA này.

---

## 3. Các bước cấu hình

### Bước 1 — Biến môi trường backend
Thêm vào `backend/.env` (hoặc biến môi trường server):
```
META_WEBHOOK_VERIFY_TOKEN=<chuỗi ngẫu nhiên tự đặt, vd: openssl rand -hex 16>
META_FACEBOOK_APP_SECRET=<App Secret của app Facebook — đã có sẵn để kết nối>
```
- `META_WEBHOOK_VERIFY_TOKEN` hiện **chưa có** trong `.env` → bắt buộc thêm, nếu không bước "Verify and save" thất bại.
- Chữ ký webhook kiểm bằng **đúng App Secret của app Facebook** (`META_FACEBOOK_APP_SECRET`). Thiếu → mọi webhook bị từ chối.
- Khởi động lại backend sau khi sửa `.env`. Backend tự áp Flyway **V9** (chỉ thêm bảng/cột — nhớ backup DB trước như mọi lần).

### Bước 2 — Có URL HTTPS công khai
- Production: `https://<domain-backend>/api/aima/webhooks/meta`.
- Chạy local: dùng tunnel (mục 4) → `https://<tunnel>/api/aima/webhooks/meta`.
- Kiểm nhanh (thay token):
  ```
  curl "https://<host>/api/aima/webhooks/meta?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=12345"
  ```
  Phải trả đúng `12345`. Sai token → lỗi `WEBHOOK_VERIFY_FAILED`.

### Bước 3 — Đăng ký webhook trên Meta App Dashboard
1. Vào https://developers.facebook.com/apps → chọn app AIMA.
2. Menu trái: **Webhooks** (nếu chưa có: *Add product* → **Webhooks** → *Set up*; ở giao diện "Use cases" thì vào use case quản lý Trang → *Customize* → **Webhooks**).
3. Ô chọn object: **Page**.
4. Bấm **Subscribe to this object** (hoặc *Edit subscription*):
   - **Callback URL:** URL ở bước 2.
   - **Verify token:** đúng giá trị `META_WEBHOOK_VERIFY_TOKEN`.
   - Bấm **Verify and save**. Meta gọi GET tới URL → backend trả `hub.challenge` → lưu thành công.
5. Trong danh sách field của object Page, tìm **`feed`** → bấm **Subscribe**.
   - (Tuỳ chọn) bấm **Test** cạnh `feed` để Meta gửi một sự kiện mẫu có chữ ký. Backend log
     `[Webhook] Nhận 1 sự kiện test từ App Dashboard (page_id = 0) — chỉ lưu, không xử lý`; bảng `meta_webhook_events` có một dòng
     `page_id = 0`, `status = IGNORED` — đúng.
6. Chuyển app sang **Live** (App Dashboard → thanh trên cùng, công tắc *App Mode* → **Live**; Meta yêu cầu đã điền Privacy Policy
   URL, Data Deletion URL, icon, category). Không chuyển thì chỉ nhận được webhook test (mục 6).

### Bước 4 — Thêm quyền `pages_manage_metadata`
1. App Dashboard → **Facebook Login for Business** → **Configurations** → mở configuration đang dùng (`META_FACEBOOK_CONFIG_ID`).
2. Thêm permission **`pages_manage_metadata`** (giữ nguyên các quyền đang có) → Save.
3. Quyền chưa có Advanced Access (chưa qua App Review): tài khoản dùng để kết nối phải có vai trò trong app (đã có).

### Bước 5 — Kết nối lại Facebook trong AIMA
1. AIMA → **Cài đặt → Kết nối** → **Kết nối** Facebook lại (để token Trang có quyền mới), tick đúng Trang test.
2. Ngay sau khi lưu kết nối, AIMA gọi `subscribed_apps` cho từng Trang. Kiểm:
   ```sql
   select pa.account_name, s.webhook_subscribed_at, s.webhook_error_code
   from account_sync_state s join platform_accounts pa on pa.id = s.platform_account_id
   where pa.deleted_at is null;
   ```
   - `webhook_subscribed_at` có giá trị, `webhook_error_code` trống → OK.
   - `PERMISSION:200` / `PERMISSION:10` → token chưa có `pages_manage_metadata` (làm lại bước 4–5).
   - Có thể kiểm phía Meta bằng Graph API Explorer (Page token): `GET /{page-id}/subscribed_apps` → thấy app AIMA với `subscribed_fields: ["feed"]`.
   - Nếu chưa muốn kết nối lại: lượt quét Trang (1 giờ/lần) tự thử `subscribed_apps` cho Trang chưa đăng ký.

### Bước 6 — Thử thật
App đã ở **Live** (bước 3.6). Dùng tài khoản quản lý Trang test:
1. **Thả cảm xúc / bình luận** vào một bài đang có trên trang Phân tích → trong ~5–10 phút số liệu bài đó cập nhật (không cần bấm "Làm mới").
2. **Đăng bài mới** thẳng trên Trang → trong ≤ 5 phút bài hiện ở Top bài viết với nhãn "Ngoài AIMA".
3. **Xoá một bài** trên Trang → bài hiện nhãn xám **"Đã xoá trên nền tảng"**, số liệu dừng ở lần thu cuối; bài AIMA vẫn
   "Đã đăng", không có thông báo lỗi.
4. Soi sự kiện:
   ```sql
   select created_at, page_id, field, item, verb, platform_post_id, status, attempts, last_error
   from meta_webhook_events order by created_at desc limit 20;
   ```
   `PROCESSED` = có tác động; `IGNORED` = hợp lệ nhưng không liên quan; `FAILED` = lỗi 3 lần (xem `last_error`).
   Không có dòng nào → Meta chưa gửi: xem mục 6.

---

## 4. Thử ở máy local bằng tunnel

Backend local chạy ở `http://localhost:<SERVER_PORT>` với context path `/api/aima` (ví dụ `http://localhost:8082/api/aima`).

**Cách A — Cloudflare Tunnel (không cần tài khoản):**
```bash
# Windows: winget install --id Cloudflare.cloudflared   (hoặc tải cloudflared.exe)
cloudflared tunnel --url http://localhost:8082
```
Lệnh in ra URL dạng `https://<tên-ngẫu-nhiên>.trycloudflare.com` → Callback URL = `https://<tên-ngẫu-nhiên>.trycloudflare.com/api/aima/webhooks/meta`.

**Cách B — ngrok:**
```bash
# Đăng ký ngrok.com, lấy authtoken: ngrok config add-authtoken <token>
ngrok http 8082
```
Dùng URL `https://<...>.ngrok-free.app/api/aima/webhooks/meta`.

**Lưu ý khi dùng tunnel:**
- URL tunnel miễn phí **đổi mỗi lần chạy lại** → phải vào App Dashboard sửa Callback URL + Verify and save lại.
- Webhook Meta trỏ tới backend local đang nối **DB thật trong `.env`** (Supabase) → backend local đó cũng chạy job đăng bài thật. Đừng để hai backend (local + server) cùng chạy job trên một DB lâu dài.
- Meta chỉ cho **một Callback URL cho mỗi object** của app → khi thử local, webhook production (nếu có) sẽ tạm ngưng nhận. Nhớ trả lại URL production sau khi thử.
- Kiểm tunnel sống: mở `https://<tunnel>/api/aima/webhooks/meta?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=ok` trên trình duyệt → hiện `ok`.

---

## 5. Gỡ / tắt

- Tắt tạm: App Dashboard → Webhooks → Page → bỏ subscribe field `feed` (AIMA vẫn chạy bằng lịch đồng bộ).
- Ngắt kết nối Facebook trong AIMA → AIMA bỏ qua (IGNORED) sự kiện của Trang không còn kết nối. AIMA **không** tự gọi
  `DELETE /{page-id}/subscribed_apps`; muốn Meta ngừng gửi hẳn cho Trang đó thì gọi lệnh này bằng Graph API Explorer (Page token)
  hoặc gỡ app khỏi Trang trong cài đặt Trang (Business Integrations).

---

## 6. Khắc phục sự cố

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| Chỉ thấy sự kiện `page_id = 0` (`IGNORED`), thao tác thật trên Trang không tạo dòng nào | **App đang ở Development.** Ở chế độ này Meta chỉ gửi webhook test từ App Dashboard, KHÔNG gửi webhook dữ liệu thật — kể cả khi người thao tác có vai trò trong app (kiểm thật 07/10/2026). Chuyển app sang **Live** (bước 3.6) rồi thử lại. |
| Sự kiện `page_id = 0`, `post_id` dạng `44444444_444444444` | Đó là payload mẫu của nút "Test" — AIMA chỉ lưu `IGNORED`, không xử lý, không ghi log lỗi. Bình thường. |
| "Verify and save" báo lỗi | `META_WEBHOOK_VERIFY_TOKEN` thiếu/sai, backend chưa khởi động lại, hoặc URL không public / sai đường dẫn (phải có `/api/aima/webhooks/meta`). Thử lệnh `curl` ở bước 2. |
| Log `[Webhook] Chữ ký X-Hub-Signature-256 không hợp lệ` | `META_FACEBOOK_APP_SECRET` không phải App Secret của chính app đang gửi webhook (hoặc proxy sửa body). |
| Không có sự kiện dù app đã Live | Trang chưa subscribe app: kiểm `account_sync_state.webhook_subscribed_at` / `webhook_error_code`; `PERMISSION:…` → thiếu `pages_manage_metadata` (bước 4–5). Kiểm thêm field `feed` đã Subscribe (bước 3.5). Người thao tác không có vai trò trong app → quyền cần Advanced Access (App Review). |
| Sự kiện `FAILED` | Xem cột `last_error`; worker đã thử 3 lần. Sự kiện kẹt `PENDING` được job xử lý lại sau ~2 phút. |
| Sự kiện bị `IGNORED` dù đúng Trang | Bài chưa được AIMA theo dõi (chưa quét Trang lần nào, hoặc bài > 90 ngày đã dừng đồng bộ) — bình thường; lượt quét Trang kế tiếp sẽ nhập bài. |
