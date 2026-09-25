# PAYMENT_PROGRESS — Bàn giao tiến trình tính năng Thanh toán gói dịch vụ (payOS)

> **File tạm bàn giao giữa các phiên. ĐÃ XONG CẢ 7 BƯỚC (2026-09-23) — `docs/PAYMENT.md` đã
> viết xong, file này có thể xoá.**
>
> ⚠️ **Đọc trước khi xoá**: hai thứ dưới đây CHỈ có ở file này, `PAYMENT.md` không chép lại vì
> chúng thuộc về quá trình làm chứ không phải tài liệu vận hành. Nếu còn cần thì chép sang chỗ
> khác trước:
> - **§8b — script oracle sinh test vector chữ ký** (Node, chép nguyên văn `sortObjDataByKey` +
>   `convertObjToQueryStr` của SDK payOS). Cần khi phải sinh lại vector, vd lúc đổi
>   `PayOSSignature.ACTIVE_STYLE`.
> - **§8 — bảng 9 test vector + 3 quirk của SDK** đã phát hiện (`[object Object]`, chuỗi
>   `"null"`/`"undefined"` bị coi như rỗng, ranh giới `2^53`). Phần assert vẫn nằm trong
>   `PayOSSignatureTest`, nhưng lý do *vì sao* thì ở đây.
>
> - Bắt đầu: 2026-09-22
> - Trạng thái: **XONG 7/7** — xem `docs/PAYMENT.md` (tài liệu chính thức) và
>   `docs/PLAN.md` (mục 2026-09-23)
> - Branch: `main`, **thay đổi CHƯA commit** (xem §7)

---

## 1. Bối cảnh — đọc trước khi làm gì

**Cổng thanh toán là payOS, KHÔNG phải VNPay.** Dự án đã chốt payOS từ 2026-07-20
(`docs/ROADMAP_FUTURE.md` §2/§2b). Phiên trước có một lần nhầm sang VNPay và đã được sửa —
**không thêm `PaymentGateway.VNPAY`, không có file/env/DTO nào mang tên VNPay.**

Hạ tầng **đã có sẵn từ trước** (đừng xây lại):

| Đã có | Ở đâu |
|---|---|
| Sổ cái `payments` đầy đủ | `entity/Payment.java`, index ở `config/PaymentDataInitializer` |
| Khoá idempotency webhook | partial unique `uk_payments_gateway_txn` + `PaymentRepository.findByGatewayTxnIdAndDeletedAtIsNull` |
| Trang admin **Quản lý gói** (CRUD, không hardcode) | `PlanAdminController` `/admin/plans` + `pages/admin/Plans.tsx` |
| Trang admin **Thống kê doanh thu** | `AdminRevenueController` `/admin/revenue` + `pages/admin/Revenue.tsx` |
| **Feature gating THẬT** | `TokenUsageService.checkQuota()` đọc `Plan.monthlyTokenLimit`, chặn 429 tại **6 điểm** (tạo/tạo lại/định dạng nội dung, trend research, tối ưu chiến lược, job 2h sáng) |
| Subscription | `entity/Subscription.java` + `SubscriptionServiceImpl.getOrCreate()` |
| Scheduler / async worker / notification / email (Brevo) / audit log `activity_logs` | `scheduler/`, `AsyncConfig`, `NotificationService`, `ActivityLogService` |
| Endpoint public không JWT (mẫu) | `SecurityConfig.PUBLIC_ENDPOINTS` — `/webhooks/meta`, `/connections/*/callback` |
| `ActivityAction` nhóm BILLING khai sẵn | `PLAN_CHANGED`, `PAYMENT_SUCCEEDED`, `PAYMENT_FAILED` |

**Chưa có**: luồng tạo đơn, webhook, trang Billing phía user, trang admin quản lý ĐƠN HÀNG
(có thao tác), job hết hạn đơn, job hạ gói, cột hạn chờ/ngày hết hạn gói.

---

## 2. Quyết định đã CHỐT (user đã duyệt — không mở lại)

| # | Nội dung |
|---|---|
| **Q1** | Mua **trùng gói** → cộng dồn hạn. **Nâng gói** → thay thế, hạn = `now + chu kỳ` (bỏ phần dư gói cũ). **Mua gói thấp hơn khi còn hạn** → CHẶN (`PLAN_DOWNGRADE_NOT_ALLOWED` 2072). Định nghĩa nâng/hạ: **dùng lại `SubscriptionServiceImpl.isDowngrade()`** đang có (so `Plan.monthlyTokenLimit`, null = không giới hạn = cao nhất) — không đẻ tiêu chí thứ hai. |
| **Q2** | **Tối đa 1 đơn PENDING/user.** Cùng gói → trả lại `checkoutUrl` cũ, giữ nguyên `expiresAt`. Khác gói → huỷ đơn cũ (`CANCELLED`, reason `REPLACED_BY_NEW_ORDER`) rồi tạo đơn mới. |
| **Q3** | Thêm `PaymentStatus.EXPIRED` + `CANCELLED` riêng, **không** gộp vào `FAILED`. |
| **Q4** | Bán **mọi gói `isActive && price > 0`** (kể cả gói admin tự tạo). `Subscription` thành nguồn sự thật hoàn toàn; `User.plan` hạ xuống thành **cache một chiều** (sub → user), giữ nguyên nhãn cũ khi gói không khớp enum `UserPlan`. |

**Giả định đã duyệt:**

1. **Kỳ hạn mức token giữ nguyên tháng lịch.** `currentPeriodStart/End` không đổi nghĩa; vòng đời gói nằm ở cột mới `planStartedAt/planExpiresAt`. **Không** refactor query usage/rollup.
2. Tiền tệ chỉ **VND**; `invoiceNo` tự sinh `INV-yyyyMM-######` khi đơn chuyển PAID. **Chưa tách VAT**.
3. **Giữ dev seeder** `/admin/revenue/dev-seed` tới lúc go-live thật; đưa việc gỡ vào checklist `docs/PAYMENT.md`.
4. `PaymentGateway.PAYOS` giữ nguyên, chỉ **thêm `MOCK`**. Roadmap giữ nguyên payOS.
5. **Không thêm thư viện** — HMAC bằng `javax.crypto.Mac`; HTTP bằng `WebClient` sẵn có.
6. **Chưa làm refund/hoàn tiền qua API payOS** (cột `refundedAmount/refundedAt` đã có, admin ghi tay được). Ngoài phạm vi.

**Sửa lại so với kế hoạch gốc:** `RevenueServiceImpl` và `PaymentRepository.aggregateTotals`
**KHÔNG cần đụng**. Đã kiểm: `failureRatePct = failed/(txnCount + failed)` với `failedCount`
đếm đúng literal `'FAILED'` và `txnCount` đếm `revenueRecognizedNames()` → `EXPIRED`/`CANCELLED`
tự động không rơi vào vế nào. `RevenueAggregateTest` 14/14 pass sau khi thêm 2 enum value.

---

## 3. Sự thật về API payOS — ĐÃ XÁC MINH

