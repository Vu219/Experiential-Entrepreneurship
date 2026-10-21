// Danh mục giới hạn theo gói — module THUẦN (không import client) để hàm thuần + test node dùng được.
// api/planLimits.ts re-export toàn bộ; nơi khác import từ api/planLimits như cũ.
import type { PlatformEnum } from './connections.ts';

export type PlanLimitKey =
  | 'BRAND_PROFILES' | 'STRATEGIES_PER_BRAND' | 'CONNECTED_CHANNELS' | 'ALLOWED_PLATFORMS'
  | 'TREND_RESEARCH_PER_PERIOD' | 'AUTO_TREND_RESEARCH' | 'IDEAS_PER_RESEARCH'
  | 'SCHEDULING' | 'SCHEDULED_POSTS_PER_PERIOD' | 'ACTIVE_SCHEDULES' | 'SCHEDULE_HORIZON_DAYS'
  | 'GOLDEN_HOURS' | 'ANALYTICS_HISTORY_DAYS' | 'ANALYTICS_ADVANCED' | 'ANALYTICS_EXPORT'
  | 'STRATEGY_OPTIMIZATION_PER_PERIOD' | 'POLICY_CHECK_AI_PER_PERIOD' | 'AI_FIX_PER_VERSION';

/** QUOTA = đếm lượt, CAP = trần một giá trị (ngày / số ý tưởng), FLAG = bật-tắt, SET = tập nền tảng. */
export type PlanLimitType = 'QUOTA' | 'CAP' | 'FLAG' | 'SET';

/**
 * Giá trị THÔ trên gói: số -1 = không giới hạn, 0 = tắt, > 0 = hạn mức; cờ true/false; nền tảng = danh sách.
 * null = "Mặc định hệ thống" (chỉ 3 gói lõi FREE/PLUS/PRO — gói tự tạo bắt buộc điền đủ, mã 2211).
 */
export interface PlanFeatureLimits {
  brandProfiles: number | null;
  strategiesPerBrand: number | null;
  connectedChannels: number | null;
  allowedPlatforms: PlatformEnum[] | null;
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
  policyCheckAiPerPeriod: number | null;
  aiFixPerVersion: number | null;
}

export type PlanLimitGroup = 'brand' | 'connect' | 'trend' | 'schedule' | 'analytics' | 'ai';

/** Đơn vị hiển thị sau ô số (khoá i18n `plu_<unit>`). */
export type PlanLimitUnit = 'profiles' | 'strategies' | 'channels' | 'perPeriod' | 'ideas' | 'schedules' | 'days' | 'times';

export interface PlanLimitField {
  key: PlanLimitKey;
  field: keyof PlanFeatureLimits;
  type: PlanLimitType;
  group: PlanLimitGroup;
  unit?: PlanLimitUnit;
}

/** Danh mục giới hạn — MỘT nguồn cho form admin, thẻ mức sử dụng, bảng so sánh tự động và câu báo lỗi (nhãn `plk_<KEY>`). */
export const PLAN_LIMIT_FIELDS: PlanLimitField[] = [
  { key: 'BRAND_PROFILES', field: 'brandProfiles', type: 'QUOTA', group: 'brand', unit: 'profiles' },
  { key: 'STRATEGIES_PER_BRAND', field: 'strategiesPerBrand', type: 'QUOTA', group: 'brand', unit: 'strategies' },
  { key: 'ALLOWED_PLATFORMS', field: 'allowedPlatforms', type: 'SET', group: 'connect' },
  { key: 'CONNECTED_CHANNELS', field: 'connectedChannels', type: 'QUOTA', group: 'connect', unit: 'channels' },
  { key: 'TREND_RESEARCH_PER_PERIOD', field: 'trendResearchPerPeriod', type: 'QUOTA', group: 'trend', unit: 'perPeriod' },
  { key: 'AUTO_TREND_RESEARCH', field: 'autoTrendResearch', type: 'FLAG', group: 'trend' },
  { key: 'IDEAS_PER_RESEARCH', field: 'ideasPerResearch', type: 'CAP', group: 'trend', unit: 'ideas' },
  { key: 'SCHEDULING', field: 'scheduling', type: 'FLAG', group: 'schedule' },
  { key: 'SCHEDULED_POSTS_PER_PERIOD', field: 'scheduledPostsPerPeriod', type: 'QUOTA', group: 'schedule', unit: 'perPeriod' },
  { key: 'ACTIVE_SCHEDULES', field: 'activeSchedules', type: 'QUOTA', group: 'schedule', unit: 'schedules' },
  { key: 'SCHEDULE_HORIZON_DAYS', field: 'scheduleHorizonDays', type: 'CAP', group: 'schedule', unit: 'days' },
  { key: 'GOLDEN_HOURS', field: 'goldenHours', type: 'FLAG', group: 'schedule' },
  { key: 'ANALYTICS_HISTORY_DAYS', field: 'analyticsHistoryDays', type: 'CAP', group: 'analytics', unit: 'days' },
  { key: 'ANALYTICS_ADVANCED', field: 'analyticsAdvanced', type: 'FLAG', group: 'analytics' },
  { key: 'ANALYTICS_EXPORT', field: 'analyticsExport', type: 'FLAG', group: 'analytics' },
  { key: 'STRATEGY_OPTIMIZATION_PER_PERIOD', field: 'strategyOptimizationPerPeriod', type: 'QUOTA', group: 'ai', unit: 'perPeriod' },
  { key: 'POLICY_CHECK_AI_PER_PERIOD', field: 'policyCheckAiPerPeriod', type: 'QUOTA', group: 'ai', unit: 'perPeriod' },
  { key: 'AI_FIX_PER_VERSION', field: 'aiFixPerVersion', type: 'CAP', group: 'ai', unit: 'times' },
];

export const PLAN_LIMIT_GROUPS: PlanLimitGroup[] = ['connect', 'brand', 'trend', 'schedule', 'analytics', 'ai'];

export const ALL_PLATFORMS: PlatformEnum[] = ['FACEBOOK', 'INSTAGRAM', 'THREADS'];

export function planLimitField(key: PlanLimitKey): PlanLimitField | undefined {
  return PLAN_LIMIT_FIELDS.find((f) => f.key === key);
}
