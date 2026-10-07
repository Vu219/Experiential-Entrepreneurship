import type { CSSProperties } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { RowMode } from './plannerLogic.ts';
import { C } from '../../styles/colors';

// Segmented 4 chế độ đăng của một card nền tảng: Đăng ngay / Chọn giờ / Gợi ý giờ / Không đăng. Một hàng 4 ô khi đủ
// rộng, hẹp (mobile) thì 2 × 2 — container query .sch-modes trong index.css, không bao giờ vỡ 3 + 1.

const MODES: RowMode[] = ['NOW', 'SCHEDULE', 'SUGGEST', 'NONE'];

export default function ScheduleModeTabs({ value, onChange, ariaLabel }: {
  value: RowMode;
  onChange: (mode: RowMode) => void;
  ariaLabel: string;
}) {
  const { t } = useApp();
  const label: Record<RowMode, string> = { NOW: t.planModeNow, SCHEDULE: t.planModeSchedule, SUGGEST: t.planModeSuggest, NONE: t.planModeNone };
  return (
    <div className="sch-modes-host">
      <div role="group" aria-label={ariaLabel} className="sch-modes" style={segmented}>
        {MODES.map((m) => {
          const on = value === m;
          return (
            <button key={m} type="button" aria-pressed={on} onClick={() => onChange(m)}
              style={{ ...segment, background: on ? C.surface : 'transparent', color: on ? C.primaryStrong : C.textSecondary, boxShadow: on ? `0 2px 8px -3px ${C.legacyShadowrgba8040140_35_}` : 'none' }}>
              {label[m]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const segmented: CSSProperties = { gap: 3, padding: 3, background: C.surfaceMuted, border: `1px solid ${C.border}`, borderRadius: 12 };
const segment: CSSProperties = { minWidth: 0, border: 'none', borderRadius: 9, padding: '8px 2px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
