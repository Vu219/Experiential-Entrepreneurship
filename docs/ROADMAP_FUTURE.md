# ROADMAP_FUTURE — Quyết định hoãn & việc dự định làm (workstream Token Usage & Billing)

> Tổng hợp TẤT CẢ quyết định đã hoãn / việc tương lai được thảo luận trong workstream token
> usage & billing (Phase 0 → 5A, 18–19/7/2026). Mỗi mục ghi: bối cảnh vì sao hoãn, điều kiện
> cần có trước khi làm, phụ thuộc vào phase/quyết định nào, và **Trạng thái** (cái nào cần
> product owner trả lời, cái nào chỉ là ghi chú tham khảo). Chi tiết những gì ĐÃ build: xem
> các mục "Token usage — pha 0..5A" trong [PLAN.md](PLAN.md).

---

## 1. Phase 5B — auto throttle/block

- **Bối cảnh hoãn**: chốt 19/7 — giai đoạn đầu CHỈ cảnh báo (5A), chưa tự động chặn, để đo
  tỉ lệ báo nhầm (FP) thực tế trước. Chặn nhầm user hợp lệ đắt hơn nhiều so với alert thừa.
- **Điều kiện triển khai**: có đủ dữ liệu FP từ `usage_alerts` qua
  `GET /admin/usage/alerts/stats` (mỗi rule: tổng alert / số đánh dấu báo nhầm / tỉ lệ %).
  Chỉ rule có FP thấp mới được xét đưa sang tự động chặn.
- **Đánh giá đã duyệt (19/7)**:
  - Dự kiến đủ tin cậy sớm: **R7** (credit shortfall — gần như không có báo nhầm),
    **R9** (tổng cost hệ thống — ngưỡng tuyệt đối), R1/R6 ở mức "được phép throttle".
  - **Không bao giờ auto-chặn**: **R5** (lỗi hệ thống — lỗi của mình, không phạt khách),
    **R8** (giám sát admin — chỉ để người khác soi, không phải cơ chế chặn),
    R3 (đột biến — FP cao cấu trúc).
- **Thiết kế đã chốt trước, chỉ chưa build**: throttle = chặn *tạo job AI mới* bằng
  ErrorCode mới (HTTP 429), thông điệp lịch sự "Tài khoản đang bị giới hạn tạm thời do hoạt
  động bất thường — thử lại sau X phút hoặc liên hệ hỗ trợ"; dữ liệu cũ vẫn xem bình thường.
  Throttle **tự hết hạn** (15–60'); khoá tính năng chỉ **admin gỡ** (nút "Bỏ chặn" trên trang
  chi tiết user). Mọi lần đặt/gỡ ghi audit (ai, rule nào, lý do, lúc nào). Không rule nào
  nhảy thẳng tới "khoá" tự động — khoá luôn là quyết định của admin.
- **Phụ thuộc**: 5A chạy đủ lâu để bảng FP có ý nghĩa; quyết định của product owner theo số.
- **Trạng thái**: đã quyết định kiến trúc + thang enforcement; **còn chờ quyết định** rule
  nào bật 5B (căn cứ số FP — product owner trả lời sau khi vận hành 5A).

## 2. Thanh toán & bán token lẻ

- **Bối cảnh**: quyết định 18/7 — SẼ bán gói token lẻ trong ~6 tháng; bucket `token_credits`
  đã build sẵn schema + cơ chế tiêu (FIFO, atomic, shortfall) từ Phase 2 để tránh đổi mô hình
  kế toán sau khi đã bán. 6 quy tắc bucket + quy tắc 7 (nâng gói không hoàn credit đã tiêu)
  + quy tắc 8 (không bán top-up cho gói không giới hạn) ghi trong PLAN.md mục "Định hướng
  thanh toán & bán token lẻ".
