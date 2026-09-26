# PAYMENT.md — Thanh toán gói dịch vụ qua payOS

> Tài liệu vận hành + tham chiếu kỹ thuật của luồng mua gói. Viết xong 2026-09-23.
>
> - Cổng thanh toán: **payOS** (chốt 2026-07-20). **Không có VNPay** ở bất kỳ đâu trong dự án.
> - **Chưa từng chạy với tài khoản payOS thật.** Toàn bộ nghiệm thu hiện tại chạy trên cổng
>   giả lập — xem §8 để biết chính xác cái gì đã được chứng minh và cái gì thì chưa.
> - Sổ cái `payments` và trang thống kê doanh thu có từ trước (2026-07-20), xem
>   [`ROADMAP_FUTURE.md`](ROADMAP_FUTURE.md) §2b.

---

## 1. Luồng tổng thể

```
  User chọn gói ──▶ /billing/checkout?plan=<MÃ>  (trang "Xem lại đơn hàng")
                    GET /payments/quote — CHỈ ĐỌC, bỏ ngang không đổi gì (§4a)
                                   │ bấm "Thanh toán ngay"
                    ┌──────────────▼──────────────────────────────┐
                    │ POST /payments/checkout                     │
                    │   {planId, paymentMethod, expectedAmount}   │
                    │  tx1: tính lại báo giá (Q1) · Q2 đơn pending│
                    │       sinh orderCode 15 chữ số              │
                    │       INSERT payments PENDING               │
                    │       expiresAt = now + 15'  ◀── MỘT mốc duy│
                    │  ── NGOÀI transaction ──                    │
                    │       POST /v2/payment-requests → payOS     │
                    │  tx2: lưu checkoutUrl + gatewayLinkId       │
                    └──────────────┬──────────────────────────────┘
                                   │ 302 sang trang payOS
                                   ▼
                        khách trả tiền trên payOS
                    ┌──────────────┴───────────────┐
                    ▼                              ▼
   ┌────────────────────────────┐   ┌──────────────────────────────────┐
   │ WEBHOOK (nguồn sự thật)    │   │ returnUrl → FE /billing/return   │
   │ POST /webhooks/payos       │   │ query string KHÔNG có chữ ký     │
   │ public, không JWT          │   │ → FE KHÔNG đọc, chỉ gọi:         │
   │ xác thực bằng HMAC-SHA256  │   │   POST /payments/{id}/verify     │
   └─────────────┬──────────────┘   └───────────────┬──────────────────┘
                 │                                  │
                 └────────────┬─────────────────────┘
                              ▼
            ┌──────────────────────────────────────────┐
            │ PaymentServiceImpl.applyGatewayResult()  │
            │  ĐƯỜNG DUY NHẤT đổi trạng thái đơn.      │
            │  SELECT … FOR UPDATE → kiểm TRONG khoá   │
            │  → PAID + khớp tiền ⇒ activatePaidPlan   │
            └──────────────────────────────────────────┘
                              ▲
        ┌─────────────────────┼─────────────────────┬──────────────────┐
        │                     │                     │                  │
  PaymentExpiryJob     PaymentReconcileJob    Admin mark-paid    Cổng giả lập
  (mỗi phút)           (mỗi phút)             (/admin/payments)  (DEV-ONLY)
```

**Nguyên tắc số 1 của cả luồng:** mọi đường đều đổ về `applyGatewayResult`. Không có nhánh nào
"nhẹ tay" hơn nhánh nào, nên tính idempotent và quy tắc kích hoạt gói chỉ cần đúng ở một chỗ.

### Điều kiện kích hoạt gói — BA vế, không phải một

1. Chữ ký webhook hợp lệ, **VÀ**
2. Cổng xác nhận link ở trạng thái `PAID` (hỏi bằng `GET /v2/payment-requests/{orderCode}`), **VÀ**
3. `data.amount` (số tiền ĐÃ KÝ trong webhook) khớp **tuyệt đối** `payment.amount`.

> ⚠️ **Cái bẫy lớn nhất của payOS**: webhook trả `code = "00"` nghĩa là *một lệnh chuyển tiền
> thành công*, **không** phải *đơn đã đủ tiền*. Khách chuyển thiếu → link thành `UNDERPAID`
> nhưng webhook **vẫn** `code = "00"`. Vì vậy vế 2 bắt buộc phải có, và đó là lý do webhook có
> một lời gọi HTTP ngược lại cổng.

---

## 2. Bảng map trạng thái

| payOS (`PaymentLinkStatus`) | `PaymentStatus` nội bộ | Kích hoạt gói? | Ghi chú |
|---|---|---|---|
| `PENDING` | `PENDING` | ✗ | đang chờ khách trả |
| `PROCESSING` | `PENDING` | ✗ | **TUYỆT ĐỐI không huỷ** — xem §4 điểm B |
| `PAID` + tiền khớp | `PAID` | **✓** | đường thành công DUY NHẤT |
| `PAID` + tiền lệch | `PAID` | ✗ | ghi nhận tiền + `reconcile_required`, báo admin |
| `UNDERPAID` | `PENDING` | ✗ | `reconcile_required`, báo admin |
| `CANCELLED` | `CANCELLED` | ✗ | |
| `EXPIRED` | `EXPIRED` | ✗ | |
| `FAILED` | `FAILED` | ✗ | vế duy nhất vào "tỉ lệ giao dịch thất bại" |
| *giá trị lạ* | giữ nguyên | ✗ | `reconcile_required` + log ERROR |

**`EXPIRED` và `CANCELLED` tách khỏi `FAILED` có chủ đích**: khách bỏ giỏ hàng không phải cổng
thanh toán hỏng. Gộp ba trạng thái này lại sẽ thổi phồng chỉ số sức khoẻ cổng.

### Vòng đời đơn

