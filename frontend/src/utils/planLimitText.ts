import type { PlanLimitKey, PlanLimitViolation } from '../api/planLimits';

/** Mã lỗi backend của giới hạn gói (ErrorCode 2205 / 2206). */
export const PLAN_LIMIT_REACHED = 2205;
export const PLAN_FEATURE_NOT_INCLUDED = 2206;

/** Sự kiện cửa sổ phát khi backend chặn vì giới hạn gói — usePlanUsage nghe để tải lại mức sử dụng. */
export const PLAN_LIMIT_EVENT = 'aima:plan-limit';

export function isPlanLimitCode(code: number | undefined): boolean {
  return code === PLAN_LIMIT_REACHED || code === PLAN_FEATURE_NOT_INCLUDED;
}

type Dict = Record<string, string>;

/** Nhãn của một giới hạn theo ngôn ngữ đang bật. */
export function planLimitLabel(t: Dict, key: PlanLimitKey): string {
  return t[`plk_${key}`] ?? key;
}

/** Câu báo khi backend chặn vì giới hạn gói — dựng từ khoá giới hạn, không dùng message tiếng Việt cố định. */
export function planLimitMessage(t: Dict, code: number, v: PlanLimitViolation | null | undefined): string {
  if (!v?.limitKey) return code === PLAN_FEATURE_NOT_INCLUDED ? t.plgNotIncludedGeneric : t.plgReachedGeneric;
  const vars: Record<string, string> = {
    plan: v.planCode ?? '',
    feature: planLimitLabel(t, v.limitKey),
    limit: v.limit == null ? '' : v.limit.toLocaleString('vi-VN'),
  };
  const tpl = code === PLAN_FEATURE_NOT_INCLUDED || v.limit === 0 ? t.plgNotIncluded : t.plgReached;
  return Object.entries(vars).reduce((s, [k, val]) => s.split(`{${k}}`).join(val), tpl);
}
