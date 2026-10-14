# Realtime SSE & thông báo — Hướng dẫn deploy

> Áp dụng cho đợt [REALTIME_SSE_NOTIFICATIONS_PROPOSAL.md](REALTIME_SSE_NOTIFICATIONS_PROPOSAL.md) (tiến độ:
> [REALTIME_SSE_PROGRESS.md](REALTIME_SSE_PROGRESS.md)). Người vận hành làm; KHÔNG chạy migration/ghi dữ liệu Supabase từ máy dev.

## 1. Đường đi & giả định (D1)

`Trình duyệt (aima-marketing.id.vn, Vercel) → edge Render → backend (api.aima-marketing.id.vn/api/aima)`. Không Nginx, không
Cloudflare proxy (domain chỉ DNS). Vercel không nằm trên đường SSE (FE gọi thẳng domain API). Số instance BE chưa chốt — thiết kế đúng
cho N instance (mọi sự kiện qua Redis pub/sub kênh `aima:rt:v1`, mỗi instance chỉ giao cho kết nối của mình).

- Heartbeat `:hb` 20s (< timeout idle của edge ~60–100s), mỗi kết nối tự đóng sau 30 phút hoặc khi access token hết hạn → client nối lại.
- Response SSE: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`; gzip KHÔNG áp cho
  `text/event-stream` (đừng thêm vào `server.compression.mime-types`).

**Nếu sau này bật proxy Cloudflare (đám mây cam) cho `api.`:**
1. Cache Rule **bypass cache** cho `api.aima-marketing.id.vn/*` (tối thiểu `/api/aima/realtime/*`); không bật Rocket Loader / Auto Minify cho API.
2. Cho **webhook Meta** (`/api/aima/webhooks/meta`, `/meta/data-deletion`, `/meta/deauthorize`) và **webhook thanh toán**
   (`/api/aima/webhooks/payos`) đi qua WAF / **Bot Fight Mode** (Skip rule theo path) — bot challenge sẽ làm webhook thất bại im lặng.
3. Backend phải đọc **IP thật từ `CF-Connecting-IP`** (hiện đọc `X-Forwarded-For` / remote addr ở `util/RequestMeta`) — cấu hình trust proxy
   trước khi bật, nếu không log/ai_usage ghi IP của Cloudflare.
4. Cloudflare cắt kết nối im lặng > 100s → heartbeat 20s vẫn đủ; giữ nguyên.

## 2. Thứ tự deploy

1. **Backup DB Supabase** (theo `docs/SCHEDULING_PRODUCTION_RUNBOOK.md`).
2. **Migration V17** (chỉ thêm cột/index/giá trị CHECK — binary cũ chạy được trên schema mới): chạy Flyway như các bản trước
   (binary mới tự migrate khi boot, hoặc chạy tay). Kiểm tra sau khi chạy:
   ```sql
   select version, success from flyway_schema_history where version = '17';
   select pg_get_constraintdef(oid) from pg_constraint where conname in ('notifications_type_check','ai_usage_status_check');
   select indexname from pg_indexes where indexname in ('ix_ntf_user_created','ix_ntf_user_unread');
   ```
   Rollback (sau khi đã chuyển binary về bản trước V17): `docs/sql/rollback/V17__realtime_notifications_down.sql`.
3. **AI service** (Python) — thêm endpoint `/generate/stream`, không đổi endpoint cũ → deploy trước hay sau BE đều an toàn.
4. **Backend** — cờ `AIMA_AI_GENERATION_STREAMING_ENABLED` để **false** ở lần deploy đầu.
5. **Frontend** (Vercel) — dùng được với BE mới; với BE cũ (chưa có `/realtime/stream`) client SSE nhận 404/401 → tự backoff + chuông
   quay về poll 60s, không vỡ trang. Nên deploy SAU backend.
6. Kiểm tra SSE trên Render (mục 4), rồi mới **bật streaming**: `AIMA_AI_GENERATION_STREAMING_ENABLED=true` + restart BE (chỉ khi AI
   service đã chạy bản có `/generate/stream`). Tắt lại = đường `/generate` cũ ngay lập tức (không cần deploy).

## 3. Biến môi trường mới (backend) — đều có mặc định

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `AIMA_REALTIME_BUS` | `redis` | Giữ `redis` ở production (N instance). `local` chỉ cho test |
| `AIMA_REALTIME_CHANNEL` | `aima:rt:v1` | Đổi khi nhiều môi trường dùng chung một Redis |
| `AIMA_REALTIME_HEARTBEAT_SECONDS` | `20` | Phải < timeout idle của edge |
| `AIMA_REALTIME_MAX_CONNECTION_MINUTES` | `30` | |
| `AIMA_REALTIME_MAX_PER_USER` / `AIMA_REALTIME_MAX_PER_INSTANCE` | `6` / `2000` | |
| `AIMA_AI_GENERATION_STREAMING_ENABLED` | `false` | Bật sau khi AI service có `/generate/stream` |
| `NOTIFICATION_READ_RETENTION_DAYS` / `NOTIFICATION_RETENTION_DAYS` / `NOTIFICATION_DELETED_RETENTION_DAYS` | `90` / `180` / `30` | D6, 0 = tắt dọn |
| `AIMA_PLAN_EXPIRY_REMINDER_CRON` | `0 0 9 * * *` | Nhắc gói hết hạn trước 7 & 1 ngày |

Không có biến mới cho FE / AI service. Redis (Upstash) đã là phụ thuộc bắt buộc — mỗi sự kiện = 1 lệnh PUBLISH (+ 1 kết nối subscribe
thường trực mỗi instance): kiểm tra hạn mức lệnh/kết nối của gói Upstash. AI delta được gộp 100ms (≤ ~10 PUBLISH/giây/job).

## 4. Kiểm tra SSE trên Render (sau deploy BE)

```bash
API=https://api.aima-marketing.id.vn/api/aima
curl -s -c jar.txt -H 'Content-Type: application/json' -d '{"email":"<tài khoản test>","password":"<mật khẩu>"}' $API/auth/login -o /dev/null
# Giữ luồng > 3 phút: phải thấy retry:3000 + event:ready ngay, rồi ":hb" mỗi ~20 giây, KHÔNG bị cắt / dồn cục
time curl -N -s -b jar.txt -H 'Accept: text/event-stream, application/json' $API/realtime/stream
```
Đạt khi: header `content-type: text/event-stream`, `ready` hiện NGAY (không chờ vài KB mới flush), `:hb` đều 20s trong > 3 phút, và luồng
chỉ kết thúc bằng `event:reconnect` (sau 30 phút hoặc khi token hết hạn). Nếu `:hb` tới thành từng cục hoặc kết nối bị cắt ở ~100s → edge
đang buffer / cắt: báo lại để chỉnh (heartbeat ngắn hơn hoặc tham số Render).

Thử nhiều instance: mở 2 tab, đăng nhập cùng tài khoản; đánh dấu đã đọc một thông báo ở tab 1 → badge tab 2 giảm ngay (dù hai tab có thể
nối vào hai instance khác nhau).