```
PENDING ─┬─▶ PAID        (tiền về, khớp số → kích hoạt gói)
         ├─▶ EXPIRED     (hết 15' — PaymentExpiryJob đóng, sau khi HỎI cổng)
         ├─▶ CANCELLED   (user/admin huỷ, hoặc bị thay bằng đơn mới, hoặc link chưa từng tạo)
         └─▶ FAILED      (cổng báo giao dịch hỏng)
```

---

## 3. Danh sách endpoint (15)

### User — `PaymentController`, yêu cầu đăng nhập, scope theo token

| Method | Path | Việc |
|---|---|---|
| GET | `/payments/quote?planId=` | Báo giá cho trang "Xem lại đơn hàng" — **chỉ đọc**. Đơn bị chặn vẫn trả 200 với `purchasable=false` + lý do (§4a) |
| POST | `/payments/checkout` | Tạo đơn + link. Body `{planId, paymentMethod, expectedAmount}`; tính lại báo giá, lệch `expectedAmount` → 2122 (Q1); tối đa 1 đơn PENDING (Q2) |
| GET | `/payments/billing` | Gói hiện hành + đơn đang chờ + **`serverTime`** cho đếm ngược |
| GET | `/payments` | Lịch sử đơn, phân trang, lọc `status`/`from`/`to` |
| GET | `/payments/{id}` | Chi tiết một đơn. Đơn người khác → **403** |
| POST | `/payments/{id}/cancel` | User tự huỷ đơn đang chờ |
| POST | `/payments/{id}/verify` | Đối soát thủ công với cổng — đường mà `/billing/return` gọi |

### Public

| Method | Path | Việc |
|---|---|---|
| POST | `/webhooks/payos` | Webhook payOS. **Luôn trả HTTP 200** |

### DEV-ONLY

| Method | Path | Việc |
|---|---|---|
| POST | `/payments/mock/{id}/{outcome}` | Ba nút của cổng giả lập (`success`/`failed`/`timeout`) |

### Admin — `AdminPaymentController`, `@PreAuthorize("hasRole('ADMIN')")` cấp lớp

| Method | Path | Việc |
|---|---|---|
| GET | `/admin/payments/summary` | 3 con số hàng đợi công việc |
| GET | `/admin/payments` | Danh sách + lọc (`status`, `gateway`, `reconcileRequired`, `q`, `from`, `to`) |
| GET | `/admin/payments/{id}` | Chi tiết **kèm `rawPayload`** |
| POST | `/admin/payments/{id}/cancel` | Huỷ đơn — **bắt buộc `reason`** |
| POST | `/admin/payments/{id}/mark-paid` | Ghi nhận tiền về ngoài luồng — **bắt buộc `reason`** |
| ~~POST~~ | ~~`/admin/users/{userId}/subscription`~~ | **Đã gỡ 2026-09-25** — thay bằng `/users/{userId}/subscription/{extend,change,revoke}` (+ `GET` gói hiện tại và `GET .../history`) trong `AccountController`, xem `backend/CLAUDE.md` §4 |

> **Đối chiếu với kế hoạch (17 endpoint)**: con số thực tế là **14** (6 user + 1 webhook +
> 1 dev-only + 6 admin). Chênh lệch vì bản kế hoạch đếm cả `/admin/plans` và `/admin/revenue`
> — hai trang đã tồn tại từ 2026-07, task này chỉ *nối vào* chứ không tạo mới. Ngược lại có
> **một endpoint phát sinh ngoài kế hoạch**: `/admin/payments/summary`, thêm để hiện hai badge
> cảnh báo ở §5.

---

## 4. Quy tắc nghiệp vụ đã chốt

| # | Quy tắc |
|---|---|
| **Q1** | Mua **trùng gói** → **cộng dồn** hạn (hạn cũ + 1 chu kỳ, không khấu trừ). **Nâng gói** (chỉ lên gói **GIÁ cao hơn**) → **thay thế**: hạn = lúc trả tiền + 1 chu kỳ đầy đủ, **khấu trừ** giá trị còn lại của gói tự mua (§4a). **Gói không đắt hơn khi còn hạn** → CHẶN (`PLAN_DOWNGRADE_NOT_ALLOWED` 2072) |
| **Q2** | **Tối đa 1 đơn PENDING/user** (partial unique `uk_payments_one_pending_per_user`). Cùng gói **+ cùng số tiền + cùng phương thức** → trả lại link cũ, **giữ nguyên `expiresAt`**. Khác (vd số ngày còn lại đổi làm đổi số tiền nâng cấp) → huỷ đơn cũ rồi tạo đơn mới |
| **Q3** | `EXPIRED` + `CANCELLED` là trạng thái riêng, **không** gộp vào `FAILED` |
| **Q4** | Bán **mọi gói** `isActive && price > 0` (kể cả gói admin tự tạo). `subscriptions` là nguồn sự thật; `User.plan` chỉ còn là **nhãn cache một chiều** |

**Tiêu chí "được đổi gói khi còn hạn"** (đổi 26/9, trước đây so `monthlyTokenLimit`): giá gói mới
phải **cao hơn hẳn** giá gói đang dùng — gói tự mua so với `list_price` lúc mua, gói admin cấp so
với giá hiện tại của gói. FE khoá sẵn nút theo giá hiện tại (gợi ý sớm); quyết định cuối cùng là
báo giá của backend. `SubscriptionServiceImpl.isDowngrade` (đồng bộ nhãn `User.plan` khi sang kỳ)
vẫn so hạn mức token — đó là chuyện khác, không phải quy tắc mua.

### 4a. Trang "Xem lại đơn hàng" & khấu trừ khi nâng cấp (2026-09-26)

**Không còn đường nào nhảy thẳng sang payOS.** Nút chọn gói ở Billing, bảng giá `/pricing` và
landing đều mở `/billing/checkout?plan=<MÃ GÓI>` — trang riêng ngoài AppShell (không sidebar/topbar,
vẫn cần đăng nhập). Trang gọi `GET /payments/quote` (chỉ đọc) và
hiển thị 3 khối: gói đã chọn · tóm tắt đơn hàng · phương thức thanh toán. Đơn chỉ được tạo khi bấm
"Thanh toán ngay"; gói hiện tại chỉ đổi khi tiền về (webhook/verify → `activatePaidPlan`).

