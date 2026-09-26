import client, { type ApiResponse, type PageResponse } from './apiClient';
import type { PaymentGateway, PaymentStatus } from './revenue';

// Mua gói & lịch sử thanh toán của CHÍNH người đang đăng nhập.
// Backend: PaymentController (/payments) — mọi endpoint scope theo token, không nhận userId.

// PaymentStatus/PaymentGateway đã khai ở api/revenue.ts (trang doanh thu của admin) và cùng
// ánh xạ một enum backend — re-export thay vì khai lại, để hai chỗ không bao giờ lệch nhau.
// `paymentStatusMeta` ở đó cũng dùng được luôn cho badge phía user.
export type { PaymentStatus, PaymentGateway } from './revenue';

/** Vì sao user đang ở gói này — khác nhau ở chỗ có hạn hay không. */
export type PlanSource = 'FREE' | 'PAYMENT' | 'ADMIN';

/**
 * Phương thức thanh toán — khớp enum `PaymentMethod` backend. Cách hiển thị + bước tiếp theo của
 * từng phương thức nằm ở registry `config/paymentMethods.ts`.
 */
export type PaymentMethodCode = 'PAYOS_VIETQR';

/** Mua mới / gia hạn (cộng dồn) / nâng cấp (khấu trừ giá trị còn lại). */
export type OrderType = 'NEW' | 'RENEW' | 'UPGRADE';

/** Ba nút của trang giả lập cổng (DEV-ONLY). */
export type MockOutcome = 'success' | 'failed' | 'timeout';

export interface Payment {
  id: string;
  invoiceNo: string | null;
  planCode: string;
  planNameVi: string;
  planNameEn: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gateway: PaymentGateway;
  /** orderCode phía cổng — user cần khi khiếu nại với ngân hàng/payOS. */
  gatewayTxnId: string | null;
  orderedAt: string;
  paidAt: string | null;
  /** Chỉ có nghĩa khi đơn PENDING. */
  expiresAt: string | null;
  /**
   * null khi đơn PENDING đang chờ đối soát (lần tạo link không kết luận được) — lúc đó
   * KHÔNG có gì để user bấm vào trả tiền, nút "Tiếp tục thanh toán" phải bị khoá.
   */
  checkoutUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  failedReason: string | null;
}

export interface BillingOverview {
  planId: string;
  planCode: string;
  planNameVi: string;
  planNameEn: string;
  price: number;
  billingIntervalMonths: number | null;
  /** null = không giới hạn token. */
  monthlyTokenLimit: number | null;
  planSource: PlanSource;
  planStartedAt: string | null;
  /** null = gói KHÔNG hết hạn (Free hoặc admin cấp), không phải "hết hạn ngay". */
  planExpiresAt: string | null;
  /** Mốc reset hạn mức token (tháng lịch) — khác vòng đời gói. */
  currentPeriodEnd: string | null;
  pendingPayment: Payment | null;
  /**
   * Giờ SERVER lúc dựng response. Đếm ngược phải tính theo mốc này, KHÔNG theo đồng hồ máy
   * client — lệch múi giờ hoặc đồng hồ sai là chuyện thường.
   */
  serverTime: string;
}

export interface Checkout {
  paymentId: string;
  checkoutUrl: string;
  expiresAt: string;
  amount: number;
  planCode: string;
  /** true = đơn PENDING CŨ được dùng lại; expiresAt giữ nguyên mốc cũ, đừng cộng lại TTL. */
  reused: boolean;
  paymentMethod: PaymentMethodCode | null;
}

/**
 * Báo giá của trang "Xem lại đơn hàng" (`GET /payments/quote`) — backend tính, FE chỉ hiển thị.
 * Luôn có `subtotal − prorationCredit − roundingAmount = total` (trường proration* chỉ có khi
 * nâng cấp). Đơn bị chặn vẫn trả về, kèm `purchasable = false` + lý do.
 */