- **Việc còn thiếu** (theo thứ tự phụ thuộc):
  1. ~~Bảng payment~~ ✅ **ĐÃ LÀM 2026-07-20** — bảng `payments` đã dựng, xem mục 2b bên dưới.
     Việc còn lại của gạch đầu dòng này là *tích hợp cổng thật*, xem checklist ở 2b.
  2. Webhook xác nhận thanh toán — **bắt buộc idempotent** (cổng thanh toán gửi lặp; khoá
     theo mã giao dịch của cổng), tạo dòng `token_credits` khi thanh toán thành công.
     *Khoá idempotency đã có sẵn*: partial unique `uk_payments_gateway_txn` trên
     `payments.gateway_txn_id` + `PaymentRepository.findByGatewayTxnIdAndDeletedAtIsNull`.
  3. Luồng hoàn tiền/chargeback — revoke ĐÚNG DÒNG credit (status REVOKED), chỉ thu hồi
     phần CHƯA tiêu; phần đã tiêu giữ nguyên trên event log.
  4. Khái niệm giá thứ ba: **giá bán gói token lẻ** (khách trả bao nhiêu cho bao nhiêu
     token) — chưa tồn tại; đừng nhầm với đơn giá provider (`ai_models` → cost_usd) và hệ số
     quy đổi hạn mức (`billing_rates` → billable_units).
  5. **Xoá endpoint dev-credits** (`POST /admin/usage/users/{id}/dev-credits`) khi có payment
     thật — endpoint cấp token miễn phí không được tồn tại song song với luồng mua thật.
     **Cùng lúc đó xoá cả `POST/DELETE /admin/revenue/dev-seed`** (xem 2b).
- **Còn chờ quyết định** (product owner, không chặn việc khác): có xuất hoá đơn không; thuế/
  VAT; đơn vị tiền tệ hiển thị cho khách (VND hay USD); tỉ giá quy đổi nếu bán bằng VND
  trong khi chi phí provider tính USD.
  *Ghi chú 2026-07-20*: các câu hỏi này KHÔNG còn chặn việc dựng sổ cái — cột `currency` và
  `invoice_no` đã có sẵn trên `payments`, quyết định sau chỉ là điền giá trị, không phải
  migration.
- **Trạng thái**: đã quyết định bán + mô hình bucket; **đã chọn cổng: payOS** (2026-07-20);
  **đã dựng bảng `payments`** (2026-07-20); **còn chờ quyết định** hoá đơn/thuế/tiền tệ/tỉ giá.

## 2b. Sổ cái `payments` + trang Quản lý doanh thu (ĐÃ LÀM 2026-07-20)

> Trang admin `/admin/revenue` trước đây chạy hoàn toàn bằng dữ liệu mock ở FE vì không có
> bảng nào lưu giao dịch. Task 20/7 dựng sổ cái thật và nối trang vào đó. **Chưa tích hợp
> cổng thanh toán** — schema được thiết kế sẵn để gắn payOS mà không phải migration.

### Quyết định: cổng thanh toán tương lai là **payOS**

Sổ cái được thiết kế độc lập với việc chọn cổng, nhưng đã chừa đúng chỗ cho payOS:
`PaymentGateway` có sẵn giá trị `PAYOS`; payOS định danh đơn bằng `orderCode` (số nguyên) →
lưu nguyên dạng chuỗi vào `gateway_txn_id`, **không cần cột riêng**.

