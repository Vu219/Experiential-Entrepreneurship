import client, { type ApiResponse } from './apiClient';
import type { AiTaskCode } from './adminAi';

// Trang "Token & mức dùng" của user (GET /users/me/usage) — mọi con số gộp từ event log
// ai_usage phía backend; hạn mức từ Plan.monthlyTokenLimit; kỳ + ngày reset từ subscription.

export interface UsageSeriesPoint {
  /** Ngày trong tháng (1-based) — chỉ các ngày có hoạt động, FE tự lấp ngày trống. */
  day: number;
  totalTokens: number;
}

export interface UsageByFeature {
  taskCode: AiTaskCode;
  totalTokens: number;
  estimatedCost: number | null;
}

export interface UserUsage {
  /** Kỳ tính usage, "YYYY-MM". */
  billingPeriod: string;
  periodStart: string; // ISO datetime
  /** Cuối kỳ (exclusive) — chính là ngày reset hiển thị. */
  periodEnd: string;
  /** Mức dùng hiệu lực của kỳ (đã trừ token được cấp thêm / sau mốc reset). */
  used: number;
  /** null = không giới hạn. */
  limit: number | null;
  /** Phần kỳ này trả bằng TOKEN MUA THÊM — tổng tiêu thụ thật = used + creditUsed. */
  creditUsed: number | null;
  /** Token mua thêm còn lại (bucket riêng, không reset theo kỳ). */
  creditLeft: number | null;
  /** Các trường plan* null khi DB chưa seed gói — FE fallback theo user.plan. */
  planCode: string | null;
  /** Gói ĐANG ÁP CHO HẠN MỨC kỳ này — khác nhãn gói của user khi hạ gói giữa kỳ. */
  effectivePlanForQuota: string | null;
  /** Mốc gói mới bắt đầu áp dụng (ISO, = cuối kỳ) khi có thay đổi gói chờ; null = không có. */
  pendingPlanChangeAt: string | null;
  planNameVi: string | null;
  planNameEn: string | null;
  /** Giá gói VND / chu kỳ. */
  planPrice: number | null;
  /** true = gói không giới hạn của hệ thống (PRO): token AI + mọi tính năng không giới hạn (limit = null). */
  unlimitedPlan: boolean;
  series: UsageSeriesPoint[];
  byFeature: UsageByFeature[];
}

export async function getMyUsage(): Promise<UserUsage> {
  const { data } = await client.get<ApiResponse<UserUsage>>('/users/me/usage');
  return data.result;
}