Nguồn: [payOS API](https://payos.vn/docs/api/) · [Kiểm tra dữ liệu với signature](https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/) · [payos-lib-golang v2](https://pkg.go.dev/github.com/payOSHQ/payos-lib-golang/v2)

| Hạng mục | Giá trị |
|---|---|
| Base URL | `https://api-merchant.payos.vn` |
| Tạo link | `POST /v2/payment-requests` — **server-to-server**, nhận `data.checkoutUrl` |
| Tra cứu | `GET /v2/payment-requests/{id}` — `{id}` nhận **paymentLinkId HOẶC orderCode** |
| Huỷ link | `POST /v2/payment-requests/{id}/cancel` |
| Đăng ký webhook | `POST /confirm-webhook`, body `{webhookUrl}` |
| Header auth | `x-client-id` + `x-api-key` |
| Thuật toán ký | **HMAC-SHA256** với `checksumKey` |
| `amount` | **VND nguyên, KHÔNG nhân 100** |
| `orderCode` | **integer** |
| `expiredAt` | **Unix timestamp giây, Int32** |
| `description` | tài liệu ghi **tối đa 9 ký tự** với TK ngân hàng chưa liên kết payOS |

**Chuỗi ký khi TẠO link** — đúng 5 trường, alphabet, **KHÔNG URL-encode**:
```
amount=$amount&cancelUrl=$cancelUrl&description=$description&orderCode=$orderCode&returnUrl=$returnUrl
```

**Chuỗi ký khi VERIFY webhook** — ký trên **object `data`** (không phải cả payload): mọi key
sắp alphabet, nối `key=value&...`, null/undefined → chuỗi rỗng, mảng lồng → JSON. So với
trường `signature` ở **cấp ngoài cùng**.
> ⚠️ `encodeURIComponent` CHỈ áp cho API **Payouts (chi tiền)** — KHÔNG áp cho payment-requests.

**7 trạng thái link** (SDK Go chính thức `PaymentLinkStatus`):
`PENDING` · `PROCESSING` · `PAID` · `UNDERPAID` · `CANCELLED` · `EXPIRED` · `FAILED`
> Trang tổng quan API ghi `SUCCEEDED` — **mâu thuẫn với SDK**. Lấy theo SDK (`PAID`).

### ⚠️ Cái bẫy lớn nhất: `UNDERPAID`

Webhook trả `code = "00"` nghĩa là **một lệnh chuyển tiền thành công**, KHÔNG phải đơn đã đủ
tiền. Khách chuyển thiếu → link thành `UNDERPAID` nhưng webhook **vẫn** `code = "00"`.

→ **Không bao giờ kích hoạt gói chỉ dựa vào `code == "00"`.** Điều kiện kích hoạt:
chữ ký hợp lệ **VÀ** `data.amount == payment.amount` (khớp tuyệt đối) **VÀ** link `PAID`.
Lệch (thiếu HOẶC thừa) → `reconcileRequired = true` + notify admin, **không** kích hoạt.

### Bảng map trạng thái (đã chốt)

| payOS | `PaymentStatus` nội bộ | Kích hoạt gói? | Ghi chú |
|---|---|---|---|
| `PENDING` | `PENDING` | ✗ | chờ |
| `PROCESSING` | `PENDING` | ✗ | **KHÔNG huỷ** — xem điểm B §5 |
| `PAID` + amount khớp | `PAID` | **✓** | đường thành công duy nhất |
| `PAID` + amount lệch | `PAID` | ✗ | `reconcileRequired` + notify admin |
| `UNDERPAID` | `PENDING` | ✗ | `reconcileRequired` + notify admin |
| `CANCELLED` | `CANCELLED` | ✗ | |
| `EXPIRED` | `EXPIRED` | ✗ | |
| `FAILED` | `FAILED` | ✗ | vào tỉ lệ thất bại |
| *giá trị lạ* | giữ nguyên | ✗ | `reconcileRequired` + log ERROR |

### Chưa xác minh được — phải kiểm khi có tài khoản thật

1. **Body response webhook payOS mong đợi.** SDK Node minh hoạ `{success: true}`; không tìm được đặc tả chính thức. → Trả `HTTP 200 + {"success": true}`, ghi comment nói rõ chưa xác minh. **payOS RETRY webhook nếu không nhận 200** → mọi nhánh (kể cả lỗi nội bộ đã log) vẫn phải trả 200 **sau khi đã lưu `rawPayload`**.
2. **`description` max chính xác khi TK đã liên kết payOS.** Mặc định 9 (an toàn), đọc từ `payos.description-max-length`.
3. **`PAID` vs `SUCCEEDED`** — SDK và trang tổng quan mâu thuẫn. Code fail-safe với giá trị lạ.
4. **Giới hạn khoảng `expiredAt`.** TTL 15 phút chắc chắn hợp lệ; API từ chối sẽ thấy ở Bước 3.
5. **Trần `orderCode`** — kiểm khi gọi thử ở Bước 3; nếu API từ chối 15 chữ số thì hạ xuống 12.

---

## 4. Kiến trúc đã chốt

### Luồng

```
POST /payments/checkout {planId}
  tx1: validate (plan bán được, Q1 nâng/hạ, Q2 đơn pending)
       sinh orderCode → INSERT payments PENDING, gatewayTxnId=orderCode,
       expiresAt = now + TTL                                       COMMIT
  ── NGOÀI transaction (rule #24) ──
       PaymentGatewayClient.createPaymentLink(...) → POST /v2/payment-requests
  tx2: lưu checkoutUrl + gatewayLinkId      (lỗi HTTP → tx2 set FAILED)
  → trả {paymentId, checkoutUrl, expiresAt}

returnUrl / cancelUrl → FE /billing/return
  payOS gắn query (code,id,cancel,status,orderCode) — KHÔNG có chữ ký
  → FE TUYỆT ĐỐI không tin; chỉ lấy orderCode rồi gọi
     POST /payments/{id}/verify → BE gọi GET /v2/payment-requests/{orderCode}
                                → đồng bộ qua CÙNG code path webhook
  (đây cũng là đường DUY NHẤT test được ở localhost — webhook không tới được máy dev)

WEBHOOK (nguồn sự thật)  POST /webhooks/payos   [public, không JWT]
  1. lưu rawPayload NGAY
  2. verify chữ ký trên data     → sai: log WARN, trả 200, KHÔNG nêu lý do
  3. orderCode không có trong DB → 200 + bỏ qua
     ⚠️ BẮT BUỘC: payOS gửi giao dịch MẪU (orderCode=123) lúc /confirm-webhook.
        Trả lỗi ở đây = ĐĂNG KÝ WEBHOOK THẤT BẠI.
  4. SELECT ... FOR UPDATE + đã PAID → idempotent, thoát
  5. đơn đã EXPIRED/CANCELLED mà tiền về → reconcileRequired + notify admin
  6. áp bảng map §3 → PAID+khớp tiền thì activatePaidPlan + activity log + notification
  7. trả HTTP 200

PaymentExpiryJob (fixedDelay 1 phút)
  PENDING + expiresAt <= now → GET /v2/payment-requests/{orderCode}  [đối soát TRƯỚC khi đóng]
    PAID       → kích hoạt (cứu đơn webhook không tới)
    PROCESSING → gia hạn, KHÔNG đóng (điểm B)
    khác       → closeLinkSafely() → POST /{orderCode}/cancel rồi set EXPIRED

SubscriptionExpiryJob (cron 0 5 0 * * *)
  planExpiresAt <= now → hạ về FREE + notification
  + kiểm tra LAZY trong SubscriptionServiceImpl.getOrCreate() (không phụ thuộc cron)
```

### Adapter

`service/PaymentGatewayClient` (tên theo tiền lệ `MetaApiClient`/`AiServiceClient`; **không**
đặt `PaymentGateway` vì trùng tên enum `com.aima.enums.PaymentGateway`):

```java
PaymentGateway gateway();                                 // PAYOS | MOCK
GatewayLink   createPaymentLink(Payment p, String desc);   // → checkoutUrl, linkId
GatewayOrder  getPaymentLink(String orderCode);            // đối soát
void          cancelPaymentLink(String orderCode, String reason);
WebhookData   verifyWebhook(String rawBody);               // sai chữ ký → AppException
```

Hai bean: `PayOSGatewayClientImpl`, `MockGatewayClientImpl`; chọn bằng `PAYMENT_GATEWAY` —
cùng mẫu `Map<Platform, PlatformPublisher>` ở worker đăng bài.

**MockGateway**: `checkoutUrl = {FE}/billing/mock/{paymentId}`; trang FE có 3 nút
*Thành công / Thất bại / Timeout* → `POST /payments/mock/{id}/{outcome}` (DEV-ONLY, khoá bằng
`PAYMENT_GATEWAY=mock` + `AIMA_PRODUCTION_MODE`) → chạy qua **đúng**
`PaymentServiceImpl.applyGatewayResult(...)` mà webhook dùng, **không** phải nhánh code riêng.

### Sinh `orderCode`

`SecureRandom` **15 chữ số**, khoảng `[10^14, 10^15)`. Trần `10^15` < `9.007×10^15` (JS safe
integer — payOS trả orderCode dạng **JSON number**). Không lộ thứ tự/khối lượng đơn. Trùng thì
retry tối đa 5 lần (`PAYMENT_ORDER_CODE_UNAVAILABLE` 2081); chốt chặn cuối là partial unique
`uk_payments_gateway_txn` đã có sẵn.

---

## 5. Các điểm siết đã yêu cầu (A–G + 3 điểm hardening) — PHẢI làm đủ

| # | Nội dung | Làm ở bước |
|---|---|---|
| **A** | **Parse số webhook.** `PayOSSignature.parse()` → `JsonNode`, bật `USE_BIG_DECIMAL_FOR_FLOATS` **và tắt `JsonNodeFeature.STRIP_TRAILING_BIGDECIMAL_ZEROES`**. **KHÔNG** deserialize vào POJO trước khi ký, **KHÔNG** đi qua `double`. So tiền: `asLong()` rồi so `==` với `Long`, không qua float, không `BigDecimal.equals`. ⚠️ **ĐÃ ĐẢO phần định dạng số**: mô phỏng `Number.prototype.toString()` của JS (bỏ số 0 thừa) vì hành vi SDK payOS = spec thực tế — xem §8. Vẫn không đi qua `double`. | ✅ 2 (parse/ký) · **so tiền** ở bước 5 |
| **B** | **`PROCESSING` KHÔNG huỷ.** Cột `expiry_grace_count`; gặp `PROCESSING` → `expiresAt += payment.grace-minutes` (mặc định 10) và `+1`. Vượt `payment.max-grace-rounds` (mặc định 3) → `reconcileRequired = true` + notify admin, **vẫn giữ `PENDING`**. | 5 |
| **C** | **Race cancel/PAID.** Gom thành `closeLinkSafely(payment, reason)` dùng chung cho **cả 3 chỗ** gọi cancel (job hết hạn, user tự huỷ, Q2 huỷ đơn cũ): `cancelPaymentLink` lỗi → **bắt buộc** `getPaymentLink` lấy trạng thái thật → `PAID` thì đi `applyGatewayResult`. Chỉ set `EXPIRED`/`CANCELLED` khi **xác nhận được** link không PAID. Không xác nhận được (payOS down) → giữ `PENDING` + `reconcileRequired`, thử lại vòng sau. | 4–5 |
| **D** | **Chặn 2 đơn PENDING** (bấm đúp / 2 tab). Partial unique index — ✅ **đã làm Bước 1**. | ✅ 1 |
| **E** | **`expiresAt` một nguồn.** Tính **một lần** ở tx1; gửi payOS `expiredAt = expiresAt.atZone(APP_TIMEZONE).toEpochSecond()`. Q2 tái dùng link cũ: gọi `getPaymentLink` **trước**, chỉ trả lại `checkoutUrl` khi payOS còn `PENDING`/`PROCESSING`; khác → đồng bộ rồi tạo đơn mới. Ghi vào `docs/PAYMENT.md`. | 4 |
| **F** | **Bảo vệ webhook public.** `@RequestBody String` + kiểm `length()` trước khi parse (trần `payment.webhook-max-body-bytes`, mặc định 16 KB) → quá cỡ: 200, bỏ qua, log WARN. Rate limit theo IP **dùng lại cơ chế đã có** `ActivityLogWriterImpl` (trần/IP/giờ) — không kéo Redis bucket mới. Sai chữ ký → `log.warn` + 200, **không nêu lý do**. | 5 |
| **G** | **Quota giảm NGAY khi hạ gói.** ⚠️ Xem §6 — logic hiện tại sẽ **revert** việc hạ gói. | 4 |
| **H1** | **Verify index nghiệp vụ tồn tại thật** (query `pg_indexes`), thiếu → log **ERROR** kèm tên index. ✅ **đã làm Bước 1** (`verifyCriticalIndexes()`). Còn phải ghi vào checklist go-live của `docs/PAYMENT.md`. | ✅ 1 / doc ở 7 |
| **H2** | **Bắt `DataIntegrityViolationException`** trong `PaymentServiceImpl.checkout` → dịch sang luồng Q2 (đọc lại đơn PENDING, trả `checkoutUrl` cũ nếu cùng gói, hoặc `PAYMENT_PENDING_EXISTS` 2073 nếu khác gói). **Không để lộ lỗi DB ra client / không 500.** Test mô phỏng 2 luồng đồng thời. | **4** |
| **H3** | **Cột mới + `ddl-auto: update` trên bảng có dữ liệu.** ✅ **đã làm Bước 1** — `columnDefinition` có DEFAULT + câu UPDATE backfill NULL. | ✅ 1 |

---

## 6. ✅ Bẫy hạ gói — ĐÃ XỬ LÝ ở Bước 4 (giữ lại để hiểu vì sao code như vậy)

**Hạ gói sẽ bị HUỶ ngay ở request kế tiếp nếu chỉ ghi `subscription.plan`.**

`TokenUsageServiceImpl.state()` đọc `subscription.getPlan().getMonthlyTokenLimit()` **live** →
hạn mức giảm ngay khi `subscription.plan` đổi. Phần đó ổn.

Nhưng `SubscriptionServiceImpl.getOrCreate()` đồng bộ subscription **theo `User.plan`** mỗi lần
được gọi:

```
job:  subscription.plan = FREE            (User.plan vẫn = PRO)
API kế tiếp → getOrCreate():
      planCode("PRO") != subscription.plan("FREE")  → vào nhánh sync
      isDowngrade(current=FREE, target=PRO)         → false (PRO limit lớn hơn)
      → subscription.setPlan(PRO)          ⚠️ KHÔI PHỤC LẠI GÓI PRO
```

**Đã xử lý ở Bước 4 — xem §10.** Ghi CẢ HAI trong cùng transaction là chưa đủ; còn phải
chặn nhánh sync bằng `planSource != FREE`, vì gói admin tự tạo không có nhãn enum nên hai
bên lệch nhau một cách hợp lệ. Nguyên văn cách xử lý ban đầu:

**Cách xử lý** (nằm trong Q4, không mở rộng phạm vi): mọi thao tác thanh toán/hết hạn ghi
**CẢ HAI** trong **cùng transaction** — `subscription.plan` + `planExpiresAt` + `planSource`,
**VÀ** `User.plan` (khớp enum thì set; gói ngoài `FREE/PLUS/PRO` thì giữ nhãn cũ). Hai bên luôn
khớp → nhánh sync theo nhãn thành no-op → không revert.

**Giữ nguyên** semantics đường admin đổi `User.plan` qua `PATCH /users` (hạ gói hoãn tới hết kỳ,
`pendingPlanChangeAt` vẫn chạy) — đừng phá.

**Test bắt buộc** — ĐÃ CÓ: `SubscriptionLifecycleTest.expiredProPlan_staysDowngraded_soQuotaActuallyDrops` (PRO hết hạn giữa tháng → hạ Free → lần đọc kế tiếp vẫn là FREE, hạn
mức đúng của FREE). Phần `checkQuota` ném `TOKEN_QUOTA_EXCEEDED` đọc hạn mức này **live** nên
không cần test lặp lại ở tầng đó.

---

## 7. ✅ BƯỚC 1 — XONG

**Nghiệm thu:** `mvnw compile` pass · `npm run build` pass (tsc + vite, 14.4s) ·
`mvnw test` = **131 test, 13 fail** — đã xác minh bằng `git stash` là **đúng 13 fail có sẵn từ
trước** (`AccountManagementTest` 8 + `BrandProfileTest` 5, tất cả `expected:<200> but was:<401>`),
**0 fail mới** · `RevenueAggregateTest` 14/14 pass · không trùng mã `ErrorCode`.

### File đã đổi (CHƯA COMMIT)

```
M backend/.env.example                                         + 13 biến (placeholder rỗng)
M backend/src/main/java/com/aima/config/PaymentDataInitializer.java
M backend/src/main/java/com/aima/entity/Payment.java           + 5 cột
M backend/src/main/java/com/aima/entity/Subscription.java      + 3 cột
M backend/src/main/java/com/aima/enums/PaymentGateway.java     + MOCK
M backend/src/main/java/com/aima/enums/PaymentStatus.java      + EXPIRED, CANCELLED
M backend/src/main/java/com/aima/exception/ErrorCode.java      + 2070–2083 (14 mã)
M backend/src/main/resources/application.yml                   + khối payment: / payos:
M frontend/src/api/revenue.ts                                  union + 2 case badge (neutral)
M frontend/src/i18n.ts                                         + revStatusExpired/Cancelled (vi+en)
M frontend/src/pages/admin/Revenue.tsx                         + 2 option bộ lọc
?? backend/src/main/java/com/aima/enums/PlanSource.java        MỚI: FREE|PAYMENT|ADMIN
```

### Chi tiết đáng nhớ

- `Payment` + `gatewayLinkId`, `checkoutUrl`, `expiresAt`, `expiryGraceCount`, `reconcileRequired`.
- `Subscription` + `planStartedAt`, `planExpiresAt`, `planSource`.
- **`columnDefinition` có DEFAULT** trên 3 cột NOT NULL mới (`expiry_grace_count`,
  `reconcile_required`, `plan_source`). **Lý do bắt buộc**: bảng đã có dữ liệu, `ddl-auto: update`
  sinh `ALTER TABLE ADD COLUMN ... not null` — PostgreSQL **từ chối** câu đó trên bảng không rỗng
  nếu cột không có DEFAULT, Hibernate chỉ log warning rồi đi tiếp → **cột không được tạo và app vỡ
  lúc chạy**. Tiền lệ: `Plan.billingIntervalMonths`.
- `PaymentDataInitializer`: đổi một `try/catch` bọc tất cả → helper `exec()` **try/catch riêng mỗi
  câu** (một câu hỏng không được làm bỏ qua các câu còn lại) + 3 câu UPDATE backfill NULL +
  `verifyCriticalIndexes()`.
- Index chống 2 đơn PENDING có thêm `AND gateway <> 'MANUAL'`:
  ```sql
  CREATE UNIQUE INDEX uk_payments_one_pending_per_user ON payments (user_id)
    WHERE status = 'PENDING' AND deleted_at IS NULL AND gateway <> 'MANUAL';
  ```
  Dev seeder sinh ~350 bản ghi `MANUAL` đủ mọi trạng thái → gần chắc chắn có nhiều `PENDING` cùng
  user → không có mệnh đề này thì index **không tạo được**. Cũng đúng nghiệp vụ: ràng buộc chỉ bảo
  vệ **luồng checkout** (`PAYOS`/`MOCK`).

---

## 8. ✅ BƯỚC 2 — XONG (đã ĐẢO quyết định về scale)

**Nghiệm thu:** `PayOSSignatureTest` **19 test, 0 fail** (18 chạy + 1 `@Disabled` là bộ vector
dự phòng).

### File đã thêm

```
?? backend/src/main/java/com/aima/util/PayOSSignature.java
?? backend/src/test/java/com/aima/payment/PayOSSignatureTest.java
```

### 🔄 ĐẢO QUYẾT ĐỊNH — số thập phân theo SDK, KHÔNG giữ scale

Lập luận đã chốt: chữ ký do **backend payOS** sinh, còn SDK Node là client đã được chứng minh
verify khớp với backend đó → **hành vi SDK chính là spec thực tế**. SDK ký `1234.5` mà ta ký
`1234.50` thì **ta sai**, dù giữ scale "đúng" hơn về mặt số học.

→ Mô phỏng `Number.prototype.toString()` của JS. Toàn bộ logic nằm trong **một hàm duy nhất**
`PayOSSignature.formatJsonNumber(JsonNode, NumberStyle)`. Vẫn **không bao giờ đi qua `double`**:
đọc `BigDecimal` từ text gốc rồi `stripTrailingZeros().toPlainString()` (`toPlainString()` bắt
buộc, thiếu nó `1000.0` ra `1E+3`).

**Lật lại chỉ mất một dòng**: đổi `PayOSSignature.ACTIVE_STYLE` sang `NumberStyle.EXACT_SCALE`,
bỏ `@Disabled` ở `webhookData_exactScaleNumberStyle_standbyVariant` và gắn `@Disabled` cho
`webhookData_jsNumberStyle_isTheActiveVariant`. Cả hai bộ vector đều nằm sẵn trong test.

### Oracle đã nâng cấp: chạy CHÍNH thuật toán SDK payOS

Vector giờ sinh bằng **Node**, chép nguyên văn `sortObjDataByKey` + `convertObjToQueryStr` của
SDK payOS (script ở §8b). Mạnh hơn oracle Python cũ vì nó *là* ngữ nghĩa JS chứ không phải mô
phỏng lại. V0 vẫn kiểm chéo phần HMAC bằng RFC 4231. V1/V3/V4 cho ra **y hệt** oracle Python cũ
(các vector đó không có số thập phân).

### Oracle trả lời 3 câu hỏi đối chiếu SDK

| Câu hỏi | Kết quả oracle |
|---|---|
| Mảng lồng — có sắp key phần tử không? Có đệ quy không? | Sắp key **đúng MỘT cấp**. `sortObjDataByKey` **tự nó không đệ quy** → object nằm sâu hơn giữ NGUYÊN thứ tự gốc. Oracle: `{"zz":1,"aa":2}` lồng trong một phần tử vẫn ra `{"zz":1,"aa":2}`. **Làm đệ quy thật sẽ LỆCH khỏi SDK** — đã cài đúng một cấp (V6). |
| `JSON.stringify` có khoảng trắng không? | Không, sau `:` và `,` đều không. Ta **tự viết serializer** (không gọi Jackson) nên chuỗi ký không phụ thuộc cấu hình/phiên bản thư viện JSON — cũng là một lớp chống nhầm Jackson. |
| Chuỗi trong mảng escape thế nào? | Chỉ `"`, `\` và ký tự điều khiển. Tiếng Việt và en dash giữ **nguyên**, không escape. V6 có đủ `Gói \"PRO\" – dịch vụ`. |

### 3 quirk khác của SDK đã phát hiện và mô phỏng theo

- **V7**: value là object (không phải mảng) → SDK nhét vào template literal nên ra đúng chữ
  `[object Object]`. Mất thông tin nhưng khớp SDK.
- Chuỗi có giá trị đúng bằng `"null"` / `"undefined"` → bị coi như **rỗng** (SDK kiểm bằng
  `includes` trên giá trị đã convert).
- **V8**: `1000.0`→`1000`, `1.0`→`1`, `0.50`→`0.5`, `-0.0`→`0`.

### ⚠️ Ranh giới đã biết, CỐ Ý không mô phỏng

Vượt `2^53-1` thì SDK đi qua `double` và **làm tròn**: `12345678901234567890` → SDK ra
`12345678901234567000`, ta giữ chính xác. Không mô phỏng phần mất mát này vì (a) miền dữ liệu
payOS không chạm ngưỡng (`amount` VND nguyên, `orderCode` 15 chữ số < 2^53 — chính lý do §4
chọn 15 chữ số) và (b) đi qua `double` là thứ §5 điểm A cấm. Có test ghi rõ đây là ranh giới,
không phải bug.

### ⚠️ Bẫy Jackson — `USE_BIG_DECIMAL_FOR_FLOATS` MỘT MÌNH LÀ KHÔNG ĐỦ

Từ **Jackson 2.15**, `JsonNodeFeature.STRIP_TRAILING_BIGDECIMAL_ZEROES` **bật mặc định** và gọi
`BigDecimal.stripTrailingZeros()` ngay lúc dựng `DecimalNode` — node vẫn `isBigDecimal() == true`
nên nhìn qua tưởng đã đúng. Phải tắt tường minh:

```java
JsonMapper.builder()
        .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
        .disable(JsonNodeFeature.STRIP_TRAILING_BIGDECIMAL_ZEROES)
        .build();
```

### Chốt chặn chống nhầm Jackson 2 ↔ Jackson 3

Classpath có **cả hai** (`com.fasterxml.jackson` lẫn `tools.jackson` của Boot 4). Chọn
**Jackson 2** theo tiền lệ `MetaApiClientImpl`. Hai lớp bảo vệ:

1. Cảnh báo `⛔ KHÔNG ĐƯỢC ĐỔI SANG JACKSON 3` ngay đầu javadoc `PayOSSignature`.
2. Test `parse_keepsExactDecimalScale_jacksonTripwire` — kiểm bằng **`EXACT_SCALE`** (biến thể
   JS đang dùng có cắt số 0 nên *không* phân biệt được đường BigDecimal với đường double). Ai
   đổi thư viện hoặc "dọn" cấu hình mapper sẽ thấy đỏ ngay thay vì vỡ chữ ký âm thầm.

### Xác nhận 2 việc nhỏ

- So chữ ký dùng **`MessageDigest.isEqual`** (constant-time), không phải `String.equals`.
- Hex **lowercase** hai phía: `hexdigest()` của Python, `digest('hex')` của Node và
  `HexFormat.of()` của Java đều lowercase — và **V0 neo vào hex đã công bố trong RFC 4231** nên
  không có chuyện oracle và Java cùng sai một kiểu. Charset: cả hai phía encode UTF-8 **tường
  minh** (`update(d,'utf8')` / `StandardCharsets.UTF_8`), và JSON vốn là UTF-8 theo spec; V3/V4
  chứa tiếng Việt nên lệch charset là vector đỏ ngay.

### API thực tế của `util/PayOSSignature`

```java
public final class PayOSSignature {
    public enum NumberStyle { JS, EXACT_SCALE; NumberStyle other(); }
    /** Biến thể ĐANG DÙNG. Lật lại quyết định = đổi đúng dòng này. */
    public static final NumberStyle ACTIVE_STYLE = NumberStyle.JS;

    /** Mapper bật USE_BIG_DECIMAL_FOR_FLOATS + TẮT STRIP_TRAILING_BIGDECIMAL_ZEROES. */
    public static JsonNode parse(String rawBody);
    public static String createLinkData(long orderCode, long amount, String description,
                                        String cancelUrl, String returnUrl);
    public static String webhookData(JsonNode data);                       // = ACTIVE_STYLE
    public static String webhookData(JsonNode data, NumberStyle style);    // biến thể kia: chẩn đoán
    /** HÀM DUY NHẤT quyết định định dạng số — mọi tranh cãi về scale chỉ nằm ở đây. */
    public static String formatJsonNumber(JsonNode node, NumberStyle style);
    public static String hmacSha256Hex(String data, String checksumKey);   // hex lowercase, UTF-8
    public static boolean matches(String expected, String actual);         // MessageDigest.isEqual
}
```

### TEST VECTOR — bake nguyên văn vào test

`checksumKey` cho mọi vector trừ V0: **`aima-test-checksum-key`**

| # | Nội dung kiểm | Chữ ký |
|---|---|---|
| **V0** | RFC 4231 Test Case 2 (`key=Jefe`, `data=what do ya want for nothing?`) — neo phần HMAC/hex vào hex đã công bố, độc lập với oracle | `5bdcc146…ec3843` |
| **V1** | Chuỗi ký tạo link, `cancelUrl` CHỨA SẴN query string → giữ nguyên xi `?` và `=` | `9f8ecef7…93f6e7` |
| **V3** | `description` tiếng Việt `Gói dịch vụ PRO` — pin bytes UTF-8 | `2c17b0bf…358a00` |
| **V4** | Ví dụ 16 field trong tài liệu payOS, bọc trong envelope webhook thật | `572678d6…76ef34` |
| **V5js** | **BIẾN THỂ ĐANG DÙNG** — `rate` ra `1234.5`; `2^53-1`; field lạ; `null`→rỗng | `354a5f39…45af53` |
| **V5exact** | Biến thể dự phòng `@Disabled` — `rate` ra `1234.50` | `a12458f3…61224f` |
| **V6** | Mảng: sắp key phần tử MỘT cấp, object lồng sâu giữ nguyên thứ tự, escape kiểu `JSON.stringify`, `1500.50`→`1500.5` | `b47a3a89…426089` |
| **V7** | Value là object → `[object Object]` | `376f5402…568eab` |
| **V8** | `1000.0`→`1000`, `1.0`→`1`, `0.50`→`0.5`, `-0.0`→`0` | `61c734e7…530351` |

Chuỗi ký đầy đủ của V4/V5js/V6 nằm trong assert của `PayOSSignatureTest` — đọc ở đó, đừng chép
lại vào đây để tránh hai nguồn sự thật.

### Các nhóm test khác (19 test, 1 `@Disabled`)

- `webhookData`: **không hard-code danh sách key** — field lạ vẫn ký đủ (V5), thiếu field thì
  không xuất hiện trong chuỗi · `null`/không phải object → `AppException`.
- V4 bọc trong **envelope webhook thật** để pin việc ký trên `data` chứ không phải cả payload,
  và so với `signature` ở cấp ngoài cùng.
- Chuỗi `"null"` / `"undefined"` → rỗng (quirk SDK).
- Ranh giới `2^53` — test ghi rõ là ranh giới đã biết, không phải bug.
- `matches()`: khớp · khác hoa/thường hex vẫn khớp · sai chữ ký · `null` một bên / hai bên.
- `parse()`: body rỗng / JSON hỏng → `AppException(PAYMENT_SIGNATURE_INVALID)`.
- V3 kèm `assertEquals(15, description.length())` làm chốt chặn encoding: file nguồn bị đọc sai
  charset sẽ đỏ ở đó kèm thông báo rõ, thay vì đỏ mơ hồ ở chữ ký.

### §8b. Oracle sinh lại vector

**Oracle chính (Node)** — chép nguyên văn SDK payOS, dùng cho MỌI vector webhook:

```js
// node oracle.js
const crypto = require('crypto');
const KEY = 'aima-test-checksum-key';
const sortObjDataByKey = o => Object.keys(o).sort().reduce((a, k) => { a[k] = o[k]; return a; }, {});
const convertObjToQueryStr = o => Object.keys(o).filter(k => o[k] !== undefined).map(k => {
  let v = o[k];
  if (v && Array.isArray(v)) v = JSON.stringify(v.map(x => sortObjDataByKey(x)));
  if ([null, undefined, 'undefined', 'null'].includes(v)) v = '';
  return `${k}=${v}`;
}).join('&');
const data = convertObjToQueryStr(sortObjDataByKey(JSON.parse('JSON_HERE')));
console.log(data);
console.log(crypto.createHmac('sha256', KEY).update(data, 'utf8').digest('hex'));
```

**Oracle phụ (Python)** — chỉ để ký một chuỗi đã có sẵn (V0/V1/V3 và bộ `EXACT_SCALE`):

```bash
# Windows: PHẢI set PYTHONIOENCODING=utf-8, không thì stdout cp1252 vỡ ở ký tự tiếng Việt
PYTHONIOENCODING=utf-8 python -c "
import hmac,hashlib
print(hmac.new(b'aima-test-checksum-key', 'DATA_HERE'.encode('utf-8'), hashlib.sha256).hexdigest())"
```

---

## 9. ✅ BƯỚC 3 — XONG

**Nghiệm thu:** `PayOSGatewayClientImplTest` **16/16 pass** (mockwebserver) · toàn suite
**166 test, 13 fail** — vẫn đúng 13 fail có sẵn, **0 fail mới**, 1 skipped (vector dự phòng).

### File mới

```
?? backend/src/main/java/com/aima/enums/GatewayLinkStatus.java
?? backend/src/main/java/com/aima/config/PaymentProperties.java
?? backend/src/main/java/com/aima/config/PayOSProperties.java
?? backend/src/main/java/com/aima/config/PayOSWebClientConfig.java
?? backend/src/main/java/com/aima/dto/payos/CreatePaymentLinkPayload.java
?? backend/src/main/java/com/aima/dto/payos/CancelPaymentLinkPayload.java
?? backend/src/main/java/com/aima/mapper/PayOSMapper.java
?? backend/src/main/java/com/aima/service/PaymentGatewayClient.java
?? backend/src/main/java/com/aima/service/Impl/PayOSGatewayClientImpl.java
?? backend/src/main/java/com/aima/service/Impl/MockGatewayClientImpl.java
?? backend/src/test/java/com/aima/payment/PayOSGatewayClientImplTest.java
```

### File CÓ SẴN đã sửa (chỉ thêm, không đổi cái đang chạy)

| File | Thay đổi |
|---|---|
| `exception/ErrorCode.java` | +2 mã: `PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH` (2084), `PAYMENT_GATEWAY_TIMEOUT` (2085) |
| `resources/application.yml` | +2 khoá trong block `payos:`: `connect-timeout-seconds`, `read-timeout-seconds` |
| `.env.example` | +`PAYOS_CONNECT_TIMEOUT_SECONDS`, `PAYOS_READ_TIMEOUT_SECONDS` |

### 🐛 Bug thật do test bắt được — phân loại lỗi KHÔNG được dựa vào kiểu ngoại lệ

Bản đầu phân loại theo kiểu: `WebClientResponseException` → "cổng từ chối", còn lại → "không
kết luận được". Test timeout **đỏ ngay**: read-timeout xảy ra **sau khi header đã về** vẫn ném
đúng kiểu đó, mang status **`200 OK`** → một đơn có thể đã tạo link thành công bị quy thành
`PAYMENT_GATEWAY_ERROR` và sẽ bị đóng FAILED.

**Cách sửa** — phân loại theo **status**, không theo kiểu:

| Tình huống | Kết luận? | ErrorCode | Đơn hàng |
|---|---|---|---|
| Body `code != "00"` | Có — payOS nêu lý do | `PAYMENT_GATEWAY_ERROR` | đóng được |
| HTTP **4xx** | Có — payOS đọc request rồi từ chối | `PAYMENT_GATEWAY_ERROR` | đóng được |
| HTTP **5xx** | **Không** | `PAYMENT_GATEWAY_TIMEOUT` | giữ nguyên + `reconcile_required` |
| Timeout / lỗi mạng / status 2xx mà vỡ giữa chừng | **Không** | `PAYMENT_GATEWAY_TIMEOUT` | giữ nguyên + `reconcile_required` |

5xx cũng xếp vào "không kết luận được" cho nhất quán với nguyên tắc đã ghi trên
`Payment.reconcileRequired`: *thà để admin xử lý tay còn hơn im lặng bỏ qua tiền của khách*.

### Timeout tường minh

`PayOSWebClientConfig` dựng `reactor.netty.HttpClient` với `CONNECT_TIMEOUT_MILLIS` +
`responseTimeout` (mặc định 5s / 15s, chỉnh bằng env). Đây là WebClient **đầu tiên** trong dự
án có timeout ở tầng transport — `metaWebClient`/`aiServiceWebClient` hiện không có.

### Fail-safe chẩn đoán lệch chữ ký (đã cài trong `verifyWebhook`)

Chữ ký không khớp → tính lại theo **biến thể còn lại**; nếu khớp thì log **ERROR** một dòng
`"Chữ ký khớp với biến thể format số thay thế (EXACT_SCALE) — xem docs/PAYMENT.md mục scale"`
và ném `PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH` (mã riêng để Bước 5 bật `reconcile_required`).
**Vẫn không kích hoạt gói.** Chỉ log TÊN biến thể — không log chữ ký, `checksumKey` hay payload.
Chữ ký sai thường → `log.warn` không nêu lý do (điểm F §5).

### Quyết định nhỏ đã tự chọn

- **Hai bean cùng tồn tại**, mỗi bean tự khai `gateway()`; Bước 4 inject
  `List<PaymentGatewayClient>` → `Map<PaymentGateway, …>` (đúng mẫu `PlatformPublisher`).
  Không dùng `@ConditionalOnProperty` để bean payOS luôn có mặt cho test/đối soát.
- **Thiếu credential KHÔNG fail lúc boot** (khác `AIMA_ENCRYPTION_KEY`): dev chạy
  `PAYMENT_GATEWAY=mock` không có credential vẫn phải boot được → chặn lúc GỌI bằng
  `PAYMENT_GATEWAY_NOT_CONFIGURED`.
- **`MockGatewayClientImpl.verifyWebhook` fail-closed**: đang chạy mock mà có request vào
  `/webhooks/payos` thì từ chối, không cho request không xác thực được đi vào luồng kích hoạt gói.
- **`description` cắt TRƯỚC khi ký** — cắt sau thì chữ ký không khớp chuỗi thật sự gửi đi (có test).
- **Chưa verify chữ ký trên response API** của payOS (chỉ verify webhook): quy ước ký cho response
  chưa xác minh được, đoán sai sẽ làm hỏng mọi lần tạo link. Ghi vào checklist `docs/PAYMENT.md`.

### 🟡 Vẫn CHƯA xác minh được (cần tài khoản payOS thật)

1. **Trần `orderCode`** (§3 mục 5) — *không* kiểm được ở bước này vì không có credential để gọi
   thật. Đã pin bằng test là 15 chữ số đi qua request nguyên vẹn dạng số nguyên JSON; nếu API
   thật từ chối thì hạ xuống 12 chữ số, chỉ sửa chỗ sinh orderCode ở Bước 4.
2. **Giới hạn khoảng `expiredAt`** (§3 mục 4) — tương tự, chỉ biết khi gọi thật.
3. Body response webhook payOS mong đợi, `description` max khi TK đã liên kết, `PAID` vs
   `SUCCEEDED` — giữ nguyên như §3.

---

## 10. ✅ ĐÓNG 3 LỖ + BƯỚC 4 — XONG

**Nghiệm thu:** `PaymentCheckoutTest` 15/15 · `SubscriptionLifecycleTest` 12/12 · toàn suite
**193 test, 13 fail** — vẫn đúng 13 fail có sẵn, **0 fail mới**, 1 skipped (vector dự phòng).

### File mới

```
?? backend/src/main/java/com/aima/enums/MockGatewayScenario.java
?? backend/src/main/java/com/aima/dto/request/CheckoutRequest.java
?? backend/src/main/java/com/aima/dto/response/CheckoutResponse.java
?? backend/src/main/java/com/aima/mapper/PaymentMapper.java
?? backend/src/main/java/com/aima/service/PaymentService.java
?? backend/src/main/java/com/aima/service/Impl/PaymentServiceImpl.java
?? backend/src/main/java/com/aima/scheduler/PaymentReconcileJob.java
?? backend/src/test/java/com/aima/payment/PaymentCheckoutTest.java
?? backend/src/test/java/com/aima/payment/SubscriptionLifecycleTest.java
```

### File CÓ SẴN đã sửa

| File | Thay đổi |
|---|---|
| `exception/ErrorCode.java` | +`PAYMENT_GATEWAY_LINK_NOT_FOUND` (2086) |
| `service/PaymentGatewayClient.java` | `GatewayOrder` thêm `checkoutUrl` |
| `service/Impl/PayOSGatewayClientImpl.java` | HTTP 404 → `LINK_NOT_FOUND`; thêm `observeResponseSignature` |
| `service/Impl/MockGatewayClientImpl.java` | 5 kịch bản hỏng + `useScenario` + `markPaid` |
| `repository/PaymentRepository.java` | +4 query: `findByIdForUpdate` (FOR UPDATE), `findOpenOrder`, `findStuckPendingIds`, `existsByGatewayTxnIdAndDeletedAtIsNull` |
| `service/SubscriptionService.java` (+`Impl`) | +`activatePaidPlan`, +`expireToFreePlan`, +`UserRepository`; **chặn nhánh sync theo nhãn khi `planSource != FREE`** |
| `resources/application.yml` | +`payment.mock-scenario`, +`payment.reconcile-interval-ms` |

---

### 🔓 LỖ 1 — deadlock đơn treo: ĐÃ ĐÓNG

Vòng lặp đã khép bằng **hai đường thoát cố ý làm trùng nhau**:

**a) `PaymentReconcileJob` — mỗi 1 phút** (`payment.reconcile-interval-ms`, không đợi hạn 15
phút). Quét đơn `PENDING` mà `checkout_url IS NULL` HOẶC `reconcile_required = true`:

| Cổng trả về | Hành động |
|---|---|
| **404 / không tồn tại** | Link CHƯA TỪNG tạo → đóng đơn **`CANCELLED`** + `failedReason = GATEWAY_LINK_MISSING` |
| Link sống, **có** `checkoutUrl` | Chữa tại chỗ: ghi URL, gỡ `reconcileRequired`, reset `expiryGraceCount` |
| Link sống, **không** có `checkoutUrl` | `closeLinkSafely(LINK_URL_UNRECOVERABLE)` — đằng nào cũng phải giải phóng chỗ PENDING |
| PAID/EXPIRED/CANCELLED/FAILED/UNDERPAID/UNKNOWN | `applyGatewayResult` theo bảng map §3 |
| Vẫn không hỏi được | `expiryGraceCount + 1`, giữ nguyên đơn; vượt `maxGraceRounds` → log **ERROR** gọi admin |

> **Chọn `CANCELLED` chứ không `FAILED`** khi link chưa từng tạo: cổng chưa hề hỏng giao dịch
> nào, nhét vào `FAILED` sẽ thổi phồng "tỉ lệ giao dịch thất bại" (xem javadoc `PaymentStatus`).

**b) Chốt chặn thứ hai — `checkout` tự chữa ngay trong request.** Thấy đơn PENDING không có
`checkoutUrl` thì gọi `getPaymentLink` ngay tại đó rồi mới quyết định, thay vì trả lỗi cụt.
Không đợi job thì user không phải chờ tới 1 phút.

