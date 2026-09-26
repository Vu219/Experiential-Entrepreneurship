import client, { type ApiResponse, type PageResponse } from './apiClient';
import type { Tone } from '../components/admin/StatusBadge';
import type { Lang } from '../types';

// Trang admin "Quản lý doanh thu" — nối BE THẬT (`/admin/revenue`), nguồn dữ liệu là sổ cái
// `payments`. KHÔNG có mock ở đây: bảng rỗng thì các endpoint trả 0/mảng rỗng và trang hiển
// thị empty state thật. Dữ liệu mẫu để dựng giao diện tạo bằng dev seeder phía BE
// (POST /admin/revenue/dev-seed, gated sau cờ AIMA_DEV_PAYMENT_SEED — gọi qua Swagger).

// ===== Bộ lọc thời gian (dùng chung cho MỌI endpoint của trang) =====

export type RevenueGranularity = 'DAY' | 'MONTH' | 'HALF_YEAR' | 'YEAR' | 'CUSTOM';

/**
 * Trạng thái thanh toán — khớp enum `PaymentStatus` của backend.
 * `EXPIRED` (hết giờ chờ) và `CANCELLED` (user/admin huỷ) tách riêng khỏi `FAILED` có chủ ý:
 * khách bỏ giỏ hàng không phải cổng thanh toán lỗi, nên hai trạng thái này KHÔNG vào tỉ lệ
 * giao dịch thất bại.
 */
export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

/** Cổng thanh toán — khớp enum `PaymentGateway`. `MOCK` chỉ tồn tại ở môi trường dev. */
export type PaymentGateway = 'MANUAL' | 'PAYOS' | 'MOCK';

/**
 * Chế độ lọc của trang admin. `WEEK` CHỈ có ở FE: gửi BE dưới dạng CUSTOM Thứ 2 → Chủ nhật (bucket
 * theo ngày, so với 7 ngày liền trước). BE vẫn còn HALF_YEAR nhưng UI đã bỏ.
 */
export type RevenueFilterMode = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM';

export interface RevenueFilter {
  granularity: RevenueFilterMode;
  /** DAY / MONTH */
  year?: number;
  /** DAY (1–12) */
  month?: number;
  /** YEAR */
  fromYear?: number;
  toYear?: number;
  /** WEEK / CUSTOM — 'YYYY-MM-DD' */
  from?: string;
  to?: string;
}

export interface TransactionFilter {
  status?: PaymentStatus;
  planId?: string;
}

/** Chỉ gửi tham số mà chế độ đang chọn thật sự cần — BE báo lỗi 2038 nếu thiếu. */
const filterParams = (f: RevenueFilter): Record<string, string | number | undefined> => {
  switch (f.granularity) {
    case 'DAY':
      return { granularity: f.granularity, year: f.year, month: f.month };
    case 'MONTH':
      return { granularity: f.granularity, year: f.year };
    case 'YEAR':
      return { granularity: f.granularity, fromYear: f.fromYear, toYear: f.toYear };
    case 'WEEK':
    case 'CUSTOM':
      return { granularity: 'CUSTOM', from: f.from, to: f.to };
  }
};

// ===== KPI =====

/** Loại kỳ so sánh — quyết định chữ "so với ..." hiển thị dưới mỗi thẻ KPI. */
export type RevenueComparison = 'PREV_MONTH' | 'PREV_YEAR' | 'PREV_HALF' | 'PREV_RANGE';

export interface RevenueSummary {
  totalRevenue: number;
  grossRevenue: number;
  refundedAmount: number;
  transactionCount: number;
  avgPerTransaction: number;
  failedCount: number;
  failureRatePct: number | null;
  revenueDeltaPct: number | null;
  transactionDeltaPct: number | null;
  avgDeltaPct: number | null;
  comparison: RevenueComparison;
  periodStart: string;
  periodEnd: string;
}

export async function getRevenueSummary(filter: RevenueFilter): Promise<RevenueSummary> {
  const { data } = await client.get<ApiResponse<RevenueSummary>>('/admin/revenue/summary', {
    params: filterParams(filter),
  });
  return data.result;
}

// ===== Chart =====

export interface RevenuePoint {
  label: string;
  bucket: string;
  /** Doanh thu NET — CÓ THỂ ÂM khi hoàn tiền của kỳ trước rơi vào bucket này. */
  revenue: number;
  gross: number;
  refunded: number;
  transactions: number;
}

export interface RevenueTimeseries {
  granularity: RevenueGranularity;
  periodStart: string;
  periodEnd: string;
  points: RevenuePoint[];
}