**Một công thức cho cả hai endpoint** — `util/CheckoutPricing` (hàm thuần, test đủ nhánh):

```
số ngày còn lại  = số ngày TRÒN từ bây giờ tới hạn cũ (làm tròn xuống)
số ngày chu kỳ   = số ngày thật của chu kỳ kết thúc ở hạn cũ = days(hạn − N tháng, hạn)
                   (tháng lịch, khớp plusMonths của activatePaidPlan — KHÔNG cố định 30)
khấu trừ         = list_price gói cũ × còn lại / chu kỳ              (làm tròn xuống tới đồng)
tổng             = (giá gói mới − khấu trừ) làm tròn xuống hàng nghìn
làm tròn         = (giá gói mới − khấu trừ) − tổng                    (dòng riêng trên trang)
hạn mới          = lúc trả tiền + 1 chu kỳ đầy đủ của gói mới (không cộng dồn phần còn lại)
```

| Tình huống | Loại đơn | Thu |
|---|---|---|
| Đang Free / gói cũ đã hết hạn | `NEW` | giá niêm yết (không làm tròn) |
| Trùng gói đang còn hạn | `RENEW` | giá niêm yết, cộng dồn hạn |
| Gói TỰ MUA còn hạn → gói giá cao hơn | `UPGRADE` | theo công thức trên |
| Gói ADMIN cấp còn hạn → gói giá cao hơn | `NEW` | giá niêm yết, **không khấu trừ** (khách không trả tiền) |

**"Giá gói cũ"** = `payments.list_price` của lần mua `PAID` gần nhất gói đó (giá niêm yết lúc mua,
KHÔNG phải `amount` — đơn nâng cấp trả ít hơn giá niêm yết; KHÔNG phải giá hiện tại — admin có thể
đổi giá sau). Đơn tạo trước 26/9 chưa có cột này → lùi về giá hiện tại của gói.

**Hai lớp chặn — không bao giờ phát sinh đơn cần hoàn tiền** (hệ thống chưa có hoàn tiền):

| Lớp | Điều kiện | Mã |
|---|---|---|
| 1 | Đổi sang gói khác khi còn hạn mà giá **không cao hơn** | 2072 `PLAN_DOWNGRADE_NOT_ALLOWED` |
| 2 | Đơn nâng cấp có tổng ≤ 0 hoặc < `payment.min-amount` | 2120 `UPGRADE_CREDIT_EXCEEDS_PRICE` |
| 2 | Đơn mua mới/gia hạn có giá < `payment.min-amount` | 2121 `PAYMENT_AMOUNT_BELOW_MINIMUM` |
| — | Gia hạn một gói **không hết hạn** (sẽ biến nó thành có hạn) | 2124 `PLAN_ALREADY_PERMANENT` |

Nâng từ gói chu kỳ dài (năm) sang gói tháng gần như luôn bị chặn — chấp nhận, không có logic riêng.
`payment.min-amount` mặc định **2.000đ**: payOS không công bố mức tối thiểu (tài liệu chỉ ghi
"số nguyên"), 2.000đ theo ví dụ SDK chính thức — **cần xác nhận với payOS lúc go-live** (§9).

**Báo giá đổi giữa lúc xem và lúc bấm** (vd qua nửa đêm làm số ngày còn lại giảm 1): FE gửi
`expectedAmount` = tổng vừa hiển thị; backend tính lại, lệch → 2122 `PAYMENT_QUOTE_CHANGED`, FE nạp
lại báo giá. Không bao giờ thu một số tiền user chưa nhìn thấy.

**Snapshot trên `payments`** (đều nullable): `order_type`, `payment_method`, `list_price`,
`proration_credit`, `proration_remaining_days`, `proration_cycle_days`, `proration_rounding`,
`from_plan_code`, `from_expires_at`. `order_type` + `payment_method` là cột enum → đã đăng ký
`PaymentDataInitializer.ENUM_COLUMNS` (§11).

**Phương thức thanh toán mở rộng được**: enum `PaymentMethod` (hiện chỉ `PAYOS_VIETQR`, chạy trên
cổng `PAYOS` hoặc `MOCK`) — phương thức BẬT khi cổng đang cấu hình thuộc nhóm của nó; quote trả danh
sách đang bật. FE: registry `config/paymentMethods.ts` (icon, nhãn, `proceed(order)` = bước tiếp
theo). Thêm phương thức = thêm giá trị enum (+ bean `PaymentGatewayClient` nếu là cổng mới) + một mục
registry; trang checkout không phải sửa.

**Lưu ý hệ quả của "làm tròn ngày xuống"**: vừa mua Plus xong nâng lên Pro ngay thì còn 29/30 ngày
(29 ngày 23 giờ làm tròn xuống) — khách mất giá trị ~1 ngày. Đúng quy tắc đã chốt.

### Điểm B — đơn `PROCESSING` không bao giờ bị huỷ

Cổng báo `PROCESSING` nghĩa là tiền đang chuyển dở. `PaymentExpiryJob` gặp trạng thái này thì
**gia hạn** `expiresAt += payment.grace-minutes` và tăng `expiry_grace_count`. Vượt
`payment.max-grace-rounds` → bật `reconcile_required` + ghi `system_logs` gọi admin, nhưng đơn
**vẫn giữ `PENDING`**. Đóng một đơn đang chuyển tiền là cách chắc chắn nhất để tiền về sau khi
đơn đã đóng.

### Điểm C — race huỷ/PAID