**Ba nhánh cố ý KHÔNG tạo đơn mới** (để user khỏi trả tiền hai lần): cổng báo `PAID` →
`PAYMENT_ALREADY_PAID`; `PROCESSING`/`UNDERPAID`/`UNKNOWN` (tiền có thể đang chuyển) →
`PAYMENT_PENDING_EXISTS`; không hỏi được cổng → `PAYMENT_GATEWAY_TIMEOUT`.

**Test đúng kịch bản đã yêu cầu**: `checkout_afterCreateLinkTimeout_userIsNotDeadlocked` —
timeout khi tạo link → khẳng định đơn GIỮ `PENDING` (không FAILED) + `reconcileRequired` →
user bấm mua lại → **ra link mới**, đơn cũ thành `CANCELLED`. Thêm 3 test cho đường job.

> ⚠️ **Sự thật quan trọng**: tài liệu payOS **không nêu** `checkoutUrl` ở API tra cứu, nên nhánh
> "chữa tại chỗ" nhiều khả năng KHÔNG chạy được với payOS thật — đường thực tế sẽ là *huỷ link
> rồi tạo đơn mới*. Code đọc `checkoutUrl` best-effort nên đúng cả hai trường hợp, và mock cố ý
> trả `null` để nhánh huỷ-tạo-mới được chạy thử. Xác minh lại khi có tài khoản thật.