export async function getRevenueTimeseries(filter: RevenueFilter): Promise<RevenueTimeseries> {
  const { data } = await client.get<ApiResponse<RevenueTimeseries>>('/admin/revenue/timeseries', {
    params: filterParams(filter),
  });
  return data.result;
}

// ===== Bảng giao dịch =====

export interface RevenueTransaction {
  id: string;
  code: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  planCode: string;
  planNameVi: string;
  planNameEn: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  date: string;
  orderedAt: string;
  paidAt?: string;
  refundedAmount: number;
  refundedAt?: string;
  gateway: PaymentGateway;
  gatewayTxnId?: string;
}

export interface TransactionQuery extends TransactionFilter {
  page: number;
  size: number;
  /** 'date' | 'amount' + ',asc' | ',desc' */
  sort?: string;
}

export interface TransactionPage {
  rows: RevenueTransaction[];
  total: number;
  pageCount: number;
  page: number;
}

export async function getRevenueTransactions(
  filter: RevenueFilter,
  query: TransactionQuery,
): Promise<TransactionPage> {
  const { data } = await client.get<ApiResponse<PageResponse<RevenueTransaction>>>(
    '/admin/revenue/transactions',
    { params: { ...filterParams(filter), ...query } },
  );
  const p = data.result;
  return { rows: p.content, total: p.totalElements, pageCount: p.totalPages, page: p.page };
}

// ===== Cơ cấu gói (donut) =====

export interface PlanRevenue {
  planId: string;
  planCode: string;
  nameVi: string;
  nameEn: string;
  displayOrder: number;
  revenue: number;
  transactions: number;
  sharePct: number;
}

export async function getRevenuePlanBreakdown(filter: RevenueFilter): Promise<PlanRevenue[]> {
  const { data } = await client.get<ApiResponse<PlanRevenue[]>>('/admin/revenue/plan-breakdown', {
    params: filterParams(filter),
  });
  return data.result;
}

// ===== Doanh thu dự kiến =====

export interface RevenueForecast {
  month: string;
  actualSoFar: number;
  projected: number;
  previousMonth: number;
  deltaPct: number | null;
  daysElapsed: number;
  daysInMonth: number;
  sparkline: number[];
}

export async function getRevenueForecast(): Promise<RevenueForecast> {
  const { data } = await client.get<ApiResponse<RevenueForecast>>('/admin/revenue/forecast');
  return data.result;
}

// ===== Export =====

/** Đếm trước khi export — vượt trần thì báo số thực tế thay vì cắt cụt im lặng. */
export async function countRevenueTransactions(
  filter: RevenueFilter,
  txFilter: TransactionFilter,
): Promise<number> {
  const { data } = await client.get<ApiResponse<number>>('/admin/revenue/transactions/count', {
    params: { ...filterParams(filter), ...txFilter },
  });
  return data.result;
}

/** BE trả nội dung file dạng chuỗi trong envelope; FE tự tạo Blob (cùng mẫu export usage). */
export async function exportRevenue(
  filter: RevenueFilter,
  txFilter: TransactionFilter,
  format: 'txt' | 'csv',
): Promise<string> {
  const { data } = await client.get<ApiResponse<string>>('/admin/revenue/export', {
    params: { ...filterParams(filter), ...txFilter, format },
  });
  return data.result;
}

// ===== Nhãn hiển thị =====

const P = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);

/**
 * Màu + chữ cho badge trạng thái. Chỉ các giá trị của enum BE — không thêm trạng thái
 * trang trí nào khác. Switch vét cạn CÓ CHỦ Ý (không `default`): thêm giá trị vào enum BE
 * mà quên thêm case ở đây thì `tsc` fail build, đúng thứ ta muốn.
 */
export const paymentStatusMeta = (lang: Lang, s: PaymentStatus): { tone: Tone; label: string } => {
  switch (s) {
    case 'PAID':
      return { tone: 'success', label: P(lang, 'Đã thanh toán', 'Paid') };
    case 'PENDING':
      return { tone: 'warning', label: P(lang, 'Chờ thanh toán', 'Pending') };
    case 'FAILED':
      return { tone: 'danger', label: P(lang, 'Thất bại', 'Failed') };
    case 'EXPIRED':
      return { tone: 'neutral', label: P(lang, 'Hết hạn', 'Expired') };
    case 'CANCELLED':
      return { tone: 'neutral', label: P(lang, 'Đã huỷ', 'Cancelled') };
    case 'REFUNDED':
      return { tone: 'danger', label: P(lang, 'Đã hoàn tiền', 'Refunded') };
    case 'PARTIALLY_REFUNDED':
      return { tone: 'warning', label: P(lang, 'Hoàn một phần', 'Partially refunded') };
  }
};