### Bảng `payments` — ý nghĩa từng cột

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id`, `created_at`, `updated_at`, `deleted_at` | từ `BaseEntity` | Audit + soft delete. `created_at` là mốc INSERT, **không phải** mốc nghiệp vụ. |
| `user_id` | FK users | Khách trả tiền. |
| `plan_id` | FK plans | Gói được mua — cho phép báo cáo "cơ cấu gói" đọc ĐỘNG từ bảng plans. |
| `amount` | bigint | Số tiền khách trả, đơn vị nhỏ nhất của `currency` (VND = đồng). |
| `currency` | varchar(3) | ISO-4217. MVP chỉ `VND`; có sẵn để sau bán quốc tế. |
| `status` | varchar(30) | `PENDING` \| `PAID` \| `FAILED` \| `REFUNDED` \| `PARTIALLY_REFUNDED`. |
| `ordered_at` | timestamp, NOT NULL | **Mốc TẠO ĐƠN (nghiệp vụ)**. Tách khỏi `created_at` vì: webhook/đối soát payOS có thể tới muộn hoặc backfill; và đơn PENDING/FAILED không có `paid_at` nên đây là mốc duy nhất quy kỳ cho chúng. |
| `paid_at` | timestamp, nullable | Mốc thu được tiền. Quy kỳ cho phần GỘP của doanh thu. null khi PENDING/FAILED. |
| `refunded_amount` | bigint, NOT NULL | Số tiền đã hoàn (≤ `amount`). 0 = chưa hoàn. |
| `refunded_at` | timestamp, nullable | Mốc phát sinh hoàn tiền. Quy kỳ cho phần TRỪ. **Chính cột này khiến "không hồi tố" thực hiện được.** |
| `period_start` / `period_end` | timestamp | Chu kỳ dịch vụ mà lần trả tiền này mua (đối soát với `subscriptions`). |
| `gateway` | varchar(20) | `MANUAL` (ghi tay/seed) \| `PAYOS` (dự phòng, chưa dùng). |
| `gateway_txn_id` | varchar(100), nullable | Mã giao dịch phía cổng — payOS `orderCode` dạng chuỗi. **Partial unique** `WHERE gateway_txn_id IS NOT NULL AND deleted_at IS NULL` = khoá idempotency cho webhook retry. |
| `invoice_no` | varchar(50) | Số hoá đơn hiển thị. |
| `failed_reason` | varchar(500) | Lý do hỏng/huỷ/hết hạn do cổng trả về — **chỗ webhook payOS ghi vào**. |
| `raw_payload` | TEXT, nullable | Payload thô của webhook, giữ nguyên để đối soát/tranh chấp. Dùng TEXT không jsonb vì không truy vấn vào bên trong. |
| `note` | varchar(500) | Ghi chú nội bộ. Bản ghi do dev seeder sinh có tiền tố `dev-seed:`. |

Index (tạo ở `config/PaymentDataInitializer`, `@Order(8)`, raw SQL vì `ddl-auto: update`):
`(status, paid_at DESC)`, `(refunded_at) WHERE refunded_at IS NOT NULL`, `(plan_id, paid_at DESC)`,
`(ordered_at DESC)`, và partial unique `uk_payments_gateway_txn`.

### `PENDING` là trạng thái THẬT, không phải giá trị trang trí

Bản ghi được tạo ngay khi hệ thống sinh payment link và khách **chưa** trả tiền trên cổng.
payOS sẽ chuyển nó sang `PAID`/`FAILED` qua webhook; đơn quá hạn không trả cũng về `FAILED`
kèm `failed_reason`. Đơn `PENDING`/`FAILED` **không vào doanh thu** nhưng vẫn hiện trong bảng
giao dịch để admin theo dõi sức khoẻ cổng.

### Công thức doanh thu ĐÃ CHỐT (đừng tính lại kiểu khác)

**NET theo kỳ PHÁT SINH hoàn tiền, KHÔNG hồi tố:**

```
doanh thu(kỳ) = Σ amount          của đơn PAID|REFUNDED|PARTIALLY_REFUNDED có paid_at     ∈ kỳ
              − Σ refunded_amount của đơn bất kỳ                            có refunded_at ∈ kỳ