---

### 🔓 LỖ 2 — chữ ký response: CHỈ QUAN SÁT, không chặn

`PayOSGatewayClientImpl.observeResponseSignature` — **không bao giờ ném exception**:

- Khớp biến thể đang dùng → `log.debug`, đi tiếp.
- Khớp biến thể kia → `log.warn` kèm **tên biến thể**, vẫn dùng `checkoutUrl` bình thường.
- Không có field `signature` / không khớp biến thể nào → `log.warn`, vẫn đi tiếp.
- Bản thân việc kiểm ném lỗi → bọc `try/catch`, cũng chỉ `log.warn`.

Lý do ghi thẳng trong javadoc: đoán sai quy ước ký response làm hỏng **100% lần tạo link**, còn
rủi ro bỏ qua gần bằng 0 vì webhook mới là nguồn sự thật và ở đó đã so `amount` tuyệt đối. Nâng
lên kiểm bắt buộc **chỉ khi** xác minh được quy ước — đã vào checklist Bước 7.

---

### 🔓 LỖ 3 — Mock mô phỏng được nhánh hỏng

`payment.mock-scenario` (đổi runtime bằng `useScenario`, cho test và endpoint dev-only Bước 6):

| Kịch bản | Mô phỏng |
|---|---|
| `NORMAL` | đường thành công |
| `CREATE_TIMEOUT` | `createPaymentLink` ném `PAYMENT_GATEWAY_TIMEOUT`, **không** ghi link nội bộ — tái hiện đúng "không biết cổng đã tạo hay chưa" |
| `CREATE_SERVER_ERROR` | như trên (5xx cũng là không kết luận được) |
| `GET_LINK_NOT_FOUND` | `getPaymentLink` ném `PAYMENT_GATEWAY_LINK_NOT_FOUND` |
| `GET_UNREACHABLE` | `getPaymentLink` ném `PAYMENT_GATEWAY_TIMEOUT` (thêm ngoài 4 cái đã liệt kê — cần để test bộ đếm vòng) |
| `LINK_EXPIRED` | link tra cứu ra `EXPIRED` |

Mock ném **đúng những `ErrorCode` mà `PayOSGatewayClientImpl` ném**, nên test dùng mock THẬT
(không phải Mockito mock) và đi qua đúng đoạn code môi trường dev sẽ chạy.

---

### BƯỚC 4 — `checkout` / `applyGatewayResult` / `closeLinkSafely` / đảo nguồn sự thật

