import { useApp } from '../../context/AppContext';
import StatusBadge, { type Tone } from '../admin/StatusBadge';
import type { ContentStrategy, StrategyStatus } from '../../api/contentStrategy';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
};

export function statusMeta(s: StrategyStatus, t: ReturnType<typeof useApp>['t']): { tone: Tone; label: string } {
  if (s === 'ACTIVE') return { tone: 'success', label: t.csStActive };
  if (s === 'PAUSED') return { tone: 'warning', label: t.csStPaused };
  return { tone: 'neutral', label: t.csStDraft };
}

export default function StrategyCard({ s, selected, onSelect, onToggleStatus }: { s: ContentStrategy; selected: boolean; onSelect: () => void; onToggleStatus: (next: StrategyStatus) => void }) {
  const { t, brandGradient } = useApp();
  const meta = statusMeta(s.status, t);
  // FR-13: ACTIVE → Tạm dừng (PAUSED); DRAFT/PAUSED → Kích hoạt (ACTIVE). Cả DRAFT & PAUSED đều chặn Agent AI.
  const runnable = s.status === 'ACTIVE';

  return (
    <div
      onClick={onSelect}
      style={{ cursor: 'pointer', border: selected ? '2px solid transparent' : '1px solid #efeaf8', backgroundImage: selected ? `linear-gradient(#fff,#fff), ${brandGradient}` : undefined, backgroundOrigin: 'border-box', backgroundClip: selected ? 'padding-box, border-box' : undefined, background: selected ? undefined : '#fff', borderRadius: 14, padding: 15, display: 'flex', flexDirection: 'column', gap: 9 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 14.5, color: '#211c38' }}>{s.name || '—'}</span>
        <StatusBadge tone={meta.tone} label={meta.label} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8a85a0' }}>
        <span style={{ background: '#f4f1fb', color: '#5b4b86', borderRadius: 7, padding: '3px 9px', fontWeight: 700 }}>{s.postsPerWeek} {t.csPostsPerWeek}</span>
        <span>{t.csUpdatedAt}: {fmtDate(s.updatedAt)}</span>
      </div>

      {!runnable && <div style={{ fontSize: 11.5, color: '#b08968', background: '#fdf6ec', borderRadius: 8, padding: '6px 9px' }}>{t.csPausedNote}</div>}

      <button
        onClick={(e) => { e.stopPropagation(); onToggleStatus(runnable ? 'PAUSED' : 'ACTIVE'); }}
        style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #ece8f6', background: runnable ? '#fdf0dc' : '#e8f8ee', color: runnable ? '#d97706' : '#16a34a', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />
        {runnable ? t.csPause : t.csActivate}
      </button>
    </div>
  );
}
