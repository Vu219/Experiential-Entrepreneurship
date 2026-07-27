import client, { type ApiResponse } from './apiClient';
import type { UserPlan, UserStatus } from './admin';

// Trang Quản trị → Tổng quan (UI-10) — backend AdminOverviewController (/admin/overview).
// MỘT lần gọi trả KPI + phân bổ gói + người dùng gần đây, cùng mẫu `dashboard.ts` của trang user.
// Card "Tình trạng hệ thống" KHÔNG nằm ở đây: nó tái dùng getSystemStatus() trong `api/admin.ts`
// (endpoint đó phải probe DB/Redis/AI nên chậm và dễ lỗi hơn — tách để một dịch vụ chết không
// kéo sập cả trang).

/** Mốc so sánh của thẻ KPI — quyết định FE hiển thị "so với tuần trước" hay "so với hôm qua". */
export type StatComparison = 'PREV_WEEK' | 'PREV_DAY' | 'NONE';

export interface OverviewStat {
  total: number;
  /** null = kỳ trước bằng 0 hoặc không có lịch sử để so (hiển thị "—"). */
  deltaPct: number | null;
  /** 7 giá trị, cũ → mới. Rỗng khi chỉ số không dựng lại được lịch sử (MRR). */
  series: number[];
  comparison: StatComparison;
}

export interface OverviewStats {
  totalUsers: OverviewStat;
  activeToday: OverviewStat;
  contentCreated: OverviewStat;
  /** Doanh thu định kỳ tháng (VND) = Σ(giá gói / chu kỳ tháng) trên subscription ACTIVE. */
  monthlyRecurringRevenue: OverviewStat;
}

export interface PlanDistribution {
  planId: string;
  code: string;
  nameVi: string;
  nameEn: string;
  userCount: number;
  sharePct: number;
  /** FE lấy màu gói theo chỉ số này qua `planColor()` — cùng bảng màu với donut trang Doanh thu. */
  displayOrder: number;
}

export interface RecentUser {
  id: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  plan: UserPlan | null;
  status: UserStatus;
  /** Số nội dung user đã tạo (content_items). */
  postCount: number;
  createdAt: string;
}

export interface AdminOverviewSummary {
  stats: OverviewStats;
  planDistribution: PlanDistribution[];
  totalSubscribedUsers: number;
  recentUsers: RecentUser[];
}

// GET /admin/overview/summary?limit=
export async function getAdminOverviewSummary(limit = 5): Promise<AdminOverviewSummary> {
  const { data } = await client.get<ApiResponse<AdminOverviewSummary>>('/admin/overview/summary', {
    params: { limit },
  });
  return data.result;
}
