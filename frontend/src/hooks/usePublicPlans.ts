import { useEffect, useState } from 'react';
import type { Lang } from '../types';
import { getPublicPlans, toPricingPlans, toComparisonGroups, type PlansPayload } from '../api/plans';
import { pricingPlans, comparisonGroups, type PricingPlan, type ComparisonGroup } from '../config/plans';

// Cache module-level: landing + /pricing dùng chung một lần gọi /plans/public cho cả phiên.
let cache: PlansPayload | null = null;
let pending: Promise<PlansPayload> | null = null;

/**
 * Gói giá cho landing/pricing từ API public (bảng Plan trong DB — sửa ở admin là đổi ngay).
 * Trong lúc tải hoặc khi API lỗi, trả fallback hardcode (config/plans.ts, trùng dữ liệu seed)
 * để landing không bao giờ trống.
 */
export function usePublicPlans(lang: Lang): { plans: PricingPlan[]; groups: ComparisonGroup[] } {
  const [payload, setPayload] = useState<PlansPayload | null>(cache);

  useEffect(() => {
    if (cache) return;
    pending = pending ?? getPublicPlans();
    let alive = true;
    pending
      .then((p) => {
        cache = p;
        if (alive) setPayload(p);
      })
      .catch(() => {
        pending = null; // lần mount sau thử lại; hiện tại dùng fallback
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!payload) return { plans: pricingPlans(lang), groups: comparisonGroups(lang) };
  return { plans: toPricingPlans(payload, lang), groups: toComparisonGroups(payload, lang) };
}