```

- Đơn đã hoàn tiền **vẫn tính ở kỳ trả tiền** — nó có thu tiền thật ở kỳ đó.
- Phần hoàn bị trừ ở **kỳ hoàn**, nên **số liệu của kỳ đã đóng sổ không bao giờ thay đổi**.
- Hệ quả có chủ ý: doanh thu một bucket **có thể ÂM** (hoàn tiền kỳ trước lớn hơn doanh số kỳ
  này). Không được kẹp về 0 — đó là con số đúng. Chart tô cột âm màu đỏ.
- Giá trị TB/giao dịch = doanh thu **NET** / số giao dịch (để `tổng = TB × số lượng` khớp nhau).
- Tỉ lệ thất bại = `failed / (paid + failed)`, quy kỳ theo `ordered_at`.

Nơi cài đặt: `RevenueServiceImpl` + `PaymentRepository` (gộp bằng `GROUP BY date_trunc`, hai vế
`UNION ALL` trong một lượt truy vấn). Test: `src/test/java/com/aima/revenue/RevenueAggregateTest.java`.

### ⚠️ Dev seeder là TẠM THỜI — phải gỡ khi có payment thật

`POST /admin/revenue/dev-seed` + `DELETE /admin/revenue/dev-seed` sinh/xoá ~350 bản ghi
`payments` mẫu rải 18 tháng, chỉ để dựng và demo giao diện trước khi có cổng thanh toán.

- Khoá **ba lớp** giống dev-credits: cờ `aima.dev.payment-seed-enabled` (env
  `AIMA_DEV_PAYMENT_SEED`, mặc định **false**) + `AIMA_PRODUCTION_MODE=true` + profile
  prod/production. Bị chặn → ErrorCode 2042.
- Bản ghi seed mang `gateway = MANUAL` và `note` bắt đầu bằng `dev-seed:` — endpoint xoá chỉ
  đụng đúng những dòng đó.
- **Khi tích hợp payOS xong: XOÁ cả hai endpoint, service method, và cờ cấu hình.** Dữ liệu
  doanh thu giả không được phép tồn tại song song với doanh thu thật.

### Checklist khi tích hợp payOS thật (chưa làm)

1. **Tạo payment link** — gọi payOS Create Payment Link, sinh `orderCode` (số nguyên, duy
   nhất), lưu `payments` với `status = PENDING`, `gateway = PAYOS`, `gateway_txn_id = orderCode`,
   `ordered_at = now`. Trả checkout URL cho FE.
2. **Webhook + verify signature** — payOS ký payload bằng checksum key; **phải verify trước
   khi tin**. Endpoint webhook là public (không JWT) nên chữ ký là lớp xác thực duy nhất.
3. **Idempotency** — webhook có thể gửi lặp: UPSERT theo `gateway_txn_id`
   (`findByGatewayTxnIdAndDeletedAtIsNull` → cập nhật; không có thì tạo). Partial unique index
   là chốt chặn cuối nếu hai webhook chạy song song. Lưu `raw_payload` mỗi lần nhận.
4. **Đối soát** — job định kỳ so `payments` với báo cáo giao dịch của payOS theo `orderCode`
   + `ordered_at`; chênh lệch thì log + cảnh báo admin. Đây là lý do tồn tại của `ordered_at`
   và `raw_payload`.
5. **Huỷ / hết hạn** — payOS link có TTL. Job quét đơn `PENDING` quá hạn → `FAILED` +
   `failed_reason = 'EXPIRED'`. Không để `PENDING` treo vĩnh viễn làm sai tỉ lệ thất bại.
6. **Hoàn tiền** — ghi `refunded_amount` + `refunded_at` (mốc phát sinh, KHÔNG sửa `paid_at`),
   đổi `status` sang `REFUNDED`/`PARTIALLY_REFUNDED`, đồng thời revoke đúng dòng
   `token_credits` (mục 2.3 ở trên).
7. **Hoá đơn** — điền `invoice_no`; nếu cần hoá đơn điện tử/VAT thì đây là chỗ móc vào
   (còn chờ quyết định product owner).
8. **Thuế** — chưa có cột thuế. Nếu phải tách VAT khỏi `amount` thì thêm `tax_amount` +
   `amount_before_tax`; quyết định TRƯỚC khi mở bán, vì sửa sau là migration dữ liệu kế toán.
9. **Tiền tệ** — `currency` đã có. Nếu bán bằng nhiều tiền tệ thì cần thêm tỉ giá tại thời
   điểm giao dịch (`fx_rate`) để báo cáo quy về một đơn vị.

## 3. Gói không giới hạn mua token lẻ — Phương án B (đóng băng hạn dùng)

- **Bối cảnh**: chốt 19/7 phương án **A** — KHÔNG bán top-up cho gói không giới hạn (chỉ cần
  ẩn nút mua ở UI bán hàng sau này). User gói không giới hạn không tiêu credit, nên credit
  có hạn sẽ nằm im tới hết hạn — chấp nhận với A.
- **Phương án B (hướng mở)**: đóng băng đếm hạn (`expires_at`) khi user đang ở gói không giới
  hạn — cần cột freeze + logic tính lại hạn khi hạ gói. Phức tạp hơn đáng kể cho một edge
  case hiếm (mua credit rồi mới nâng gói).
- **Điều kiện làm B**: thực tế phát sinh NHIỀU case user mua credit rồi nâng lên gói không
  giới hạn và khiếu nại về hạn dùng.
- **Trạng thái**: đã quyết định A; B chỉ là ghi chú tham khảo — không cần trả lời gì thêm
  trừ khi có khiếu nại thực tế.

## 4. Versioning cho `Plan.monthlyTokenLimit`

- **Bối cảnh**: hạn mức gói hiện SỬA ĐÈ (trang Quản lý gói), không có lịch sử — báo cáo "%
  sử dụng so hạn mức" của kỳ CŨ sẽ tính theo hạn mức HIỆN TẠI chứ không phải hạn mức tại
  thời điểm đó (sai lệch nếu admin từng đổi hạn mức giữa chừng). Đã có tiền lệ xử lý đúng
  trong hệ thống: `billing_rates` versioning append-only và `ai_usage.billable_units` chốt
  tại thời điểm ghi.
- **Hai phương án, chưa đánh giá chi phí**:
  - (a) Bảng version lịch sử cho plan limit (giống `billing_rates`) — đúng nhất, nặng hơn.
  - (b) Snapshot `monthlyTokenLimit` vào rollup (`usage_daily`) tại thời điểm roll — rẻ,
    đủ cho mục đích báo cáo, không sửa được sai lệch trong kỳ đang chạy.
- **Điều kiện**: cần khi bắt đầu làm báo cáo lịch sử theo kỳ (hoặc trước khi bán gói —
  đổi giá/hạn mức gói khi có khách trả tiền mà không có lịch sử là rủi ro tranh chấp).
- **Trạng thái**: **còn chờ quyết định** chọn (a) hay (b) — nên chốt trước khi mở bán.

## 5. Hạn mức riêng theo từng user (per-user override)

- **Bối cảnh**: hạn mức gắn với Plan; `User.plan` là enum 3 gói lõi (FREE/PLUS/PRO) nên
  không gán gói tuỳ biến cho một user được. Nhu cầu nêu ra 19/7 khi tìm cách hạ hạn mức
  riêng cho tài khoản test (kết luận lúc đó: không cần — dùng tài khoản FREE mới).
- **Vị trí đúng nếu làm**: thêm cột `limit_override` (nullable) trên bảng `subscriptions`
  — subscription là nguồn sự thật về gói+kỳ của từng user; các điểm đọc limit
  (`TokenUsageServiceImpl.state`, `UsageQueryServiceImpl`) ưu tiên override khi ≠ null.
- **Điều kiện**: có khách đàm phán hạn mức riêng (doanh nghiệp) hoặc nhu cầu vận hành thật.
- **Trạng thái**: ghi chú tham khảo — chưa cần quyết định.

## 6. R4 (IP/UA distinct) — có thể cần GeoIP

- **Bối cảnh**: chốt 18/7 BỎ tiêu chí quốc gia (không thêm MaxMind ~70MB DB phải cập nhật
  định kỳ cho một rule chưa biết nhiễu thế nào); 19/7 đã giảm nhiễu thêm bằng cách nâng
  ngưỡng lên 5 IP VÀ bắt buộc kèm ≥3 User-Agent distinct (CGNAT/đổi WiFi↔4G ở VN chỉ đổi
  IP, không đổi UA).
- **Điều kiện xem lại**: sau khi 5A chạy, nếu R4 vẫn FP cao trong báo cáo
  `/admin/usage/alerts/stats` → cân nhắc thêm MaxMind GeoIP để lọc theo quốc gia thay vì
  chỉ đếm IP.
- **Phụ thuộc**: số liệu FP từ 5A (mục 1).
- **Trạng thái**: đã quyết định không dùng GeoIP ở 5A; **còn chờ số liệu** để xét lại.

## 7. Biểu đồ token thô trên trang usage — CÒN NỢ chuyển sang billable

- **Hiện trạng (xác nhận 19/7)**: Phase 3 chỉ làm tab Tổng quan admin — hai biểu đồ trang
  user (`/usage`: series theo ngày + phân bổ theo tính năng) và tab "Theo tính năng" trên
  trang chi tiết user admin **vẫn hiển thị token thô** (query `aggregateDailyForUser` /
  `aggregateByTaskForUser` sum `total_tokens`). Đang chữa cháy bằng nhãn
  "(token thô — chưa quy đổi hạn mức)".
- **Việc cần làm**: đổi 2 query sang `coalesce(billable_units, total_tokens) −
  coalesce(credit_units, 0)` (nhất quán với số `used` so hạn mức) hoặc trả CẢ HAI số cho FE
  chọn; bỏ nhãn tạm. Đồng thời **UI "Plus (áp dụng từ 01/08)"** cho hạ gói giữa kỳ: DTO đã
  có (`effectivePlanForQuota` + `pendingPlanChangeAt` từ Phase 1) nhưng **FE chưa render**
  — cùng nợ UI, làm chung một lượt.
- **Điều kiện**: không có — chỉ là việc chưa tới lượt; nên làm trước khi nhập hệ số
  quy đổi ≠ 1 (khi đó chênh lệch thô/billable mới hiện rõ và gây hiểu nhầm).
- **Trạng thái**: đã quyết định hướng (chuyển billable); chỉ chờ xếp lịch làm.

## 8. Khoá dev-seed — theo dõi khi dự án bắt đầu dùng Spring profile

- **Bối cảnh**: 19/7 chuyển lớp khoá production từ Spring profile sang biến độc lập
  `AIMA_PRODUCTION_MODE` vì profile fail-open (quên set = khoá vô hiệu) và đã xác minh repo
  hiện KHÔNG có `application-prod.yml` / `@Profile` / `on-profile` nào. Ba lớp hiện tại:
  cờ `AIMA_DEV_CREDIT_SEED` (mặc định tắt) → `AIMA_PRODUCTION_MODE=true` (set trên Render)
  → profile prod/production (belt).
- **Ghi chú theo dõi**: nếu sau này dự án THÊM `application-prod.yml` hoặc bean `@Profile`,
  phải rà lại mọi nơi dùng `AIMA_PRODUCTION_MODE` (hiện chỉ `TokenCreditServiceImpl`) để
  đảm bảo hai cơ chế không cho hành vi mâu thuẫn (vd profile bật nhưng production-mode quên
  set — dev-tool vẫn bị chặn bởi profile, đúng ý; chiều ngược lại cũng phải giữ fail-safe).
- **Trạng thái**: đã quyết định + đã build; chỉ là ghi chú vận hành cho người sau.

## 9. Timezone — ràng buộc vận hành (KHÔNG được đổi APP_TIMEZONE)

- **Bối cảnh**: mọi cột timestamp (`ai_usage.created_at`, bucket `usage_hourly`/`usage_daily`)
  lưu giờ ĐỊA PHƯƠNG theo `APP_TIMEZONE` (hiện Asia/Ho_Chi_Minh) và KHÔNG có cột nào ghi lại
  timezone tại thời điểm ghi → đổi giá trị làm dữ liệu trước/sau lẫn vào nhau không tách được.
- **Đã chốt 18–19/7**: chấp nhận thiết kế, KHÔNG refactor; `APP_TIMEZONE` là **hằng số sau
  khi có dữ liệu**. Buộc phải đổi = MIGRATION có kế hoạch (convert toàn bộ timestamp), không
  phải sửa `.env`. Guard khởi động đã có ở Phase 3 (`TimezoneVerificationConfig` chốt giá trị
  vào `system_config`, lệch → log ERROR); quy ước ghi cả vào `COMMENT ON COLUMN`.
- **Trạng thái**: đã quyết định + đã build guard — chỉ ghi lại lý do để người sau không vô
  tình sửa `.env`. Không cần làm thêm.

---

## Các mục bổ sung (rà từ lịch sử trao đổi — product owner có thể chưa nhớ hết)

## 10. `ai_usage.user_id` không nằm trong purge cascade GDPR

- **Bối cảnh**: gap có từ trước workstream (ghi nhận 18/7 khi khảo sát) —
  `AccountDeletionScheduler` hard-delete user PENDING_DELETE quá hạn, nhưng `ai_usage` (và
  nay thêm `token_credits`, FK `user_id`) không nằm trong cascade → purge một user từng có
  usage sẽ **vỡ FK**. `subscriptions`/`usage_adjustments` đã cascade; `usage_alerts` +
  rollup dùng UUID trần nên miễn nhiễm.
- **Việc cần làm**: quyết định chính sách — (a) xoá event usage theo user khi GDPR purge
  (mất số liệu thống kê), hay (b) giữ event nhưng nullify `user_id` (số liệu gộp còn, hết
  liên kết cá nhân — rollup đã thiết kế theo hướng này). Nghiêng về (b) nhưng chưa chốt.
- **Trạng thái**: **còn chờ quyết định** (a)/(b) — nên xử trước khi có user thật xoá tài khoản.

## 11. `prompt_hash` / `prompt_length` — phát hiện spam lặp nội dung

- **Bối cảnh**: nằm trong spec gốc mục A (tuỳ chọn), chủ động hoãn từ Phase 1 — chưa có
  nhu cầu và muốn giữ event log gọn. Không lưu nội dung prompt (đã chốt vì riêng tư);
  hash+length là mức tối đa cho phép.
- **Điều kiện**: khi thấy dấu hiệu abuse kiểu gọi lặp cùng nội dung (R1/R3 bắn nhiều mà
  không giải thích được), hoặc khi làm 5B cần thêm tín hiệu.
- **Phụ thuộc**: điểm chèn đã sẵn — thêm field vào `TokenAccounting` (AI service) +
  cột `ai_usage`, đi qua chokepoint `recordCall`.
- **Trạng thái**: ghi chú tham khảo — chưa cần quyết định.

## 12. Materialize view "Theo người dùng" khi user đông

- **Bối cảnh**: `GET /admin/usage/by-user` lọc theo ngưỡng TÍNH TOÁN (≥80%/vượt) nên gộp
  toàn bộ user rồi phân trang tại chỗ — chấp nhận khi user ít (ghi nhận từ pha 2 cũ, 18/7).
- **Điều kiện**: user lên hàng nghìn → chuyển sang bảng materialized cập nhật theo rollup
  (hoặc thêm cột usage kỳ này vào `subscriptions` do rollup job nuôi).
- **Trạng thái**: ghi chú tham khảo — theo dõi hiệu năng, chưa cần quyết định.

## 13. Notification 80% hạn mức cho USER (chuông in-app)

- **Bối cảnh**: cảnh báo 80% hiện chỉ hiển thị bị động (thanh usage sidebar đổi màu, thông
  điệp trên trang usage — kể cả biến thể "sắp chuyển sang token đã mua" từ Phase 2). Chưa
  có notification chủ động qua chuông (`NotificationService`) — ghi nhận từ pha 2 cũ.
- **Điều kiện**: quyết định product — có muốn đẩy notification chủ động không (kèm loại
  `NotificationType` mới, vd QUOTA_WARNING) và tần suất (một lần/kỳ để không spam).
- **Trạng thái**: **còn chờ quyết định** product (có làm không + ngưỡng/tần suất).

## 14. Kỳ hạn mức theo ngày đăng ký (anniversary billing)

- **Bối cảnh**: chốt 18/7 GIỮ tháng lịch — anniversary công bằng hơn nhưng phải refactor
  `SubscriptionServiceImpl` + mọi query theo kỳ, và không phục vụ mục tiêu giám sát usage.
  `Subscription.currentPeriodStart/End` đã thiết kế mở cho chu kỳ khác.
- **Điều kiện**: nếu bán gói theo ngày mua (khi làm payment) → tính lại thành dự án riêng,
  không gộp vào workstream usage.
- **Trạng thái**: đã quyết định giữ tháng lịch; xét lại CÙNG LÚC với mục 2 (payment).

## 15. Loại đơn vị `billing_rates` ngoài TOKEN_TOTAL

- **Bối cảnh**: enum `BillingUnitType` đặt chỗ TOKEN_IN/TOKEN_OUT/REQUEST/IMAGE/SECOND
  nhưng MVP chỉ dùng TOKEN_TOTAL (AI service trả tổng token; tính phí theo chiều in/out
  hoặc theo ảnh/giây video chưa có nghiệp vụ tương ứng — nhắc lại: MVP không sinh ảnh/video).
- **Điều kiện**: khi có tính năng tính phí theo đơn vị khác (vd image generation nếu scope
  mở rộng) — resolver `BillingRateService.toBillableUnits` sẽ cần nhận breakdown thay vì
  chỉ tổng token.
- **Trạng thái**: ghi chú tham khảo — chưa cần quyết định.

## 16. Partition `activity_logs` / `system_logs` theo tháng

- **Bối cảnh**: hai bảng log là append-only, truy vấn gần như luôn kèm điều kiện thời gian,
  và dọn dẹp hiện làm bằng `DELETE ... WHERE created_at < ?` (LogRetentionJob 03:30). Với
  PostgreSQL, `PARTITION BY RANGE (created_at)` theo tháng sẽ biến việc dọn retention từ
  DELETE hàng loạt (sinh bloat + phải VACUUM) thành `DROP PARTITION` tức thời, đồng thời
  cho partition pruning khi lọc theo khoảng ngày.
- **Vướng mắc**: `ddl-auto: update` KHÔNG tạo được bảng partition — Hibernate chỉ sinh
  `CREATE TABLE` thường. Muốn làm phải viết `*DataInitializer` chạy SQL thủ công (mẫu:
  `PlatformDataInitializer` tạo partial unique index), kèm job tạo trước partition tháng
  kế tiếp. Ngoài ra khoá chính phải gồm cột phân vùng → `id` đơn lẻ không còn làm PK được,
  ảnh hưởng `BaseEntity`.
- **Điều kiện**: khi một trong hai bảng vượt ~vài triệu dòng hoặc khi job retention bắt đầu
  chạy quá lâu/khoá bảng. Ở quy mô hiện tại CHƯA đáng làm.
- **Trạng thái**: đề xuất, chưa duyệt (chốt 20/7/2026 — làm sau).

## 17. Dữ liệu `admin.*` cũ còn sót trong `system_logs`

- **Bối cảnh**: trước khi có `activity_logs`, các thao tác admin (`admin.usage.meta`,
  `admin.usage.export`, `admin.usage.sessions`, `admin.usage.alerts`, `admin.devtools`)
  được ghi INFO vào `system_logs`. Đó thực chất là activity log nằm nhầm chỗ.
- **Đã làm (20/7/2026)**: tab "Log lỗi hệ thống" lọc bỏ `module NOT LIKE 'admin.%'` nên
  các dòng này không còn gây nhiễu; 6 điểm gọi đã chuyển sang ghi `activity_logs` (giai
  đoạn chuyển tiếp ghi CẢ HAI chỗ).
- **CỐ Ý KHÔNG migrate dữ liệu cũ**: `message` là chuỗi tự do (`"actor=x, eventId=y,
  subjectUser=z"`), parse ngược ra `userId`/`targetId` chắc chắn sai ở một số dòng. Dữ liệu
  cũ sẽ TỰ HẾT khi retention 180 ngày của `system_logs` quét qua.