export interface CheckoutQuote {
  planId: string;
  planCode: string;
  planNameVi: string;
  planNameEn: string;
  billingIntervalMonths: number;
  orderType: OrderType;
  subtotal: number;
  /** Gói đang dùng — null khi đang Free / gói cũ đã hết hạn. */
  currentPlanCode: string | null;
  currentPlanNameVi: string | null;
  currentPlanNameEn: string | null;
  currentPlanExpiresAt: string | null;
  oldListPrice: number | null;
  prorationRemainingDays: number | null;
  prorationCycleDays: number | null;
  prorationCredit: number | null;
  roundingAmount: number;
  total: number;
  /** Hạn dùng dự kiến nếu thanh toán ngay; mốc thật tính lại lúc tiền về. */
  newExpiresAt: string | null;
  purchasable: boolean;
  blockedCode: number | null;
  blockedMessage: string | null;
  paymentMethods: PaymentMethodCode[];
  serverTime: string;
}

export async function getBilling(): Promise<BillingOverview> {
  const { data } = await client.get<ApiResponse<BillingOverview>>('/payments/billing');
  return data.result;
}

export interface PaymentListParams {
  status?: PaymentStatus;
  /** YYYY-MM-DD; `to` bao gồm cả ngày đó. */
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export async function listPayments(params: PaymentListParams = {}): Promise<PageResponse<Payment>> {
  const { data } = await client.get<ApiResponse<PageResponse<Payment>>>('/payments', { params });
  return data.result;
}

export async function getPayment(paymentId: string): Promise<Payment> {
  const { data } = await client.get<ApiResponse<Payment>>(`/payments/${paymentId}`);
  return data.result;
}

export async function getQuote(planId: string): Promise<CheckoutQuote> {
  const { data } = await client.get<ApiResponse<CheckoutQuote>>('/payments/quote', { params: { planId } });
  return data.result;
}

/**
 * Tạo đơn — CHỈ gọi từ nút "Thanh toán ngay" của trang xem lại. `expectedAmount` là tổng user
 * vừa thấy: backend tính lại, lệch thì trả lỗi PAYMENT_QUOTE_CHANGED (2122) thay vì thu số khác.
 */
export async function checkout(
  planId: string,
  paymentMethod: PaymentMethodCode,
  expectedAmount: number,
): Promise<Checkout> {
  const { data } = await client.post<ApiResponse<Checkout>>('/payments/checkout', {
    planId,
    paymentMethod,
    expectedAmount,
  });
  return data.result;
}

export async function cancelPayment(paymentId: string): Promise<Payment> {
  const { data } = await client.post<ApiResponse<Payment>>(`/payments/${paymentId}/cancel`);
  return data.result;
}

/**
 * Đối soát một đơn với cổng. Trang /billing/return gọi hàm này thay vì tin query string —
 * payOS gắn `code`/`status` vào return URL mà KHÔNG ký, nên FE tuyệt đối không được tin.
 */
export async function verifyPayment(paymentId: string): Promise<Payment> {
  const { data } = await client.post<ApiResponse<Payment>>(`/payments/${paymentId}/verify`);
  return data.result;
}

/** DEV-ONLY: ba nút của trang giả lập. Backend khoá 3 lớp, production luôn trả 403. */
export async function applyMockOutcome(paymentId: string, outcome: MockOutcome): Promise<Payment> {
  const { data } = await client.post<ApiResponse<Payment>>(`/payments/mock/${paymentId}/${outcome}`);
  return data.result;
}

/**
 * Nhớ đơn vừa tạo để trang /billing/return biết phải đối soát đơn nào.
 *
 * <p>payOS có gắn `orderCode` vào return URL, nhưng endpoint verify định danh theo `paymentId`
 * (UUID) và query string đó không có chữ ký. Lưu ở sessionStorage: sống qua lần rời trang sang
 * cổng rồi quay lại, tự mất khi đóng tab. Mất key không phải lỗi chí mạng — trang return sẽ lùi
 * về đọc đơn PENDING trong /payments/billing.</p>
 */
const RETURN_KEY = 'aima_billing_payment_id';

export function rememberPendingPayment(paymentId: string) {
  try {
    sessionStorage.setItem(RETURN_KEY, paymentId);
  } catch {
    // Trình duyệt chặn storage (chế độ riêng tư) — không sao, có đường lùi ở trang return.
  }
}

export function readPendingPayment(): string | null {
  try {
    return sessionStorage.getItem(RETURN_KEY);
  } catch {
    return null;
  }
}

export function forgetPendingPayment() {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // bỏ qua
  }
}