Mọi chỗ huỷ link đều đi qua `closeLinkSafely`: huỷ trên cổng lỗi → **bắt buộc** `getPaymentLink`
xác nhận lại; nếu cổng báo `PAID` thì đơn được **kích hoạt** chứ không bị huỷ. Chỉ đóng đơn khi
*xác nhận được* link không PAID; không xác nhận được thì giữ `PENDING` + `reconcile_required`.

### Đơn treo — rủi ro nghiêm trọng nhất

Đơn `PENDING` không có `checkout_url` (lần tạo link timeout, không kết luận được) vừa chiếm chỗ
PENDING duy nhất của user, vừa không có link để trả tiền → **user bị khoá cứng khỏi việc mua
hàng**. Có **hai** đường thoát cố ý làm trùng nhau:

- `PaymentReconcileJob` quét mỗi phút;
- `checkout` **tự chữa ngay trong request** của user (không phải chờ tới một phút).

---

## 5. Hai job nền + hàng đợi công việc của admin

| Job | Chu kỳ | Quét gì | Vì sao tách riêng |
|---|---|---|---|
| `PaymentReconcileJob` | 1 phút | `checkout_url IS NULL` **HOẶC** `reconcile_required` | đơn **treo** |
| `PaymentExpiryJob` | 1 phút | `expires_at <= now` **VÀ** có `checkout_url` **VÀ** `reconcile_required = false` | đơn còn sống nhưng **hết giờ** |
| `SubscriptionExpiryJob` | cron `0 5 0 * * *` | `plan_expires_at <= now` | hạ gói hết hạn về Free |

Hai truy vấn nguồn đầu **không giao nhau** — nếu không, một đơn sẽ bị hai job cùng nện vào cổng
mỗi phút, và đơn `UNDERPAID` (đang chờ admin) bị gọi cổng vô hạn.

**Hạ gói hết hạn có hai đường, cũng cố ý trùng nhau**: cron ở trên, **và** kiểm lười ngay trong
`SubscriptionService.getOrCreate` (tức mọi lần `checkQuota`). Chỉ có cron thì một lần scheduler
lỡ nhịp (restart/deploy) là user xài tiếp hạn mức gói đã hết hạn tới tận hôm sau; chỉ có lười
thì user không đăng nhập sẽ không bao giờ bị hạ và báo cáo quản trị sai số.

### Ba con số ở đầu trang `/admin/payments`

| Badge | Nguồn | Vì sao nó phải hiện mặc định |
|---|---|---|
| **Cần đối soát** | `count(reconcile_required = true)` | Hàng đợi việc cần làm tay: lệch tiền, tiền về sau khi đơn đóng, cổng trả trạng thái lạ |
| **Đang chờ thanh toán** | `count(status = PENDING)` | Cho biết luồng mua hàng có đang chạy không |
| **Webhook bị từ chối 24h** | `activity_logs` action `PAYMENT_WEBHOOK_REJECTED` | **Khác 0 là dấu hiệu sớm của sự cố chữ ký** — xem §6 |

Bắt admin tự nhớ đi lọc mỗi ngày thì sớm muộn cũng có ngày không ai lọc, nên cả ba nằm ngay đầu
trang và bấm được để lọc.

---

## 6. Bảo mật

| Mục | Trạng thái |
|---|---|
| Endpoint user chỉ chạm được đơn của mình | ✅ `PaymentSecurityTest` — `get`/`verify`/`cancel` của user khác đều `PAYMENT_ACCESS_DENIED` (403); id không tồn tại → 404 (phân biệt rõ 403 với 404); `list` scope theo token |
| Endpoint admin | ✅ `@PreAuthorize("hasRole('ADMIN')")` cấp lớp; test: user thường → 403, ẩn danh → 401 |
| Lý do bắt buộc cho thao tác admin | ✅ `@NotBlank` + test: `reason` rỗng/thiếu → 400, chặn TRƯỚC khi chạm đơn |
| Cổng giả lập | ✅ Khoá **3 lớp**: `payment.gateway` phải là `MOCK` + `AIMA_PRODUCTION_MODE=false` + không chạy profile prod. Test chạy với `PAYMENT_GATEWAY=payos` và **`AIMA_PRODUCTION_MODE=false`** để chứng minh nó chết ngay cả khi ai đó quên cờ production |
| `/admin/revenue/dev-seed` | ✅ Vẫn còn, vẫn khoá 3 lớp (`AIMA_DEV_PAYMENT_SEED` mặc định false). **Nằm trong checklist go-live §9 để gỡ** |
| `rawPayload` không rò ra user | ✅ `PaymentResponse` (DTO của user) **không có trường nào** như vậy → bất khả thi về mặt cấu trúc. Test quét reflection trên DTO để chặn việc ai đó thêm vào sau này. Danh sách admin cũng bỏ trường này (`AdminPaymentMapper.toRow` ignore) — chỉ endpoint chi tiết mới trả |
| Không log bí mật | ✅ Đã rà: không chỗ nào log `checksumKey`, chữ ký, hay body webhook. Chỗ duy nhất chạm tới lỗi parse dùng `JsonParseException.getOriginalMessage()` (đã loại phần trích nội dung) |
| Webhook public | ✅ Kiểm kích thước body (mặc định 16 KB) **trước khi parse**; sai chữ ký → log WARN **không nêu lý do** (đừng biến endpoint public thành công cụ dò chữ ký) |

### Rate-limit webhook — tái dùng, không dựng mới

`ActivityLogWriterImpl` đã có trần số dòng/IP/giờ, nhưng nó **chỉ áp cho nhóm
`ActivityAction.DEDUP_EXEMPT`**. Vì vậy `PAYMENT_WEBHOOK_REJECTED` được thêm vào **cả enum lẫn
`DEDUP_EXEMPT`** — cùng lý do với `LOGIN_FAILED`: với sự kiện bảo mật thì *tần suất chính là dữ
liệu*, chống trùng 60 giây sẽ xoá mất giá trị điều tra. Không dòng nào chạm Redis.

### Cảnh báo admin khi webhook bị từ chối