- **⏰ VIỆC CÒN NỢ — HẠN 2026-08-31** (sau 1 kỳ quan sát trọn tháng 8): BỎ lệnh
  `systemLogService.info(...)` ở **7 điểm gọi** đang ghi song song để hết ghi trùng.
  Tìm bằng: `grep -rn "admin.usage.\|admin.devtools" backend/src/main/java`. Danh sách:
  1. `UsageQueryServiceImpl.eventMeta` — `admin.usage.meta`
  2. `UsageQueryServiceImpl.exportEvents` — `admin.usage.export`
  3. `UsageQueryServiceImpl.getUserSessions` — `admin.usage.sessions`
  4. `UsageAlertServiceImpl.ack` — `admin.usage.alerts`
  5. `UsageAlertServiceImpl.updateConfig` — `admin.usage.alerts`
  6. `TokenCreditServiceImpl.devSeed` — `admin.devtools`
  7. `RevenueServiceImpl.devSeed` — `admin.revenue.devseed` (chưa chuyển sang activity log —
     cân nhắc thêm action hoặc bỏ hẳn khi gỡ dev seeder theo §2b)
  Điều kiện dừng dual-write: tab hoạt động đã chạy ổn 1 tháng, không phát hiện thiếu vết.
- **Trạng thái**: chờ tới hạn 2026-08-31.

