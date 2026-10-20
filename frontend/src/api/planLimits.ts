import client, { type ApiResponse } from './apiClient';

// Giới hạn tính năng theo gói (backend Flyway V18, enum PlanLimitKey). Admin cấu hình ở "Quản lý gói"; backend chặn
// tại service (mã 2205 PLAN_LIMIT_REACHED / 2206 PLAN_FEATURE_NOT_INCLUDED, result = PlanLimitViolation). FE chỉ
// hiển thị trạng thái khoá + nút nâng cấp — không tự quyết định cho phép hay không.

export type PlanLimitKey =
  | 'BRAND_PROFILES' | 'STRATEGIES_PER_BRAND' | 'CONNECTED_CHANNELS'
  | 'TREND_RESEARCH_PER_PERIOD' | 'AUTO_TREND_RESEARCH' | 'IDEAS_PER_RESEARCH'
  | 'SCHEDULING' | 'SCHEDULED_POSTS_PER_PERIOD' | 'ACTIVE_SCHEDULES' | 'SCHEDULE_HORIZON_DAYS'
  | 'GOLDEN_HOURS' | 'ANALYTICS_HISTORY_DAYS' | 'ANALYTICS_ADVANCED' | 'ANALYTICS_EXPORT'
  | 'STRATEGY_OPTIMIZATION_PER_PERIOD';

/** QUOTA = đếm lượt, CAP = trần một giá trị (ngày / số ý tưởng), FLAG = bật-tắt. */
export type PlanLimitType = 'QUOTA' | 'CAP' | 'FLAG';

/** Giá trị THÔ trên gói: số null = mặc định hệ thống, -1 = không giới hạn, 0 = tắt; cờ null = mặc định. */
export interface PlanFeatureLimits {
  brandProfiles: number | null;
  strategiesPerBrand: number | null;
  connectedChannels: number | null;
  trendResearchPerPeriod: number | null;
  autoTrendResearch: boolean | null;
  ideasPerResearch: number | null;
  scheduling: boolean | null;
  scheduledPostsPerPeriod: number | null;
  activeSchedules: number | null;
  scheduleHorizonDays: number | null;
  goldenHours: boolean | null;
  analyticsHistoryDays: number | null;
  analyticsAdvanced: boolean | null;
  analyticsExport: boolean | null;
  strategyOptimizationPerPeriod: number | null;
}

export type PlanLimitGroup = 'brand' | 'connect' | 'trend' | 'schedule' | 'analytics' | 'optimize';

/** Danh mục giới hạn — MỘT nguồn cho form admin, thẻ mức sử dụng và câu báo lỗi (nhãn i18n `plk_<KEY>`). */
export const PLAN_LIMIT_FIELDS: { key: PlanLimitKey; field: keyof PlanFeatureLimits; type: PlanLimitType; group: PlanLimitGroup }[] = [
  { key: 'BRAND_PROFILES', field: 'brandProfiles', type: 'QUOTA', group: 'brand' },
  { key: 'STRATEGIES_PER_BRAND', field: 'strategiesPerBrand', type: 'QUOTA', group: 'brand' },
  { key: 'CONNECTED_CHANNELS', field: 'connectedChannels', type: 'QUOTA', group: 'connect' },
  { key: 'TREND_RESEARCH_PER_PERIOD', field: 'trendResearchPerPeriod', type: 'QUOTA', group: 'trend' },
  { key: 'AUTO_TREND_RESEARCH', field: 'autoTrendResearch', type: 'FLAG', group: 'trend' },
  { key: 'IDEAS_PER_RESEARCH', field: 'ideasPerResearch', type: 'CAP', group: 'trend' },
  { key: 'SCHEDULING', field: 'scheduling', type: 'FLAG', group: 'schedule' },
  { key: 'SCHEDULED_POSTS_PER_PERIOD', field: 'scheduledPostsPerPeriod', type: 'QUOTA', group: 'schedule' },
  { key: 'ACTIVE_SCHEDULES', field: 'activeSchedules', type: 'QUOTA', group: 'schedule' },
  { key: 'SCHEDULE_HORIZON_DAYS', field: 'scheduleHorizonDays', type: 'CAP', group: 'schedule' },
  { key: 'GOLDEN_HOURS', field: 'goldenHours', type: 'FLAG', group: 'schedule' },
  { key: 'ANALYTICS_HISTORY_DAYS', field: 'analyticsHistoryDays', type: 'CAP', group: 'analytics' },
  { key: 'ANALYTICS_ADVANCED', field: 'analyticsAdvanced', type: 'FLAG', group: 'analytics' },
  { key: 'ANALYTICS_EXPORT', field: 'analyticsExport', type: 'FLAG', group: 'analytics' },
  { key: 'STRATEGY_OPTIMIZATION_PER_PERIOD', field: 'strategyOptimizationPerPeriod', type: 'QUOTA', group: 'optimize' },
];

export const PLAN_LIMIT_GROUPS: PlanLimitGroup[] = ['brand', 'connect', 'trend', 'schedule', 'analytics', 'optimize'];

// Mã lỗi + câu báo nằm ở utils/planLimitText (apiClient dùng — tách để không import vòng qua client).
export { PLAN_LIMIT_REACHED, PLAN_FEATURE_NOT_INCLUDED, planLimitLabel, planLimitMessage } from '../utils/planLimitText';

/** `result` của lỗi 2205/2206. */
export interface PlanLimitViolation {
  limitKey: PlanLimitKey;
  /** Hạn mức hiệu lực (0 = không có trong gói). */
  limit: number | null;
  used: number | null;
  planCode: string | null;
}

export interface PlanUsageItem {
  key: PlanLimitKey;
  type: PlanLimitType;
  /** null = không giới hạn / đang bật; 0 = tắt. */
  limit: number | null;
  /** null = không đếm ở cấp tài khoản (CAP, FLAG, theo từng thương hiệu). */
  used: number | null;
  included: boolean;
}

export interface PlanUsage {
  planCode: string | null;
  periodStart: string;
  periodEnd: string;
  items: PlanUsageItem[];
}

/** GET /users/me/plan-usage — giới hạn của gói hiện tại + mức đã dùng trong kỳ. */
export async function getPlanUsage(): Promise<PlanUsage> {
  const { data } = await client.get<ApiResponse<PlanUsage>>('/users/me/plan-usage');
  return data.result;
}
