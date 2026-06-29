import type { ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../ui';
import { PLATFORMS } from '../../theme';
import StatusBadge from '../admin/StatusBadge';
import { statusMeta } from './StrategyCard';
import StrategySummary from './StrategySummary';
import { ReadChips } from './chips';
import type { ContentStrategy, Platform } from '../../api/contentStrategy';
import { FREQUENCY_UNIT_OPTIONS } from '../../data';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
};
const TAG_BY_ENUM: Record<Platform, string> = { FACEBOOK: 'FB', INSTAGRAM: 'IG', THREADS: 'TH' };

/** Chi tiết chiến lược (read-only) — 8 mục thuộc tính + "Tóm tắt chiến lược". */
export default function StrategyDetail({ s, onEdit, onDelete }: { s: ContentStrategy; onEdit: () => void; onDelete: () => void }) {
  const { t, lang } = useApp();
  const meta = statusMeta(s.status, t);
  const unitLabel = FREQUENCY_UNIT_OPTIONS(lang).find((u) => u.value === (s.frequencyUnit ?? 'WEEK'))?.label ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: '#211c38' }}>{s.name}</span>
            <StatusBadge tone={meta.tone} label={meta.label} />
          </div>
          <div style={{ fontSize: 12.5, color: '#8a85a0', marginTop: 4 }}>{t.csCreatedAt}: {fmtDate(s.createdAt)} · {t.csUpdatedAt}: {fmtDate(s.updatedAt)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <Sec label={t.csGoal}><ReadChips items={s.goals} /></Sec>
        <Sec label={t.csTypes}><ReadChips items={s.contentTypes} /></Sec>
        <Sec label={t.csFreq}><span style={valTxt}>{s.frequencyCount ?? 3} {t.csPostsPer} {unitLabel}</span></Sec>
        <Sec label={t.csPlatforms}>
          <div style={{ display: 'flex', gap: 7 }}>
            {s.platforms.map((p) => { const pl = PLATFORMS.find((x) => x.tag === TAG_BY_ENUM[p]); return pl ? <PlatformTag key={p} tag={pl.tag} bg={pl.bg} size={26} radius={7} /> : null; })}
          </div>
        </Sec>
        <Sec label={t.csTimes}><ReadChips items={s.timeSlots} /></Sec>
        <Sec label={t.csAudience}><ReadChips items={s.audiences} /></Sec>
        <Sec label={t.csStyle}><ReadChips items={s.styles} /></Sec>
        <Sec label={t.csCta}><ReadChips items={s.ctas} /></Sec>
      </div>

      <div style={{
        position: 'sticky',
        bottom: -22,
        margin: '32px -22px -22px -22px',
        padding: '20px 22px',
        background: '#fff',
        borderTop: '1px solid #efeaf8',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 -10px 30px rgba(0,0,0,0.03)'
      }}>
        <StrategySummary s={s} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onDelete} style={{ border: '1px solid #f3c9d6', background: '#fff', borderRadius: 12, padding: '11px 18px', fontSize: 14, fontWeight: 700, color: '#d6336c', cursor: 'pointer' }}>{t.csDeleteBtn}</button>
          <button onClick={onEdit} className="btn-grad" style={{ border: 'none', borderRadius: 12, padding: '11px 26px', fontSize: 14, fontWeight: 700, color: '#fff', background: 'var(--brand)', cursor: 'pointer' }}>{t.csEditBtn}</button>
        </div>
      </div>
    </div>
  );
}

const valTxt = { fontSize: 14, fontWeight: 700, color: '#211c38' } as const;

function Sec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ border: '1px solid #efeaf8', borderRadius: 13, padding: 15 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#574f6e', marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}