| Tình huống | Hành vi |
|---|---|
| `PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH` (chữ ký khớp **biến thể định dạng số kia**) | **Báo ngay lần đầu**, bỏ qua ngưỡng lẫn throttle — chữ ký khớp bằng `checksumKey` của ta nên payload là THẬT, gần như chắc chắn lỗi cấu hình của TA |
| `PAYMENT_SIGNATURE_INVALID` | Đếm trong `payment.webhook-alert-window-minutes` (10'); vượt `payment.webhook-alert-threshold` (5) → báo admin, sau đó throttle hết cửa sổ |
| Body quá cỡ / rỗng / JSON hỏng | **Không** báo — rác/dò endpoint, không phải tín hiệu cấu hình sai |

Kênh: notification `PAYMENT_WEBHOOK_ALERT` cho mọi user ADMIN đang ACTIVE + một dòng
`system_logs`. **Vì sao cần**: nếu quy ước chữ ký của ta lệch thì **100% webhook fail**, khách
trả tiền xong không được kích hoạt gói, mà **không đơn nào mang `reconcile_required`** để ai đó
nhìn ra — bộ đếm này là tín hiệu duy nhất.

---

## 7. Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PAYMENT_GATEWAY` | `mock` | `mock` (dev) \| `payos` (thật) |
| `PAYMENT_PENDING_TTL_MINUTES` | `15` | Hạn chờ thanh toán. **MỘT mốc duy nhất** cho cả đếm ngược phía user lẫn `expiredAt` gửi payOS |
| `PAYMENT_MIN_AMOUNT` | `2000` | Số tiền nhỏ nhất (VND) được tạo đơn — dưới mức này bị chặn trước khi chạm cổng (§4a). Xác nhận với payOS lúc go-live |
| `PAYMENT_GRACE_MINUTES` | `10` | Mỗi lần gặp link `PROCESSING` thì gia hạn thêm bấy nhiêu |
| `PAYMENT_MAX_GRACE_ROUNDS` | `3` | Trần số vòng ân hạn; vượt → báo admin, đơn vẫn `PENDING` |
| `PAYMENT_WEBHOOK_MAX_BODY_BYTES` | `16384` | Trần body webhook, kiểm trước khi parse |
| `PAYMENT_WEBHOOK_ALERT_THRESHOLD` | `5` | Số webhook sai chữ ký trong cửa sổ đủ để báo admin |
| `PAYMENT_WEBHOOK_ALERT_WINDOW_MINUTES` | `10` | Cửa sổ đếm; cũng là khoảng chờ tối thiểu giữa hai lần báo |
| `PAYMENT_MOCK_SCENARIO` | `NORMAL` | DEV-ONLY: `CREATE_TIMEOUT` \| `CREATE_SERVER_ERROR` \| `GET_LINK_NOT_FOUND` \| `GET_UNREACHABLE` \| `LINK_EXPIRED` |
| `PAYMENT_RECONCILE_INTERVAL_MS` | `60000` | Chu kỳ quét đơn treo |
| `PAYMENT_EXPIRY_INTERVAL_MS` | `60000` | Chu kỳ quét đơn quá hạn |
| `PAYMENT_PLAN_EXPIRY_CRON` | `0 5 0 * * *` | Cron hạ gói hết hạn |
| `PAYOS_BASE_URL` | `https://api-merchant.payos.vn` | |
| `PAYOS_CLIENT_ID` / `PAYOS_API_KEY` / `PAYOS_CHECKSUM_KEY` | *(rỗng)* | Lấy ở my.payos.vn. **Thiếu KHÔNG làm app chết lúc boot** — chặn lúc GỌI bằng `PAYMENT_GATEWAY_NOT_CONFIGURED`, để dev chạy mock không cần credential |
| `PAYOS_RETURN_URL` / `PAYOS_CANCEL_URL` | `http://localhost:3000/billing/return…` | Nơi payOS đưa **trình duyệt** về. Chỉ để hiển thị — query string không có chữ ký |
| `PAYOS_DESCRIPTION_MAX_LENGTH` | `9` | Tài liệu payOS ghi tối đa 9 ký tự với TK ngân hàng **chưa** liên kết payOS |
| `PAYOS_CONNECT_TIMEOUT_SECONDS` / `PAYOS_READ_TIMEOUT_SECONDS` | `5` / `15` | Timeout **tường minh**. Thiếu nó thì một lần cổng treo sẽ giữ thread MVC vô hạn |

---

## 8. Test bằng cổng giả lập (MockGateway)

### Chạy tay ở máy dev

```bash
# backend/.env
PAYMENT_GATEWAY=mock
AIMA_PRODUCTION_MODE=false
```

1. Đăng nhập, vào **Gói & thanh toán** (menu người dùng, giữa Hồ sơ và Cài đặt).
2. Bấm mua một gói → FE chuyển sang `/billing/mock/{paymentId}` (trang giả lập thay cho payOS).
3. Chọn một trong ba nút:
   - **Thanh toán thành công** → link `PAID` → đơn PAID + gói được kích hoạt;
   - **Cổng báo lỗi** → link `FAILED` → đơn FAILED;
   - **Bỏ ngang tới hết hạn** → link `EXPIRED` → đơn EXPIRED.
4. FE điều hướng sang `/billing/return` y như payOS thật, nên **đường đối soát cũng được chạy
   thử** chứ không bị bỏ qua.

Muốn thử các nhánh hỏng thì đặt `PAYMENT_MOCK_SCENARIO` (xem §7) rồi tạo đơn mới.

> Cổng giả lập chạy qua **đúng** `applyGatewayResult(...)` mà webhook thật dùng — không có
> nhánh xử lý riêng cho mock. Nếu có, thứ được test ở dev sẽ khác thứ chạy thật.

### Chạy tự động

`PaymentEndToEndTest` (`@SpringBootTest`, H2 thật, service/repository/transaction thật) chạy
trọn 9 luồng đã nghiệm thu:

| # | Luồng | Kết quả |
|---|---|---|
| 1 | Free → mua PRO → thành công | ✅ gói đổi, hạn = now + 1 chu kỳ, `invoice_no` có, nhãn `User.plan` khớp |
| 2 | Mua trùng gói | ✅ **cộng dồn** đúng 1 chu kỳ lên hạn cũ (Q1) |
| 3 | Nâng gói PLUS → PRO | ✅ **thay thế**, hạn tính từ now; thu `giá Pro − khấu trừ − làm tròn` (`order_type = UPGRADE`) |
| 4 | Mua gói thấp hơn khi còn hạn | ✅ chặn đúng `PLAN_DOWNGRADE_NOT_ALLOWED` |
| 5 | Tạo đơn rồi bỏ dở → hết TTL | ✅ đóng `EXPIRED` (không phải FAILED), user mua lại được ngay |
| 6 | Timeout khi tạo link | ✅ đơn giữ `PENDING` + `reconcile_required`, job đối soát đóng đơn, **user không bị khoá khỏi việc mua** |
| 7 | Áp kết quả cổng 3 lần | ✅ kích hoạt đúng **một** lần, hạn không cộng thêm, không đẻ dòng doanh thu thứ hai |
| 8 | Gói hết hạn **giữa tháng** | ✅ hạn mức tụt từ 1.000.000 → 1.000 **ngay lần đọc kế tiếp**, không đợi cron (điểm G) |
| 9 | Admin `mark-paid` | ✅ gói được kích hoạt thật + có vết `activity_logs`; bấm lần hai bị chặn `PAYMENT_NOT_MARKABLE_PAID` |
| 9b | Admin cấp gói không qua thanh toán | ✅ `planSource = ADMIN` (doanh thu không đếm nhầm gói tặng), có vết audit, **không** sinh đơn hàng nào |

Bộ test thanh toán hiện có **110 test, 0 fail, 1 skipped** (skipped = bộ vector chữ ký dự
phòng, bật lên khi đổi `ACTIVE_STYLE`): `PayOSSignatureTest` 19 · `SubscriptionLifecycleTest` 17 ·
`PayOSGatewayClientImplTest` 16 · `PaymentCheckoutTest` 15 · `PaymentWebhookTest` 14 ·
`PaymentSecurityTest` 12 · `PaymentEndToEndTest` 11 · `PaymentExpiryTest` 6.

### ⚠️ Cái mà MockGateway KHÔNG chứng minh được

Cổng giả lập không nói chuyện với payOS. Những thứ sau **chưa từng được kiểm với hệ thống
thật** và phải làm theo §9 trước khi mở bán:

- Chữ ký HMAC có khớp với backend payOS hay không (chỉ mới khớp với oracle mô phỏng SDK);
- payOS chấp nhận `orderCode` 15 chữ số và `expiredAt` TTL 15 phút hay không;
- Body mà `/confirm-webhook` mong nhận lại;
- Tên trạng thái thật (`PAID` hay `SUCCEEDED`);
- Quy ước ký trên response của API (hiện chỉ **quan sát**, không chặn).

---

## 9. Checklist GO-LIVE

Mỗi dòng là một việc độc lập. Làm theo thứ tự.

- [ ] **Body ack của webhook.** Đăng ký webhook bằng `POST /confirm-webhook`. Nếu payOS **TỪ
      CHỐI** đăng ký, sửa **đúng một dòng** `PayOSWebhookController.WEBHOOK_ACK` thành
      `Map.of("success", true)` rồi đăng ký lại. Quy ước này chưa xác minh được; đoán sai
      nghĩa là webhook không bao giờ được gọi và **tính năng chết âm thầm**.
- [ ] **Điền credential thật**: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.
- [ ] **`PAYOS_RETURN_URL` / `PAYOS_CANCEL_URL` trỏ domain THẬT**, không phải `localhost:3000`.
- [ ] **Đổi `PAYMENT_GATEWAY=payos`** và **`AIMA_PRODUCTION_MODE=true`** (khoá luôn
      `POST /payments/mock/**`).
- [ ] **Verify index `uk_payments_one_pending_per_user` TỒN TẠI THẬT trên DB production.**
      `PaymentDataInitializer.verifyCriticalIndexes()` đọc `pg_indexes` lúc khởi động — kiểm
      log, **không được có dòng ERROR nào kèm tên index**. Index này là thứ chặn một user tạo
      hai đơn PENDING song song; thiếu nó thì Q2 chỉ còn được bảo vệ ở tầng ứng dụng.
- [ ] **GỠ dev seeder doanh thu**: `AIMA_DEV_PAYMENT_SEED=false`, chạy
      `DELETE /admin/revenue/dev-seed` để xoá ~350 bản ghi mẫu, rồi cân nhắc xoá hẳn
      endpoint + service method + cờ cấu hình. Dữ liệu doanh thu giả không được tồn tại song
      song với doanh thu thật.
- [ ] **Trần `orderCode`.** Tạo một link thật với orderCode 15 chữ số. API từ chối → hạ xuống
      12 chữ số (chỉ sửa `ORDER_CODE_MIN`/`ORDER_CODE_BOUND` trong `PaymentServiceImpl`).
- [ ] **Giới hạn khoảng `expiredAt`.** Xác nhận TTL 15 phút được chấp nhận.
- [ ] **Số tiền tối thiểu payOS chấp nhận.** Tài liệu không công bố; `PAYMENT_MIN_AMOUNT` đang để
      2.000đ (lớp chặn 2 của đơn nâng cấp — §4a). Tạo thử một link số tiền nhỏ; payOS từ chối thì
      nâng biến này lên đúng mức của cổng.
- [ ] **`description` tối đa bao nhiêu ký tự** khi TK ngân hàng **đã** liên kết payOS. Đang để
      mặc định an toàn 9 (`PAYOS_DESCRIPTION_MAX_LENGTH`).
- [ ] **`PAID` hay `SUCCEEDED`.** SDK Go và trang tổng quan API của payOS mâu thuẫn nhau. Code
      đã fail-safe với giá trị lạ (→ `UNKNOWN` + `reconcile_required`) nhưng phải xác nhận bằng
      một giao dịch thật.
- [ ] **Quy ước ký response API.** Hiện chỉ QUAN SÁT (`observeResponseSignature` không bao giờ
      ném). Xác minh được rồi mới nâng thành kiểm bắt buộc.
- [ ] **Theo dõi badge "Webhook bị từ chối 24h"** ở `/admin/payments` trong tuần đầu. Nếu nổ vì
      `PAYMENT_SIGNATURE_NUMBER_STYLE_MISMATCH` → đổi `PayOSSignature.ACTIVE_STYLE` sang
      `EXACT_SCALE` và đảo hai `@Disabled` trong `PayOSSignatureTest`.
- [ ] **Chạy một giao dịch thật số tiền nhỏ** đầu-cuối: mua → trả tiền → webhook → gói kích
      hoạt → kiểm `activity_logs` có `PAYMENT_SUCCEEDED`.

---

## 10. Những chỗ cố ý chưa làm

| Việc | Vì sao |
|---|---|
| **Hoàn tiền qua API payOS** | Ngoài phạm vi task. Cột `refunded_amount`/`refunded_at` đã có, admin ghi tay được; luồng revoke `token_credits` xem `ROADMAP_FUTURE.md` §2.3 |
| **Tách VAT / thuế** | Chưa có quyết định của product owner. Thêm `tax_amount` + `amount_before_tax` là migration dữ liệu kế toán — phải quyết **trước** khi mở bán |
| **Bán token lẻ** (`token_credits`) | Luồng mua gói không tạo dòng `token_credits`. Đó là workstream riêng, xem `ROADMAP_FUTURE.md` §2 |
| **Đa tiền tệ** | `currency` đã có cột, MVP chỉ `VND`. Bán nhiều tiền tệ cần thêm `fx_rate` tại thời điểm giao dịch |
| **Bật `reconcile_required` khi chữ ký lệch biến thể số** | `verifyWebhook` ném exception nên tầng service không có `orderCode` để bật cờ; moi orderCode ra bằng cách tự parse lại payload sẽ kéo tri thức payOS vào `PaymentServiceImpl`. Bù bằng bộ đếm + cảnh báo admin ở §6 — không cần biết orderCode |

---

## 11. Những cái bẫy kỹ thuật đã sập và đã sửa (đọc trước khi refactor)

### `@Transactional` trên phương thức bị gọi nội bộ = annotation chết

`applyGatewayResult` từng khai `@Transactional`, nhưng **mọi call site đều nằm trong chính
`PaymentServiceImpl`**. Lời gọi nội bộ không đi qua proxy Spring → annotation vô tác dụng →
`SELECT … FOR UPDATE` nhả khoá ngay sau câu SELECT và phần ghi trạng thái rơi sang transaction
khác. Toàn bộ tuyên bố "idempotent tuyệt đối" khi đó dựa trên một khoá không tồn tại.

**Đã sửa**: bỏ annotation, mở transaction tường minh bằng `TransactionTemplate` (`applyLocked`).
Trong lớp này, `@Transactional` trên phương thức public **chỉ có tác dụng nếu call site nằm ở
bean KHÁC**.

### Gói vừa hạ bị "hồi sinh" trong cùng một lời gọi

`getOrCreate` hạ gói hết hạn rồi mới đọc nhãn `User.plan` để đồng bộ. Nhưng `expireToFreePlan`
vừa đặt `planSource = FREE` → **mở lại** nhánh đồng bộ theo nhãn; mà nhãn lúc đó theo định nghĩa
là cũ (PRO); FREE → PRO không phải "hạ gói" nên nó khôi phục PRO. Việc hạ gói không bao giờ có
tác dụng.

Trong cùng một transaction thì `syncPlanLabel` kịp sửa nhãn nên lỗi hiếm khi lộ — nhưng chỉ cần
caller truyền vào một `User` entity đã detach (session khác) là vỡ. **`PaymentEndToEndTest` bắt
được đúng ca đó.**

**Đã sửa**: nhánh đồng bộ theo nhãn bị chặn bằng `!justExpired`. Có unit test riêng
(`getOrCreate_staleUserLabel_stillDoesNotResurrectTheExpiredPlan`) neo lại.

### ⚠️ Thêm giá trị enum mới = PHẢI sửa CHECK constraint — `ddl-auto: update` KHÔNG làm

Hibernate sinh CHECK constraint liệt kê cứng giá trị enum (`@Enumerated(STRING)`) **lúc tạo
bảng**. `ddl-auto: update` không bao giờ sửa lại constraint đã có → thêm giá trị enum mới thì
Java dùng được còn DB từ chối (SQLState `23514`). Đây là lần thứ hai `ddl-auto: update` làm hỏng
schema âm thầm (lần trước là cột NOT NULL mới bị tạo thành nullable/không tạo được).

Dính 2026-09-25 (đọc từ catalog Supabase): `payments.gateway` thiếu `MOCK` → checkout bằng Mock
chết ngay lúc INSERT; `payments.status` thiếu `EXPIRED`/`CANCELLED` → `PaymentExpiryJob` và nút huỷ
đơn chết khi có đơn đầu tiên cần đóng; `activity_logs.action` thiếu 4 action audit
(`PAYMENT_WEBHOOK_REJECTED`, `PAYMENT_CANCELLED`, `PAYMENT_MARKED_PAID`, `SUBSCRIPTION_ADJUSTED`);
`notifications.type` thiếu `PAYMENT_SUCCEEDED`, `PLAN_EXPIRED`, `PAYMENT_WEBHOOK_ALERT`.

**Đã sửa** — `PaymentDataInitializer`:
- `ENUM_COLUMNS` liệt kê mọi cột enum luồng thanh toán ghi vào. Mỗi lần khởi động, với từng cột:
  tra catalog (`pg_constraint`) tìm CHECK một-cột đang gắn vào cột **theo cột, không theo tên**;
  lệch enum Java thì `DROP` (theo tên thật tìm được) + `ADD` lại đủ giá trị trong **một** câu
  `ALTER TABLE` (nguyên tử — ADD hỏng thì constraint cũ vẫn nguyên). Khớp rồi thì không chạy DDL.
- Sau đó đọc lại catalog và **log ERROR nêu đích danh cột + giá trị thiếu** nếu còn lệch.
- `PaymentEnumConstraintTest` fail nếu `Payment`/`Subscription` có cột enum chưa đăng ký.

**Quy tắc**: thêm giá trị vào một enum lưu DB → cột đó phải nằm trong một cơ chế đồng bộ như
`ENUM_COLUMNS` (hoặc tự viết `ALTER TABLE` sửa constraint). Không có thì **đừng tin** là DB nhận.

### Mọi `DataIntegrityViolationException` từng bị coi là "đơn PENDING trùng"

`checkout` bắt `DataIntegrityViolationException` và mặc định đó là partial unique
`uk_payments_one_pending_per_user` (hai request song song) → đi luồng Q2, thử lại. Khi lỗi thật
là CHECK constraint ở trên, nó thử lại, hỏng tiếp và báo user "đang có đơn chờ" — sai hoàn toàn.

**Đã sửa**: đọc tên constraint (`ConstraintViolationException.getConstraintName()`, fallback
`constraint "..."` trong message). Chỉ đúng `uk_payments_one_pending_per_user` mới vào Q2; mọi
constraint khác (kể cả không xác định được) → log ERROR + `system_logs` kèm tên constraint, ném
`PAYMENT_ORDER_SAVE_FAILED` (2089), **không thử lại**.

### Bộ lọc `(:q is null or lower(...) like ...)` nổ trên PostgreSQL, H2 thì không

`GET /admin/payments` không có từ khoá → 500 `function lower(bytea) does not exist` (42883):
JDBC gửi null không kèm kiểu, PostgreSQL suy ra `bytea` cho biểu thức nối chuỗi. H2 khoan dung
kiểu hơn nên cả bộ test xanh mà tính năng vỡ ngay lần bấm đầu.

**Đã sửa**: bỏ `@Query` `adminSearch`, dựng bằng **JPA Specification**
(`repository/PaymentSpecifications`, `PaymentRepository` extends `JpaSpecificationExecutor`,
`findAll(spec, pageable)` có `@EntityGraph` user + plan). Tham số null/rỗng → mệnh đề **không được
sinh ra** — áp cho cả 6 bộ lọc. `q` được trim, rỗng = không tìm, escape `\ % _` với
`ESCAPE '\'` tường minh (query cũ không có ESCAPE nên `%`/`_` là ký tự đại diện).
`AdminPaymentSearchTest` chạy đủ 64 tổ hợp null/không-null + kiểm không sinh mệnh đề.

**Quy tắc cho query lọc mới**: tham số lọc tuỳ chọn → Specification, đừng viết `:x is null or`.

---

## 12. Bản đồ file

```
backend/src/main/java/com/aima/
├── controller/
│   ├── PaymentController.java            — 7 endpoint user (gồm /quote) + 1 endpoint mock (DEV-ONLY)
│   ├── PayOSWebhookController.java        — public; hằng số WEBHOOK_ACK (§9 dòng đầu)
│   └── AdminPaymentController.java        — 6 endpoint admin, @PreAuthorize cấp lớp
├── service/
│   ├── PaymentService(.Impl)              — checkout · applyGatewayResult · closeLinkSafely
│   │                                        · webhook · verify · 2 job entry point
│   ├── AdminPaymentService(.Impl)         — thao tác tay, mọi thao tác bắt buộc reason + audit
│   ├── PaymentGatewayClient               — adapter cổng (gateway() là khoá chọn bean)
│   └── Impl/{PayOSGatewayClientImpl, MockGatewayClientImpl}
├── scheduler/{PaymentReconcileJob, PaymentExpiryJob, SubscriptionExpiryJob}
├── util/PayOSSignature.java               — HMAC-SHA256 + mô phỏng Number.toString() của JS
├── util/CheckoutPricing.java              — báo giá + khấu trừ nâng cấp + 2 lớp chặn (hàm thuần, §4a)
├── enums/{PaymentOrderType, PaymentMethod}
├── config/{PaymentProperties, PayOSProperties, PayOSWebClientConfig, PaymentDataInitializer}
└── mapper/{PaymentMapper, AdminPaymentMapper, PayOSMapper}

frontend/src/
├── api/{payments.ts, adminPayments.ts}
├── pages/app/{Billing.tsx, BillingCheckout.tsx, BillingReturn.tsx, BillingMock.tsx}
├── config/paymentMethods.ts               — registry phương thức thanh toán (§4a)
├── components/billing/checkout/{SelectedPlanCard, OrderSummaryCard, PaymentMethodList}
├── pages/admin/Payments.tsx
├── components/billing/{useServerCountdown.ts, CurrentPlanCard, PendingOrderCard,
│                       PlanChoiceGrid, PaymentHistory}
└── components/admin/PaymentDetailModal.tsx
```

**Đếm ngược ở FE tính theo `serverTime` trong response**, không theo đồng hồ máy: lấy hiệu
`expiresAt − serverTime` (hai mốc cùng nguồn nên phần diễn giải múi giờ triệt tiêu) rồi trừ dần
bằng `performance.now()`. Về 0 thì **gọi lại API** lấy trạng thái thật — job đóng đơn chạy mỗi
phút nên luôn có độ trễ, và nếu cổng báo đã trả tiền thì đơn được *kích hoạt* chứ không đóng.
