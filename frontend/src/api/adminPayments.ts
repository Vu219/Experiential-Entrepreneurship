import client, { type ApiResponse, type PageResponse } from './apiClient';
import type { PaymentGateway, PaymentStatus } from './revenue';

// Quản trị ĐƠN HÀNG (backend AdminPaymentController /admin/payments).
// Khác api/revenue.ts (trang Thống kê doanh thu — chỉ đọc, gộp số): đây là nơi có THAO TÁC
// trên tiền thật, nên mọi hàm ghi đều bắt buộc `reason`.

export interface AdminPayment {
  id: string;
  invoiceNo: string | null;
  userId: string;
  userEmail: string;
  userFullName: string | null;
  planId: string;
  planCode: string;
  planNameVi: string;
  planNameEn: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gateway: PaymentGateway;
  gatewayTxnId: string | null;
  gatewayLinkId: string | null;
  checkoutUrl: string | null;
  orderedAt: string;
  paidAt: string | null;
  expiresAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  refundedAmount: number | null;
  refundedAt: string | null;
  /** Cần xử lý tay — cột lọc chính của hàng đợi công việc. */
  reconcileRequired: boolean;
  expiryGraceCount: number | null;
  failedReason: string | null;
  note: string | null;
  /**
   * Payload thô của cổng. CHỈ có ở endpoint chi tiết — danh sách luôn trả null vì backend
   * map bằng một phương thức khác (xem AdminPaymentMapper). Không có ở API của user thường.
   */
  rawPayload: string | null;
}

/** Ba con số hàng đợi công việc đặt đầu trang. */
export interface AdminPaymentSummary {
  reconcileRequired: number;
  pending: number;
  /** Webhook payOS bị từ chối trong 24h. > 0 là dấu hiệu sớm của sự cố chữ ký. */
  webhookRejected24h: number;
}

export interface AdminPaymentFilter {
  status?: PaymentStatus;
  gateway?: PaymentGateway;
  reconcileRequired?: boolean;
  /** YYYY-MM-DD; `to` bao gồm cả ngày đó. */
  from?: string;
  to?: string;
  /** Tìm theo số hoá đơn, orderCode hoặc email người mua. */
  q?: string;
}

export async function getPaymentSummary(): Promise<AdminPaymentSummary> {
  const { data } = await client.get<ApiResponse<AdminPaymentSummary>>('/admin/payments/summary');
  return data.result;
}

export async function listAdminPayments(
  filter: AdminPaymentFilter,
  page: number,
  size: number
): Promise<PageResponse<AdminPayment>> {
  const { data } = await client.get<ApiResponse<PageResponse<AdminPayment>>>('/admin/payments', {
    params: { ...filter, page, size },
  });
  return data.result;
}

export async function getAdminPayment(paymentId: string): Promise<AdminPayment> {
  const { data } = await client.get<ApiResponse<AdminPayment>>(`/admin/payments/${paymentId}`);
  return data.result;
}

export async function cancelAdminPayment(paymentId: string, reason: string): Promise<AdminPayment> {
  const { data } = await client.post<ApiResponse<AdminPayment>>(
    `/admin/payments/${paymentId}/cancel`,
    { reason }
  );
  return data.result;
}

export async function markAdminPaymentPaid(paymentId: string, reason: string): Promise<AdminPayment> {
  const { data } = await client.post<ApiResponse<AdminPayment>>(
    `/admin/payments/${paymentId}/mark-paid`,
    { reason }
  );
  return data.result;
}
