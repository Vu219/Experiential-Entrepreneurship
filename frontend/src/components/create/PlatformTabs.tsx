import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../ui';
import { PLATFORMS, PLATFORM_BG } from '../../theme';
import type { Platform } from '../../api/brandProfile';

export const tagOfPlatform = (p: Platform): string => (p === 'FACEBOOK' ? 'FB' : p === 'INSTAGRAM' ? 'IG' : 'TH');

/** Trạng thái job tạo nội dung của từng nền tảng (PA1 — mỗi nền tảng một job độc lập). */
export type PlatformRunStatus = 'running' | 'done' | 'error';

const RUN_DOT: Record<PlatformRunStatus, string> = {
  running: '#d97706',
  done: '#16a34a',
  error: '#dc2626',
};

/**
 * Hàng tab chuyển nền tảng (FB/IG/TH) — dùng ở mốc 2/3/4 của wizard và panel xem.
 * `statuses` (tùy chọn, mốc 2): chấm màu trạng thái job từng nền tảng — đang tạo (cam,
 * nhấp nháy) / xong (xanh) / lỗi (đỏ).
 */
export default function PlatformTabs({
  platforms,
  value,
  onChange,
  statuses,
  statusLabels,
}: {
  platforms: Platform[];
  value: Platform;
  onChange: (p: Platform) => void;
  statuses?: Partial<Record<Platform, PlatformRunStatus>>;
  statusLabels?: Record<PlatformRunStatus, string>;
}) {
  const { brandGradient } = useApp();
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {platforms.map((p) => {
        const tag = tagOfPlatform(p);
        const on = value === p;
        const run = statuses?.[p];
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-pressed={on}
            title={run && statusLabels ? statusLabels[run] : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px',
              border: on ? '1.5px solid transparent' : '1.5px solid #ece8f6', borderRadius: 10,
              background: on ? brandGradient : '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: on ? '#fff' : '#3f3a55',
            }}
          >
            <PlatformTag tag={tag} bg={on ? 'rgba(255,255,255,.25)' : PLATFORM_BG[tag]} size={20} radius={6} fontSize={10} />
            {PLATFORMS.find((pl) => pl.tag === tag)?.name ?? p}
            {run && (
              <span
                aria-hidden
                className={run === 'running' ? 'run-dot-pulse' : undefined}
                style={{
                  width: 8, height: 8, borderRadius: '50%', flex: 'none',
                  background: RUN_DOT[run],
                  boxShadow: on ? '0 0 0 2px rgba(255,255,255,.5)' : 'none',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