## 18. Card-list cho bảng trên mobile (tính năng của `DataTable`)

- **Bối cảnh**: mọi bảng quản trị hiện xử lý mobile bằng cuộn ngang (`DataTable` bọc
  `overflow-x: auto` + `minWidth`). Bảng nhiều cột (nhật ký usage 10 cột, log hoạt động
  7 cột) phải kéo ngang khá nhiều trên điện thoại.
- **Điều kiện**: nếu làm card-list thì phải làm thành TÍNH NĂNG CỦA `DataTable` áp cho
  TOÀN DỰ ÁN (vd prop `mobileCard` nhận renderer cho mỗi dòng), không nhét riêng cho 1-2
  bảng — nếu không sẽ có hai pattern responsive song song, đúng thứ `rule.md` muốn tránh.
- **Trạng thái**: đề xuất, chưa duyệt (chốt 20/7/2026 — giữ cuộn ngang).

## 19. Whitelist miễn chống trùng cho action bảo mật + trần theo IP

- **Bối cảnh (chốt 2026-07-20)**: quy tắc chống trùng 60s (cùng `userId+action+targetId` chỉ ghi
  1 dòng) là đúng cho thao tác nghiệp vụ, nhưng SAI với action mà **tần suất chính là dữ liệu**:
  gộp 50 lần `LOGIN_FAILED` trong một phút thành 1 dòng làm log mất sạch giá trị điều tra
  brute-force.
