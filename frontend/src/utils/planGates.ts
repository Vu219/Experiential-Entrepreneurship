// Chặn TRƯỚC ở FE theo mức dùng gói (GET /users/me/plan-usage) — hàm thuần, test ở tests/planGates.test.ts.
// Chỉ để đỡ thao tác thừa: backend vẫn là chốt chặn (2205/2206). Chưa có dữ liệu → KHÔNG khoá (trả null / mở).
import type { PlanUsageItem } from '../api/planLimits';

/** QUOTA đã hết lượt (biết chắc). */
export function quotaExhausted(item: PlanUsageItem | undefined): boolean {
  return !!item && item.limit != null && item.used != null && item.used >= item.limit;
}

/** STRATEGIES_PER_BRAND: thương hiệu này đã đủ số chiến lược. */
export function scopeExhausted(item: PlanUsageItem | undefined, scopeId: string | null | undefined): boolean {
  if (!item || item.limit == null || !scopeId) return false;
  const scope = item.scopes?.find((s) => s.scopeId === scopeId);
  return !!scope && scope.used >= item.limit;
}

/** Các lựa chọn số (vd 5/10/15/20 ý tưởng) còn hợp lệ dưới trần CAP; trần 0/không biết → giữ nguyên danh sách. */
export function optionsWithinCap(options: number[], cap: number | null | undefined): number[] {
  if (cap == null || cap <= 0) return options;
  const allowed = options.filter((n) => n <= cap);
  return allowed.length > 0 ? allowed : [cap];
}

function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ANALYTICS_HISTORY_DAYS: ngày sớm nhất được chọn (cùng quy tắc backend: hôm nay là ngày thứ 1). */
export function earliestAnalyticsDate(historyDays: number | null | undefined, todayISO: string): string | null {
  if (historyDays == null) return null;
  return addDaysISO(todayISO, -Math.max(0, historyDays - 1));
}

/** SCHEDULE_HORIZON_DAYS: ngày xa nhất được đặt lịch (backend làm tròn xuống nên đúng N ngày sau vẫn hợp lệ). */
export function latestScheduleDate(horizonDays: number | null | undefined, todayISO: string): string | null {
  if (horizonDays == null || horizonDays <= 0) return null;
  return addDaysISO(todayISO, horizonDays);
}
