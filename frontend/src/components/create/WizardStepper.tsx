import { Check, ChevronLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Icon } from '../ui';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { Dict } from '../../i18n';

export type WizardStep = 1 | 2 | 3 | 4;

/** Key i18n tên 4 mốc — dùng chung với card nháp ("Dừng ở: …") ở list view. */
export const STEP_KEYS: (keyof Dict)[] = ['cwStep1', 'cwStep2', 'cwStep3', 'cwStep4'];

/** Mốc cuối = số phần tử STEP_KEYS — mọi chỗ đếm mốc lấy từ đây, không hardcode. */
const LAST_STEP = STEP_KEYS.length;

/**
 * Stepper trên đầu wizard (Chọn nguồn → Tạo nội dung → Hoàn thiện → Lên lịch đăng bài).
 * Chỉ cho nhảy lùi về mốc đã đi qua.
 * - Tablet/desktop: timeline ngang đầy đủ.
 * - Mobile: dạng gọn "Bước n/N · Tên bước" + thanh progress (không tràn ngang),
 *   kèm nút lùi một bước.
 */
export default function WizardStepper({
  current,
  maxReached,
  onGo,
}: {
  current: WizardStep;
  maxReached: WizardStep;
  onGo: (s: WizardStep) => void;
}) {
  const { t, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();

  if (isMobile) {
    const canBack = current > 1;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => canBack && onGo((current - 1) as WizardStep)}
            disabled={!canBack}
            aria-label={t.cwBack}
            style={{ width: 34, height: 34, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, cursor: canBack ? 'pointer' : 'not-allowed', opacity: canBack ? 1 : 0.4 }}
          >
            <Icon icon={ChevronLeft} size={17} stroke="#574f6e" />
          </button>
          <span style={{ flex: 'none', background: brandGradient, color: '#fff', borderRadius: 9, padding: '4px 10px', fontSize: 12, fontWeight: 800 }}>
            {t.cwStepWord} {current}/{LAST_STEP}
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#211c38', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t[STEP_KEYS[current - 1]]}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 99, background: '#e7e2f2', overflow: 'hidden' }} aria-hidden>
          <div style={{ width: `${(current / LAST_STEP) * 100}%`, height: '100%', borderRadius: 99, background: brandGradient, transition: 'width .2s' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', padding: '2px 0' }}>
      {STEP_KEYS.map((key, i) => {
        const n = (i + 1) as WizardStep;
        const done = n < current;
        const active = n === current;
        const reachable = n <= maxReached;
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'flex-start', flex: i < LAST_STEP - 1 ? 1 : 'none', minWidth: 0 }}>
            <button
              type="button"
              onClick={() => reachable && onGo(n)}
              disabled={!reachable}
              aria-current={active ? 'step' : undefined}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: reachable ? 'pointer' : 'default', padding: 0, minWidth: 78, opacity: 1 }}
            >
              <span
                style={{
                  width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13.5, fontWeight: 800, flex: 'none',
                  background: done || active ? brandGradient : '#fff',
                  color: done || active ? '#fff' : '#a59fbb',
                  border: done || active ? 'none' : '1.5px solid #e7e2f2',
                  boxShadow: active ? '0 10px 20px -10px rgba(139,92,246,.7)' : 'none',
                }}
              >
                {done ? <Icon icon={Check} size={16} stroke="#fff" /> : n}
              </span>
              <span style={{ fontSize: 12, fontWeight: active ? 800 : 600, color: active ? '#211c38' : done ? '#574f6e' : '#a59fbb', whiteSpace: 'nowrap' }}>
                {t[key]}
              </span>
            </button>
            {i < LAST_STEP - 1 && (
              <div style={{ flex: 1, height: 2, borderRadius: 2, background: n < current ? 'var(--brand)' : '#e7e2f2', margin: '16px 8px 0', minWidth: 12 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