- **Đã làm**: `ActivityAction.DEDUP_EXEMPT` (hiện chỉ chứa `LOGIN_FAILED`) được MIỄN dedup hoàn
  toàn — không dùng cửa sổ ngắn hơn vì đó là giải pháp nửa vời. Bù lại rủi ro phình bảng bằng
  **trần theo IP**: tối đa `ACTIVITY_LOG_IP_HOURLY_CAP` (mặc định 100) dòng/IP/giờ cho các action
  trong nhóm này; đúng lúc chạm trần ghi **một** dòng tổng hợp (`metadata.floodSuppressed = true`)
  để người điều tra biết log bị cắt từ mốc nào, sau đó im lặng tới hết cửa sổ giờ.
  Bản ghi `LOGIN_FAILED` luôn mang **email đã nhập** (kể cả tài khoản không tồn tại), **IP**,
  **User-Agent** và lý do (`USER_NOT_FOUND` / `INVALID_CREDENTIALS` / `USER_INACTIVE`).
- **Nguyên tắc khi mở rộng**: CHỈ thêm action vào `DEDUP_EXEMPT` khi tần suất của nó là dữ liệu
  bảo mật. Đừng thêm action thường vào đây chỉ vì "muốn ghi đủ" — dedup tồn tại có lý do.
- **Còn cân nhắc**: trần hiện đếm theo IP; kẻ tấn công đổi IP (botnet/proxy xoay) vẫn vượt được.
  Nếu cần chặt hơn thì phải chuyển sang rate-limit ở tầng request (Redis, trước cả khi vào
  service) — đó là việc của module chống brute-force đăng nhập, không phải của activity log.
- **Trạng thái**: đã làm phần trần theo IP; rate-limit tầng request chưa cần.
