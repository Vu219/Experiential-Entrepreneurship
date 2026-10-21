import client, { type ApiResponse } from "./apiClient";
import type { Platform } from "./brandProfile";
import type { ConnectionStatus } from "./connections";
import type { AnalyticsContentType } from "./analytics";

// Bảng điều khiển (UI-02) — backend DashboardController (/dashboard).
// MỘT lần gọi trả toàn bộ số liệu của trang thay cho 7 request rời rạc trước đây.
// Timeline "Hoạt động gần đây" KHÔNG nằm ở đây: trang tái dùng GET /notifications sẵn có.

/** Một thẻ số liệu: tổng tích lũy + % thay đổi 7 ngày + chuỗi 7 ngày để vẽ sparkline. */
export interface DashboardStat {
  total: number;
  /** null = kỳ trước bằng 0, không có mốc so sánh (hiển thị "—"). */
  deltaPct: number | null;
  /** 7 giá trị, cũ → mới. */
  series: number[];
}

export interface DashboardStats {
  total: DashboardStat;
  posted: DashboardStat;
  pending: DashboardStat;
  rejected: DashboardStat;
}

export interface DashboardPoint {
  /** yyyy-MM-dd. */
  date: string;
  reach: number;
  engagement: number;
}

export interface DashboardTopic {
  name: string;
  posts: number;
  engagement: number;
}

export interface DashboardPlatform {
  platform: Platform;
  connected: boolean;
  accountName: string | null;
  avatarUrl: string | null;
  status: ConnectionStatus | null;
}

/** FR-86 — tiến độ thiết lập, backend suy ra từ dữ liệu thật (không lưu cột riêng). */
export interface DashboardOnboarding {
  brand: boolean;
  connection: boolean;
  strategy: boolean;
  content: boolean;
  completed: number;
  total: number;
}

export interface DashboardSummary {
  stats: DashboardStats;
  /** Dòng phụ của banner chào mừng — bài chờ duyệt (NEED_REVIEW). */
  awaitingReview: number;
  /** Dòng phụ của banner chào mừng — bài đã lên lịch (SCHEDULED). */
  scheduled: number;
  /** Đủ rangeDays điểm liên tục — ngày không có bài đăng đã được backend zero-fill. */
  performance: DashboardPoint[];
  rangeDays: number;
  /** Loại nội dung của bài ĐĂNG trong 7 ngày gần nhất — cùng số với khối loại nội dung trang Phân tích. */
  contentTypes: AnalyticsContentType[];
  topTopics: DashboardTopic[];
  /** Luôn đủ 3 nền tảng trong scope (FB/IG/Threads), kể cả chưa kết nối. */
  platforms: DashboardPlatform[];
  onboarding: DashboardOnboarding;
}

/** Biểu đồ "Hiệu quả nội dung" + donut "Loại nội dung" theo khoảng lọc; from/to là khoảng backend ĐÃ kẹp theo gói. */
export interface DashboardPerformance {
  from: string;
  to: string;
  rangeDays: number;
  points: DashboardPoint[];
  /** Loại nội dung của bài đăng trong cùng khoảng — cùng số với trang Phân tích. */
  contentTypes: AnalyticsContentType[];
}

// GET /dashboard/summary — biểu đồ trong đó luôn là 7 ngày gần nhất (bộ lọc mặc định).
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await client.get<ApiResponse<DashboardSummary>>("/dashboard/summary", { params: { days: 7 } });
  return data.result;
}

// GET /dashboard/performance?from=&to= — nút "Bộ lọc" của biểu đồ (30 ngày / tùy chỉnh). Ngày yyyy-MM-dd.
export async function getDashboardPerformance(from: string, to: string): Promise<DashboardPerformance> {
  const { data } = await client.get<ApiResponse<DashboardPerformance>>("/dashboard/performance", { params: { from, to } });
  return data.result;
}