**Bố cục transaction** (rule #24/#28): mỗi lần chạm DB là một transaction ngắn qua
`TransactionTemplate`; mọi lời gọi cổng nằm GIỮA các transaction. `applyGatewayResult` là ngoại
lệ có chủ đích — không gọi mạng và cần khoá dòng nên dùng thẳng `@Transactional`.

**1. Idempotent tuyệt đối** — `findByIdForUpdate` (`@Lock(PESSIMISTIC_WRITE)`) rồi mới kiểm
trạng thái **bên trong** khoá. Test gọi `applyGatewayResult(PAID)` **3 lần** → `activatePaidPlan`
chỉ chạy **1 lần**. Đây là đường DUY NHẤT đổi trạng thái đơn — webhook, verify thủ công, job đối
soát và cổng giả lập đều đi qua đây.

**2. Q1 cộng dồn** — `activatePaidPlan`: trùng gói + còn hạn → cộng vào `planExpiresAt` hiện
tại; trùng gói + đã hết hạn → cộng từ `now`; `planExpiresAt = null` → cộng từ `now` (không NPE);
nâng gói → thay thế từ `now`. Chu kỳ lấy từ `plan.billingIntervalMonths`, không hardcode.
**Đủ 5 test.**

**3. `closeLinkSafely` (điểm C)** — huỷ lỗi → **bắt buộc** `getPaymentLink`; `PAID` thì đi
`applyGatewayResult` (kích hoạt); 404 → đóng `CANCELLED`; không xác nhận được → giữ `PENDING` +
`reconcileRequired`, thử lại vòng sau. Dùng chung cho cả 3 chỗ huỷ (job, user, Q2).

**4. Đảo chiều nguồn sự thật (Q4) + bẫy §6** — `activatePaidPlan`/`expireToFreePlan` ghi CẢ HAI
(`subscription` + nhãn `User.plan`) trong cùng transaction. Và **sửa `getOrCreate`**: nhánh đồng
bộ theo nhãn giờ **chỉ chạy khi `planSource = FREE`**.

> Chỉ ghi cả hai là CHƯA ĐỦ. Gói admin tự tạo (code ngoài `FREE/PLUS/PRO`) không có nhãn enum
> nên `User.plan` giữ nhãn cũ → hai bên lệch nhau *hợp lệ* → nhánh sync vẫn sẽ kéo gói cũ sống
> lại. Điều kiện `planSource` mới thực sự đóng bẫy. Đường admin cũ (`PATCH /users`) giữ nguyên
> hành vi vì mọi dữ liệu hiện có đều `planSource = FREE`.

Test: 4 test nhãn cache (gồm gói `ENTERPRISE` giữ nhãn cũ) + `getOrCreate` không hồi sinh gói +
kịch bản đầu-cuối `expiredProPlan_staysDowngraded_soQuotaActuallyDrops`.

**5. Q2 / H2 / điểm E** — cùng gói → trả **đúng** link cũ và **giữ nguyên `expiresAt`**; khác gói
→ huỷ rồi tạo mới; điểm E: gọi `getPaymentLink` **trước**, link đã chết thì đồng bộ rồi tạo đơn
mới. H2: bắt `DataIntegrityViolationException` → vòng 2 đọc lại đơn PENDING kia và đi luồng Q2,
**không để lỗi DB lọt ra client**.

**6. `orderCode`** — `SecureRandom` 15 chữ số `[10^14, 10^15)`, thử tối đa 5 lần
(`PAYMENT_ORDER_CODE_UNAVAILABLE`), chốt chặn cuối là partial unique.

**7. `invoiceNo`** — `INV-yyyyMM-` + **6 chữ số cuối của `orderCode`**. Không cần bảng/sequence
riêng; `invoiceNo` chỉ để hiển thị/đối chiếu, không phải khoá. *(Quyết định tự chọn — khác chút
với "######" trong giả định 2, nêu ra để duyệt.)*

### Hai lỗi do TEST bắt được (đều ở tầng test/mock, không phải service)

1. `MockGatewayScenario.LINK_EXPIRED` chỉ áp cho orderCode lạ, nên link vừa tạo trong cùng phiên
   vẫn ra `PENDING` → kịch bản "link cũ đã chết bên cổng" không bao giờ chạy. Sửa: `LINK_EXPIRED`
   áp cho **mọi** link.
2. `when(mock.save(any()))` khi RE-STUB sẽ **gọi mock với `null`** và kích hoạt answer cũ → NPE.
   Sửa: dùng `doAnswer(...).when(mock).save(any())`.

### Chưa làm trong Bước 4 (đúng phạm vi, để Bước 5)

- **Chưa có controller/endpoint nào** — `PaymentController`, webhook, `/payments/{id}/verify`.
- **Chưa ghi `activity_logs` và chưa bắn notification** khi PAID/hạ gói (§4 xếp ở Bước 5).
- `SubscriptionExpiryJob` chưa có — `expireToFreePlan` đã sẵn sàng cho nó.
- `PaymentExpiryJob` + điểm B (`PROCESSING` gia hạn) chưa có; `PaymentReconcileJob` hiện chỉ lo
  đơn treo, chưa lo đơn hết hạn.

---

## 11b. ✅ BƯỚC 5 — XONG

**Nghiệm thu:** `mvnw -o test` = **212 test, 13 fail, 1 skipped** — vẫn đúng 13 fail có sẵn
(`AccountManagementTest` 8 + `BrandProfileTest` 5, tất cả 401), **0 fail mới** ·
`npm run build` pass (tsc + vite, 8.1s).

### File mới

```
?? backend/src/main/java/com/aima/enums/MockPaymentOutcome.java
?? backend/src/main/java/com/aima/config/StringToMockPaymentOutcomeConverter.java
?? backend/src/main/java/com/aima/dto/response/PaymentResponse.java
?? backend/src/main/java/com/aima/dto/response/BillingOverviewResponse.java
?? backend/src/main/java/com/aima/controller/PaymentController.java
?? backend/src/main/java/com/aima/controller/PayOSWebhookController.java
?? backend/src/main/java/com/aima/scheduler/PaymentExpiryJob.java
?? backend/src/main/java/com/aima/scheduler/SubscriptionExpiryJob.java
?? backend/src/test/java/com/aima/payment/PaymentWebhookTest.java
?? backend/src/test/java/com/aima/payment/PaymentExpiryTest.java
```

### File CÓ SẴN đã sửa

| File | Thay đổi |
|---|---|
| `enums/NotificationType.java` | +`PAYMENT_SUCCEEDED`, `PLAN_EXPIRED` |
| `enums/ActivityAction.java` | +`PAYMENT_WEBHOOK_REJECTED` (BILLING) **và đưa vào `DEDUP_EXEMPT`** — đây CHÍNH LÀ cách điểm F tái dùng trần IP/giờ có sẵn |
| `service/PaymentService` (+`Impl`) | +`getBilling/list/get/cancel/verify/handleWebhook/applyMockOutcome/expireOverdueOrders`; `closeLinkSafely` thêm biến thể chọn trạng thái đóng; `activate()` bắn notification + activity log; `closeIfOpen()` ghi `PAYMENT_FAILED` |
| `service/SubscriptionService` (+`Impl`) | +`expireToFreePlan(UUID, now)`; **kiểm hết hạn LAZY trong `getOrCreate`**; +notification `PLAN_EXPIRED` + activity `PLAN_CHANGED` |
| `repository/PaymentRepository` | +`findExpiredPendingIds`, `searchByUser`, `findDetailById` |
| `repository/SubscriptionRepository` | +`findDetailById`, `findExpiredPlanIds` |
| `mapper/PaymentMapper` | +`toResponse`, `toResponseList`, `toBillingOverview` |
| `service/Impl/MockGatewayClientImpl` | `markPaid(orderCode)` → **`markStatus(orderCode, status)`**; link nhớ cả SỐ TIỀN |
| `security/SecurityConfig` | +`/webhooks/payos` vào `PUBLIC_ENDPOINTS` |
| `resources/application.yml`, `.env.example` | +`payment.expiry-interval-ms`, +`payment.plan-expiry-cron`; `.env.example` bổ sung luôn 2 khoá Bước 4 bị sót (`PAYMENT_MOCK_SCENARIO`, `PAYMENT_RECONCILE_INTERVAL_MS`) |
| FE `api/notifications.ts`, `components/notificationMeta.ts`, `api/admin.ts`, `components/admin/logs/activityLabels.ts` | Đồng bộ hai enum ĐÓNG. **Bắt buộc, không phải mở rộng phạm vi**: cả hai bên FE đều là `Record<Enum, …>` ĐẦY ĐỦ — thiếu một giá trị thì chuông thông báo tra ra `undefined` và vỡ lúc render |

---

### Điều kiện kích hoạt gói — ba vế, không phải một

Webhook payOS KHÔNG tự đủ để kết luận. `handleWebhook` chỉ kích hoạt khi **cả ba** đúng:

1. Chữ ký hợp lệ (`verifyWebhook`), **VÀ**
2. Cổng xác nhận link `PAID` — hỏi bằng `getPaymentLink` sau khi nhận webhook, **VÀ**
3. `data.amount` (số tiền ĐÃ KÝ trong webhook) khớp TUYỆT ĐỐI `payment.amount`.

Vế 2 là lý do webhook có một lời gọi HTTP ra cổng. Bỏ nó đi thì `code = "00"` của một lần
chuyển thiếu (`UNDERPAID`) sẽ kích hoạt gói — đúng cái bẫy §3. Lời gọi này nằm NGOÀI
transaction (rule #24).

**Số tiền so sánh lấy từ webhook, không lấy từ response tra cứu**: chỉ webhook mới là giá trị
ta xác thực được bằng chữ ký.

### Thứ tự các bước trong webhook (không đảo được)

```
1. body null/rỗng hoặc > payment.webhook-max-body-bytes  → activity log + return (chưa parse gì)
2. verifyWebhook → sai chữ ký: activity log, KHÔNG nêu lý do, return
3. tra orderCode → không có: log.info + return       ⚠️ payOS gửi giao dịch MẪU orderCode=123
                                                        lúc /confirm-webhook; lỗi ở đây = đăng ký
                                                        webhook THẤT BẠI
4. LƯU rawPayload ngay (transaction riêng)           ← trước mọi bước có thể vỡ
5. đơn đã PAID → return (idempotent, KHÔNG gọi cổng)
6. getPaymentLink → không hỏi được/404: reconcile_required + system log, return
7. applyGatewayResult(status, amountPaid từ webhook, rawBody)
```

Toàn bộ thân hàm bọc trong `try/catch(Exception)` — **payOS retry mọi response khác 200**, nên
không nhánh nào được phép ném ra ngoài.

### Điểm F — rate limit KHÔNG dựng cơ chế mới

`ActivityLogWriterImpl` đã có trần số dòng/IP/giờ, nhưng nó **chỉ áp cho nhóm
`ActivityAction.DEDUP_EXEMPT`**. Nên cách tái dùng đúng là thêm `PAYMENT_WEBHOOK_REJECTED` vào
enum **và vào `DEDUP_EXEMPT`** — cùng lý do với `LOGIN_FAILED`: với sự kiện bảo mật thì TẦN SUẤT
chính là dữ liệu, chống trùng 60 giây sẽ xoá mất giá trị điều tra. Không có dòng nào chạm Redis.

Trần body kiểm bằng **số byte UTF-8**, TRƯỚC khi parse JSON.

### Hai job, hai truy vấn nguồn KHÔNG giao nhau

| Job | Quét gì | Vì sao tách |
|---|---|---|
| `PaymentReconcileJob` (Bước 4) | `checkout_url IS NULL` **HOẶC** `reconcile_required` | đơn TREO — không có link để trả tiền |
| `PaymentExpiryJob` (Bước 5) | `expires_at <= now` **VÀ** `checkout_url IS NOT NULL` **VÀ** `reconcile_required = false` | đơn còn sống nhưng HẾT GIỜ |

Không loại trừ lẫn nhau thì một đơn bị hai job cùng nện vào cổng mỗi phút, và đơn `UNDERPAID`
(giữ PENDING + cờ đối soát, đang chờ admin) sẽ bị job hết hạn gọi cổng vô hạn.

**Điểm B đã cài đúng**: cổng báo `PROCESSING` → `expiresAt += grace-minutes`, `+1` vòng; vượt
`max-grace-rounds` → `reconcile_required` + system log gọi admin, **vẫn giữ PENDING**, và
`cancelPaymentLink` KHÔNG BAO GIỜ được gọi ở nhánh này (có test khẳng định `never()`).

Job hết hạn đóng đơn thành **`EXPIRED`**, không phải `CANCELLED` — nên `closeLinkSafely` nay có
biến thể chọn trạng thái đóng. Khách hết giờ không bấm trả tiền là chuyện khác với huỷ chủ động,
và hai thứ đó được đọc riêng trên báo cáo doanh thu.

### Hạ gói hết hạn có HAI đường, cố ý trùng nhau

- `SubscriptionExpiryJob` — cron `0 5 0 * * *` (`payment.plan-expiry-cron`).
- **Kiểm LAZY trong `SubscriptionService.getOrCreate`** — tức mọi lần `checkQuota` chạy.

Chỉ có cron thì một lần scheduler lỡ nhịp (restart/deploy) là user xài tiếp hạn mức gói đã hết
hạn tới tận hôm sau; chỉ có lazy thì user không đăng nhập sẽ không bao giờ bị hạ và báo cáo quản
trị sai số.

> ⚠️ **Thứ tự trong `getOrCreate` là bắt buộc**: hạ gói chạy TRƯỚC khi đọc nhãn `User.plan`.
> `expireToFreePlan` ghi lại cả nhãn, nên đọc trước thì `planCode` giữ giá trị cũ (PRO) và nhánh
> đồng bộ theo nhãn sẽ kéo gói vừa hạ sống lại — đúng bẫy §6 nhưng ở một chỗ mới.

### Ghi activity log & notification — đặt ở ĐÚNG MỘT chỗ

- `PAYMENT_SUCCEEDED` + notification `PAYMENT_SUCCEEDED`: trong `PaymentServiceImpl.activate()`.
  Vì `activate()` chỉ được gọi từ `applyGatewayResult`, mọi đường tới PAID (webhook, verify thủ
  công, job đối soát, job hết hạn, cổng giả lập) đều phát đúng một lần — không đường nào quên.
- `PAYMENT_FAILED`: trong `closeIfOpen()`, **chỉ khi** trạng thái đích là `FAILED`.
  `EXPIRED`/`CANCELLED` cố ý KHÔNG ghi — khách bỏ giỏ hàng không phải sự kiện nghiệp vụ, ghi vào
  chỉ làm phình bảng (xem javadoc `ActivityAction`).
- `PLAN_CHANGED` + notification `PLAN_EXPIRED`: trong `SubscriptionServiceImpl.expireToFreePlan`,
  nên cả đường cron lẫn đường lazy đều phát.

---

### 3 quyết định tự chọn trong Bước 5 — nêu ra để duyệt

**1. Body webhook: `ApiResponse` KHÔNG có field `success`** — envelope chỉ có `code`/`message`/
`result`, nên JSON thực tế là `{"code":200,"message":"Đã nhận webhook"}`. Đã đưa body ra **một
hằng số duy nhất** `PayOSWebhookController.WEBHOOK_ACK`; kiểu trả về đổi sang
`ResponseEntity<Object>` và được ghi nhận là **ngoại lệ rule #3 thứ hai** (đã cập nhật nguyên văn
rule #3 trong `backend/CLAUDE.md`). Đổi lúc go-live = sửa đúng một dòng sang
`Map.of("success", true)`. Rủi ro thật nếu đoán sai KHÔNG phải retry mà là `/confirm-webhook` từ
chối đăng ký → webhook không bao giờ được gọi → tính năng chết âm thầm; vì thế nó là một dòng
riêng trong checklist go-live (§13).

**2. Chữ ký sai không bật `reconcile_required` — nhưng KHÔNG còn là điểm mù.** Vẫn giữ quyết định
không moi `orderCode` từ payload đã bị từ chối (sẽ kéo tri thức payOS vào `PaymentServiceImpl`,
phá ranh giới adapter dựng ở Bước 3). Bù lại bằng **bộ đếm + cảnh báo admin, không cần biết
orderCode**:

| Tình huống | Hành vi |
|---|---|
| `PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH` (biến thể kia khớp) | **Báo admin NGAY từ lần đầu**, bỏ qua cả ngưỡng lẫn throttle — chữ ký khớp bằng `checksumKey` của ta nên payload là THẬT, gần như chắc chắn lỗi cấu hình của TA |
| `PAYMENT_SIGNATURE_INVALID` | Đếm trong cửa sổ `payment.webhook-alert-window-minutes` (10'); vượt `payment.webhook-alert-threshold` (5) → báo admin, sau đó throttle hết cửa sổ |
| Body quá cỡ / rỗng / JSON hỏng | **Không** báo — đó là rác/dò endpoint, không phải tín hiệu cấu hình sai. Trần IP/giờ của activity log lo phần chống phình |

Kênh báo: `NotificationService.notify(admin, PAYMENT_WEBHOOK_ALERT, …)` cho **mọi user role
ADMIN đang ACTIVE** (`UserRepository.findActiveByRoleName`) + một dòng `system_logs`. Bộ đếm đọc
từ chính bảng `activity_logs` (`countByActionSince`) nên bền qua restart và đúng cả khi chạy
nhiều instance; chỉ riêng throttle nằm trong bộ nhớ (`AtomicReference`) — mất khi restart chỉ
khiến admin nhận thừa một thông báo, an toàn hơn là bỏ sót.

> ⚠️ Activity log ghi **bất đồng bộ**, nên bộ đếm lấy số của các lần TRƯỚC rồi `+1` cho lần hiện
> tại. Sai số tối đa là vài trăm ms — không ảnh hưởng ngưỡng 5 lần/10 phút.

**Badge cho Bước 7**: trang admin đơn hàng gọi
`activityLogRepository.countByActionSince(PAYMENT_WEBHOOK_REJECTED, now.minusHours(24))`, hiện
badge cảnh báo khi `> 0`.

**Test (5 cái mới trong `PaymentWebhookTest`)**: vượt ngưỡng → báo · dưới ngưỡng → chưa báo ·
number-style mismatch → báo ngay lần đầu · body quá cỡ → không bao giờ báo · 20 webhook liên
tiếp → đúng MỘT thông báo.

**3. `MockGatewayClientImpl` nay nhớ SỐ TIỀN của link** (không chỉ trạng thái). Bắt buộc, không
phải tiện tay: mock cũ trả `amountPaid = null`, mà điều kiện kích hoạt là "khớp tiền tuyệt đối"
→ đường `verify` ở dev **không bao giờ** kích hoạt được gói, luôn rơi vào nhánh lệch tiền. Kéo
theo `markPaid(orderCode)` (Bước 4, chưa ai gọi) đổi thành `markStatus(orderCode, status)` vì
Bước 5 cần đặt cả `FAILED`/`EXPIRED` cho ba nút giả lập.

---

### Soát self-invocation TOÀN BỘ code thanh toán — bảng kết luận

`@Transactional` trên phương thức public chỉ có tác dụng khi call site nằm ở **bean KHÁC** (lời
gọi nội bộ không đi qua proxy Spring). Đã rà hết:

| Phương thức | Call site | Kết luận |
|---|---|---|
| `PaymentServiceImpl.applyGatewayResult` | **100% nội bộ** (checkout, verify, cancel, mock, 2 job) | ❌ **ĐÃ SỬA** — bỏ `@Transactional`, mở transaction tường minh bằng `TransactionTemplate` (`applyLocked`). Xem bên dưới |
| `PaymentServiceImpl` — mọi method còn lại | — | ✅ An toàn: lớp này **không còn `@Transactional` nào**, mọi lần chạm DB đi qua `inTransaction(...)` |
| `PaymentServiceImpl.closeLinkSafely` | 100% nội bộ (Q2, huỷ của user, job đối soát, job hết hạn) | ✅ An toàn — nó **cố ý KHÔNG có** `@Transactional` vì gọi cổng (rule #24); bên trong mỗi lần chạm DB tự mở transaction riêng. Self-invocation không ảnh hưởng gì |
| `SubscriptionServiceImpl.activatePaidPlan` | CHỈ từ `PaymentServiceImpl.activate()` → **bean khác** | ✅ Qua proxy. Và vì `activate()` đã nằm trong transaction của `applyLocked`, propagation REQUIRED khiến nó **join** — ghi subscription + nhãn `User.plan` + trạng thái đơn commit CÙNG một transaction, đúng yêu cầu Q4 |
| `SubscriptionServiceImpl.expireToFreePlan(UUID, …)` | CHỈ từ `SubscriptionExpiryJob` → **bean khác** | ✅ Qua proxy (đây chính là lý do tách overload theo id) |
| `SubscriptionServiceImpl.expireToFreePlan(Subscription, …)` | Nội bộ từ `getOrCreate` + từ overload theo id | ✅ An toàn — cả hai caller đều đã có transaction đang mở |
| `SubscriptionServiceImpl.getOrCreate` | Nội bộ từ `activatePaidPlan`; ngoài ra từ `TokenUsageServiceImpl`, `UsageQueryServiceImpl`, `PaymentServiceImpl.getBilling` → **bean khác** | ✅ An toàn. Đường nội bộ luôn có transaction sẵn; ba caller ngoài đều khai `@Transactional` **không readOnly** (có comment sẵn trong code) nên việc hạ gói LAZY ghi được |
| `PayOSGatewayClientImpl`, `MockGatewayClientImpl` | — | ✅ Không có `@Transactional` nào (thuần HTTP / bộ nhớ) |
| `PaymentReconcileJob`, `PaymentExpiryJob`, `SubscriptionExpiryJob` | — | ✅ Không có `@Transactional` nào; mỗi job chỉ gọi service qua proxy |

### 🐛 Lỗi THẬT bắt được khi tự soát: `@Transactional` của `applyGatewayResult` là lỗi câm

`applyGatewayResult` được khai `@Transactional` từ Bước 4, nhưng **mọi call site của nó đều nằm
trong CHÍNH bean `PaymentServiceImpl`** (checkout, verify, huỷ, cổng giả lập, job đối soát, job
hết hạn). Lời gọi nội bộ không đi qua proxy Spring → annotation **không có tác dụng nào cả**.

Hậu quả nếu để nguyên: `findByIdForUpdate` (`PESSIMISTIC_WRITE`) chạy trong transaction tự động
của Spring Data rồi **nhả khoá ngay sau câu SELECT**, còn phần ghi trạng thái rơi sang một
transaction khác. Nghĩa là toàn bộ tuyên bố "idempotent tuyệt đối" của luồng thanh toán dựa trên
một khoá không tồn tại — hai webhook song song vẫn có thể cùng đi qua bước kiểm trạng thái và
kích hoạt gói hai lần.

**Sửa**: bỏ `@Transactional`, tách thân hàm sang `applyLocked(...)` và mở transaction tường minh
bằng `transactionTemplate` — đúng idiom mà cả lớp đang dùng (`inTransaction`). Propagation
REQUIRED nên caller bên ngoài đã có transaction vẫn join bình thường.

> Bước 4 không lộ ra vì chưa có endpoint nào; Bước 5 mới có webhook + verify chạy song song thật.
> Bài học ghi lại để Bước 7 không lặp: **trong lớp này, `@Transactional` trên phương thức
> public chỉ có tác dụng nếu call site nằm ở bean KHÁC.**

### Việc Bước 5 cố ý KHÔNG làm (để đúng phạm vi)

- **FE chưa có route `billing`.** `ROUTE_BY_TYPE` trong `notificationMeta.ts` tạm trỏ hai loại
  thông báo mới về `'usage'`, kèm comment. Bước 6 tạo route `billing` thì **đổi hai dòng đó** —
  khai `'billing'` ngay bây giờ sẽ vỡ `PATH_BY_ROUTE` (`Record<Route, string>` là map ĐẦY ĐỦ).
- Endpoint admin (`/admin/payments`, `mark-paid`, `POST /admin/users/{id}/subscription`) và ba
  `ActivityAction` đi kèm (`PAYMENT_CANCELLED`, `PAYMENT_MARKED_PAID`, `SUBSCRIPTION_ADJUSTED`)
  — Bước 7.
- `docs/PAYMENT.md` — Bước 7.

### Endpoint đã chạy được sau Bước 5 (8/17)

`POST /payments/checkout` · `GET /payments/billing` · `GET /payments` · `GET /payments/{id}` ·
`POST /payments/{id}/cancel` · `POST /payments/{id}/verify` · `POST /webhooks/payos` (public) ·
`POST /payments/mock/{id}/{outcome}` (DEV-ONLY, khoá 3 lớp)

Còn lại 9 endpoint admin → Bước 7.

---

## 11d. ✅ BƯỚC 6 — XONG (FE)

**Nghiệm thu:** `npm run build` pass (tsc + vite, 4.8s) · `mvnw -o test` **217 test, 13 fail,
1 skipped** — vẫn đúng 13 fail có sẵn, **0 fail mới**.

### File mới

```
?? frontend/src/api/payments.ts
?? frontend/src/pages/app/Billing.tsx
?? frontend/src/pages/app/BillingReturn.tsx
?? frontend/src/pages/app/BillingMock.tsx
?? frontend/src/components/billing/useServerCountdown.ts
?? frontend/src/components/billing/CurrentPlanCard.tsx
?? frontend/src/components/billing/PendingOrderCard.tsx
?? frontend/src/components/billing/PlanChoiceGrid.tsx
?? frontend/src/components/billing/PaymentHistory.tsx
```

### File CÓ SẴN đã sửa

| File | Thay đổi |
|---|---|
| `src/types.ts` | `Route` += `'billing'` |
| `src/context/AppContext.tsx` | `PATH_BY_ROUTE` += `billing: '/billing'` |
| `src/App.tsx` | 3 lazy route (`/billing`, `/billing/return`, `/billing/mock/:paymentId`) + thêm Billing vào prefetch |
| `src/components/UserMenu.tsx` | mục **Gói & thanh toán** (icon `CreditCard`) giữa Hồ sơ và Cài đặt, variant `app` |
| `src/components/notificationMeta.ts` | hai loại thông báo mới trỏ đúng `'billing'` (bỏ chỗ tạm `'usage'` của Bước 5) |
| `src/components/landing/PlanCard.tsx` | CTA: chưa đăng nhập → `register` (như cũ); đã đăng nhập → `billing` (gói có giá) hoặc `dashboard` (gói Free) |
| `src/i18n.ts` | +56 key (`bl*` + `navBilling`), đã kiểm vi/en khớp nhau tuyệt đối |
| **BE** `BillingOverviewResponse` + `PaymentMapper` + `PaymentServiceImpl` | += `serverTime` — xem dưới |

---

### ⏱️ Đếm ngược theo giờ SERVER — và vì sao phải thêm field ở BACKEND

Yêu cầu là "đếm ngược theo thời gian server". Cách rẻ nhất là đọc header `Date` của response,
nhưng **`Date` KHÔNG thuộc danh sách CORS-safelisted response header**, và
`SecurityConfig.corsConfigurationSource()` mới chỉ expose `Authorization` +
`Content-Disposition` → FE ở origin khác đọc ra `undefined`. Nên `serverTime` được trả thẳng
trong `GET /payments/billing`.

Công thức trong `useServerCountdown`:

```
tổng = expiresAt − serverTime        // HAI mốc do CÙNG server sinh ra
còn lại = tổng − (performance.now() − mốc neo lúc nhận response)
```

Hai tính chất quan trọng:

1. **Miễn nhiễm với múi giờ.** Backend trả `LocalDateTime` KHÔNG kèm offset, JS hiểu nó là giờ
   local của máy. Nhưng vì lấy HIỆU của hai mốc cùng nguồn, phần diễn giải múi giờ triệt tiêu —
   kết quả là một KHOẢNG thời gian thuần tuý. Không chỗ nào so với `Date.now()`.
2. **Miễn nhiễm với đồng hồ nhảy.** Trừ dần bằng `performance.now()` (đồng hồ đơn điệu) nên hệ
   điều hành chỉnh giờ giữa chừng không làm đếm ngược giật.

Thêm một chi tiết nhỏ nhưng hay vỡ: Jackson có thể trả 6–9 chữ số phần giây
(`...T20:15:30.123456`) trong khi ISO của JS chỉ định nghĩa 3 → `parseServerDateTime` cắt bớt
thay vì trông chờ vào sự dễ tính của từng engine.

### Bốn cái bẫy phía giao diện — đã xử lý

| Bẫy | Cách xử lý |
|---|---|
| **Đếm ngược về 0 ≠ đơn đã huỷ** | `onExpire` chỉ gọi lại `GET /payments/billing` + lịch sử. Job đóng đơn chạy mỗi phút nên luôn có độ trễ, và nếu cổng báo đã trả tiền thì đơn được **kích hoạt** chứ không đóng — chỉ backend mới biết. FE không tự kết luận gì |
| **`checkoutUrl = null`** (lần tạo link không kết luận được) | Nút "Tiếp tục thanh toán" **khoá** (`pointer-events: none`, `aria-disabled`) + khối giải thích: đơn đang được đối soát, hệ thống tự xử lý trong khoảng một phút, hoặc huỷ để mua lại ngay |
| **Query string ở `/billing/return` không có chữ ký** | Trang **không đọc** `code`/`status`/`cancel`. Nó lấy `paymentId` đã nhớ ở `sessionStorage` (lùi về đơn PENDING trong `/payments/billing` nếu mất) rồi gọi `POST /payments/{id}/verify` để backend tự hỏi cổng. Sửa URL trên thanh địa chỉ không đổi được kết quả |
| **Race huỷ đơn / tiền về** | Sau `cancel`, FE đọc trạng thái trả về: backend kích hoạt gói thay vì huỷ nếu tiền đã ghi nhận → hiện "Thanh toán thành công" + `refreshUser()`, không nói dối là đã huỷ |

### Về "exhaustive check cho thông báo" — sự thật là nó ĐÃ có sẵn

`ROUTE_BY_TYPE` và `TYPE_META` đều khai `Record<NotificationType, …>`, nên **thiếu một loại là
`tsc` fail build ngay** — không cần thêm cơ chế mới. Chỗ TypeScript *không* kiểm được là union
`NotificationType` ở FE có khớp enum backend hay không (hai file, hai ngôn ngữ). Lớp bảo vệ cho
việc đó là runtime fallback đã có sẵn ở cả hai nơi dùng (`TYPE_META[x] ?? …`,
`ROUTE_BY_TYPE[x] ?? 'dashboard'`): backend gửi loại lạ thì chuông hiện icon mặc định chứ không
vỡ. Đã ghi chú "enum ĐÓNG, sửa phải đồng bộ hai đầu" ngay trên cả hai union.

### Quy tắc phía user đã phản ánh đúng backend

- Lưới gói chỉ hiện gói `isActive && price > 0` (Q4: bán **mọi** gói, kể cả gói admin tự tạo).
- Nút gói thấp hơn bị **khoá sẵn** khi gói hiện tại còn hạn, dùng **đúng tiêu chí của backend**
  (so `tokenQuota`, `null` = không giới hạn = cao nhất) — thay vì để user bấm rồi ăn lỗi 2072.
- Nhãn nút nói đúng việc sẽ xảy ra: trùng gói → **"Gia hạn thêm"** (cộng dồn chu kỳ), gói cao
  hơn → **"Nâng cấp"** (thay thế từ bây giờ).
- Gói hiển thị đọc từ `GET /payments/billing` (bảng `subscriptions`), **không** từ `user.plan`
  trong AuthContext — nhãn đó là cache một chiều và có thể lệch hợp lệ với gói admin tự tạo.
- `planExpiresAt = null` hiện **"Không giới hạn thời gian"**, không phải "đã hết hạn".

### Tái dùng, không nhân bản

- `PaymentStatus`/`PaymentGateway`: `api/payments.ts` **re-export** từ `api/revenue.ts` thay vì
  khai lại — hai module cùng ánh xạ một enum backend.
- Badge trạng thái: dùng lại `paymentStatusMeta()` + `StatusBadge` của trang doanh thu.
- Tiền tệ: `formatVND`; ngày giờ: `formatDateVN`/`formatDateTimeVN`; card/loader: `Card`/`Loader`;
  xác nhận huỷ: `ConfirmModal`; thông báo thao tác: `useToast` — không dựng lại cái nào.

### Còn lại cho Bước 7

- `AdminPaymentController` + trang `pages/admin/Payments.tsx` + `config/adminNav.ts` +
  `components/admin/PaymentDetailModal.tsx`.
- Badge cảnh báo webhook bị từ chối trong 24h (§11b đã nêu đúng câu query cần gọi).
- `docs/PAYMENT.md` + chép checklist go-live ở §11c + tick `ROADMAP_FUTURE.md` §2/§2b +
  `PLAN.md` + cập nhật `backend/CLAUDE.md` §2/§4 và `frontend/CLAUDE.md`.

---

## 11. Bước 7 còn lại

| # | Nội dung | Nghiệm thu |
|---|---|---|
| ✅ **3** | XONG — xem §9. `PaymentGatewayClient` + 2 impl + `PayOSProperties` + `PaymentProperties` + `PayOSWebClientConfig` + `dto/payos/*` + `PayOSMapper` + `GatewayLinkStatus` | 16/16 pass (mockwebserver). **Trần `orderCode` vẫn CHƯA xác minh** — cần credential thật |
| ✅ **4** | XONG — xem §10. Kèm 3 lỗ đã đóng: deadlock đơn treo, chữ ký response không chặn, mock mô phỏng nhánh hỏng | `PaymentCheckoutTest` 15/15 · `SubscriptionLifecycleTest` 12/12 |
| ✅ **5** | XONG — xem §11b. Webhook + 6 endpoint user + 2 job + điểm F + activity log/notification | `PaymentWebhookTest` 9/9 · `PaymentExpiryTest` 6/6 · `SubscriptionLifecycleTest` 16/16 · toàn suite **212 test, 13 fail** (đúng 13 fail có sẵn, **0 fail mới**) |
| ✅ **6** | XONG — xem §11d. Đủ 3 trang + 4 component + nối route/menu/i18n | `npm run build` pass (tsc + vite) · backend **217 test, 13 fail** (đúng 13 fail có sẵn) |
| **7** | Admin: `AdminPaymentController` `/admin/payments` (list/detail có **rawPayload**/cancel/mark-paid/gia hạn gói, **mọi thao tác bắt buộc `reason` + ghi `activity_logs`**), `pages/admin/Payments.tsx`, `config/adminNav.ts`, `components/admin/PaymentDetailModal.tsx` + **DOCS** | Thao tác admin có vết `activity_logs`; `docs/PAYMENT.md` + tick `ROADMAP_FUTURE.md` §2/§2b + `PLAN.md` + `backend/CLAUDE.md` §2/§4 |

### Endpoint đầy đủ (17)

**User** (`PaymentController`, auth, scope theo user đăng nhập):
`POST /payments/checkout` · `GET /payments/billing` · `GET /payments` (phân trang + lọc status/from/to) ·
`GET /payments/{id}` (chỉ đơn của mình → 403) · `POST /payments/{id}/cancel` · `POST /payments/{id}/verify`

**Public**: `POST /webhooks/payos` (thêm vào `SecurityConfig.PUBLIC_ENDPOINTS`) ·
`POST /payments/mock/{id}/{outcome}` (DEV-ONLY)

**Admin** (`AdminPaymentController`, `@PreAuthorize("hasRole('ADMIN')")` cấp class):
`GET /admin/payments` · `GET /admin/payments/{id}` · `POST /admin/payments/{id}/cancel` ·
`POST /admin/payments/{id}/mark-paid` · `POST /admin/users/{userId}/subscription`

**KHÔNG tạo mới**: trang Gói dịch vụ (`/admin/plans` đã có) và trang thống kê doanh thu
(`/admin/revenue` đã có) — chỉ nối thêm.

`ActivityAction` cần thêm: `PAYMENT_CANCELLED`, `PAYMENT_MARKED_PAID`, `SUBSCRIPTION_ADJUSTED`.

---

## 11c. Checklist GO-LIVE — chép NGUYÊN VĂN vào `docs/PAYMENT.md` ở Bước 7

Mỗi dòng là một việc độc lập, không gộp vào đoạn văn.

- [ ] **Body ack của webhook.** Đăng ký webhook thật bằng `POST /confirm-webhook`. Nếu payOS TỪ
      CHỐI đăng ký, sửa **đúng một dòng** `PayOSWebhookController.WEBHOOK_ACK` thành
      `Map.of("success", true)` rồi đăng ký lại. Chưa xác minh được quy ước này; đoán sai = webhook
      không bao giờ được gọi, tính năng chết âm thầm.
- [ ] **Trần `orderCode`.** Gọi tạo link thật với orderCode 15 chữ số. API từ chối → hạ xuống 12
      chữ số, chỉ sửa `ORDER_CODE_MIN`/`ORDER_CODE_BOUND` trong `PaymentServiceImpl`.
- [ ] **Giới hạn khoảng `expiredAt`.** Xác nhận TTL 15 phút được payOS chấp nhận.
- [ ] **`description` tối đa bao nhiêu ký tự** khi tài khoản ngân hàng ĐÃ liên kết payOS. Đang để
      mặc định an toàn 9 (`PAYOS_DESCRIPTION_MAX_LENGTH`).
- [ ] **`PAID` hay `SUCCEEDED`.** SDK Go và trang tổng quan API mâu thuẫn. Code fail-safe với giá
      trị lạ (→ `UNKNOWN` + `reconcile_required`), nhưng phải xác nhận bằng giao dịch thật.
- [ ] **Quy ước ký response API.** Hiện chỉ QUAN SÁT (`observeResponseSignature` không bao giờ
      ném). Xác minh được thì mới nâng thành kiểm bắt buộc.
- [ ] **Biến thể định dạng số của chữ ký.** Theo dõi thông báo `PAYMENT_WEBHOOK_ALERT` trong
      tuần đầu. Nếu nổ vì `PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH` → đổi
      `PayOSSignature.ACTIVE_STYLE` sang `EXACT_SCALE` và đảo hai `@Disabled` trong
      `PayOSSignatureTest`.
- [ ] **Xác minh index nghiệp vụ đã tồn tại thật** — đọc log `verifyCriticalIndexes()` lúc khởi
      động, không được có dòng ERROR nào kèm tên index.
- [ ] **GỠ dev seeder doanh thu**: đặt `AIMA_DEV_PAYMENT_SEED=false`, xoá dữ liệu mẫu bằng
      `DELETE /admin/revenue/dev-seed`, và cân nhắc gỡ hẳn endpoint.
- [ ] **TẮT cổng giả lập**: `PAYMENT_GATEWAY=payos` + `AIMA_PRODUCTION_MODE=true` (khoá luôn
      `POST /payments/mock/**`).
- [ ] **Điền credential thật**: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`,
      `PAYOS_RETURN_URL`, `PAYOS_CANCEL_URL` (trỏ domain production, không phải localhost).

---

## 12. Quy trình làm việc user yêu cầu

- **Tuần tự 7 bước, DỪNG LẠI sau mỗi bước** để user xem. Không chạy một mạch.
- Bước nào chạm code đang có (`SubscriptionServiceImpl`, `PaymentDataInitializer`…) thì **nêu rõ
  đã đổi gì TRƯỚC khi đổi**.
- Chỗ nào không xác minh được thì **nói rõ là chưa chắc**, không bịa rồi code luôn.
- Tuân thủ tuyệt đối `backend/CLAUDE.md` §7 (28 rule) và `frontend/rule.md`.

## 13. Lệnh build / test

```bash
# Backend — JAVA_HOME PHẢI trỏ Temurin 21, không thì "release version 21 not supported"
cd backend
JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot" ./mvnw.cmd -o test
JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot" ./mvnw.cmd -o compile

# Frontend
cd frontend && npm run build      # tsc + vite, lỗi type sẽ fail build

# Baseline test: 193 test / 13 fail (AccountManagementTest 8 + BrandProfileTest 5, đều 401,
# có sẵn từ trước task này). Fail thứ 14 trở lên = do mình gây ra.
```

> ⚠️ **ĐỪNG boot app chỉ để test**: `.env` trỏ Postgres Supabase từ xa và scheduler đăng bài
> thật chạy mỗi 60s. Validate query bằng JDBC read-only.
