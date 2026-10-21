import { useCallback, useEffect, useState } from 'react';
import { getMyPlatforms, type PlatformAccess, type PlatformAccessList } from '../api/platformAvailability';
import type { PlatformEnum } from '../api/connections';
import { PLAN_LIMIT_EVENT } from '../utils/planLimitText';

// Quyền dùng nền tảng của user (mở toàn hệ thống + thuộc gói) — một lần gọi / phiên cho mọi màn hình (cùng mẫu
// usePlanUsage). Làm mới khi backend chặn vì giới hạn gói, sau khi thanh toán/đổi gói, hoặc gọi reload().
let cache: PlatformAccessList | null = null;
let inflight: Promise<PlatformAccessList> | null = null;
const listeners = new Set<(v: PlatformAccessList | null) => void>();

function load(force = false): Promise<PlatformAccessList> {
  if (!force && cache) return Promise.resolve(cache);
  if (!force && inflight) return inflight;
  inflight = getMyPlatforms()
    .then((v) => { cache = v; listeners.forEach((l) => l(v)); return v; })
    .finally(() => { inflight = null; });
  return inflight;
}

if (typeof window !== 'undefined') {
  window.addEventListener(PLAN_LIMIT_EVENT, () => invalidatePlatformAccess());
}

/** Bỏ cache (đổi gói, admin vừa mở/khoá) — màn hình đang mở tự tải lại. */
export function invalidatePlatformAccess(): void {
  cache = null;
  if (listeners.size > 0) void load(true).catch(() => undefined);
}

export function usePlatformAccess() {
  const [access, setAccess] = useState<PlatformAccessList | null>(cache);

  useEffect(() => {
    listeners.add(setAccess);
    load().then(setAccess).catch(() => undefined); // lỗi → chưa biết: KHÔNG khoá ở FE, backend vẫn là chốt chặn
    return () => { listeners.delete(setAccess); };
  }, []);

  const of = useCallback(
    (platform: PlatformEnum): PlatformAccess | undefined => access?.platforms.find((p) => p.platform === platform),
    [access],
  );
  /** Chưa tải được → true (không khoá oan). */
  const usable = useCallback((platform: PlatformEnum) => of(platform)?.usable ?? true, [of]);

  return { access, of, usable, reload: useCallback(() => load(true).catch(() => undefined), []) };
}
