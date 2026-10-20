import { useCallback, useEffect, useState } from 'react';
import { getPlanUsage, type PlanLimitKey, type PlanUsage, type PlanUsageItem } from '../api/planLimits';
import { PLAN_LIMIT_EVENT } from '../utils/planLimitText';

// Một lần gọi / phiên cho mọi màn hình (cùng mẫu usePublicPlans), làm mới bằng `reload()` sau thao tác tạo mới
// hoặc khi backend báo chạm giới hạn (apiClient gọi invalidatePlanUsage).
let cache: PlanUsage | null = null;
let inflight: Promise<PlanUsage> | null = null;
const listeners = new Set<(u: PlanUsage | null) => void>();

function load(force = false): Promise<PlanUsage> {
  if (!force && cache) return Promise.resolve(cache);
  if (!force && inflight) return inflight;
  inflight = getPlanUsage()
    .then((u) => { cache = u; listeners.forEach((l) => l(u)); return u; })
    .finally(() => { inflight = null; });
  return inflight;
}

if (typeof window !== 'undefined') {
  window.addEventListener(PLAN_LIMIT_EVENT, () => invalidatePlanUsage());
}

/** Bỏ cache (đổi gói, vừa tạo/xoá, vừa bị chặn) — màn hình đang mở tự tải lại. */
export function invalidatePlanUsage(): void {
  cache = null;
  if (listeners.size > 0) void load(true).catch(() => undefined);
}

export function usePlanUsage() {
  const [usage, setUsage] = useState<PlanUsage | null>(cache);

  useEffect(() => {
    listeners.add(setUsage);
    load().then(setUsage).catch(() => undefined); // lỗi → coi như chưa biết, không khoá UI (backend vẫn là chốt chặn)
    return () => { listeners.delete(setUsage); };
  }, []);

  const item = useCallback(
    (key: PlanLimitKey): PlanUsageItem | undefined => usage?.items.find((i) => i.key === key),
    [usage],
  );
  /** Chưa tải được usage → true (không khoá oan). */
  const included = useCallback((key: PlanLimitKey) => item(key)?.included ?? true, [item]);
  /** QUOTA đã hết lượt (biết chắc). */
  const exhausted = useCallback((key: PlanLimitKey) => {
    const i = item(key);
    return !!i && i.limit != null && i.used != null && i.used >= i.limit;
  }, [item]);

  return { usage, item, included, exhausted, reload: useCallback(() => load(true).catch(() => undefined), []) };
}
