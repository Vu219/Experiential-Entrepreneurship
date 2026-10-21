import type { PlanLimitKey, PlanLimitViolation } from '../api/planLimits';

/** Mã lỗi backend của giới hạn gói (ErrorCode 2205 / 2206) và hết token AI của kỳ (1990) — đều HTTP 403. */
export const PLAN_LIMIT_REACHED = 2205;
export const PLAN_FEATURE_NOT_INCLUDED = 2206;
export const TOKEN_QUOTA_EXCEEDED = 1990;

/** Sự kiện cửa sổ phát khi backend chặn vì giới hạn gói — usePlanUsage nghe để tải lại mức sử dụng. */
export const PLAN_LIMIT_EVENT = 'aima:plan-limit';

/**
 * Lỗi vượt quyền theo GÓI (phân biệt theo `code`, KHÔNG theo HTTP 403 — 403 phân quyền thường không vào nhánh này):
 * 2205 / 2206 / 1990.
 */
export function isPlanLimitCode(code: number | undefined): boolean {
  return code === PLAN_LIMIT_REACHED || code === PLAN_FEATURE_NOT_INCLUDED || code === TOKEN_QUOTA_EXCEEDED;
}

type Dict = Record<string, string>;

const PLATFORM_NAMES: Record<string, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };

/** Nhãn của một giới hạn theo ngôn ngữ đang bật. */
export function planLimitLabel(t: Dict, key: PlanLimitKey): string {
  return t[`plk_${key}`] ?? key;
}

/** Câu báo khi backend chặn vì giới hạn gói / hết token — dựng từ mã + khoá giới hạn, không dùng message cố định. */
export function planLimitMessage(t: Dict, code: number, v: PlanLimitViolation | null | undefined): string {
  if (code === TOKEN_QUOTA_EXCEEDED) return t.plgTokenQuota;
  if (!v?.limitKey) return code === PLAN_FEATURE_NOT_INCLUDED ? t.plgNotIncludedGeneric : t.plgReachedGeneric;
  const vars: Record<string, string> = {
    plan: v.planCode ?? '',
    feature: planLimitLabel(t, v.limitKey),
    limit: v.limit == null ? '' : v.limit.toLocaleString('vi-VN'),
    platform: v.platform ? PLATFORM_NAMES[v.platform] ?? v.platform : '',
  };
  const tpl = v.limitKey === 'ALLOWED_PLATFORMS' && v.platform ? t.plgPlatformNotIncluded
    : code === PLAN_FEATURE_NOT_INCLUDED || v.limit === 0 ? t.plgNotIncluded : t.plgReached;
  return Object.entries(vars).reduce((s, [k, val]) => s.split(`{${k}}`).join(val), tpl);
}
