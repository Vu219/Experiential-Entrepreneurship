import type { ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../ui';
import { PLATFORMS } from '../../theme';
import StatusBadge from '../admin/StatusBadge';
import { statusMeta } from './StrategyCard';
import StrategySummary from './StrategySummary';
import { ReadChips } from './chips';
import type { ContentStrategy, Platform } from '../../api/contentStrategy';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
};
const TAG_BY_ENUM: Record<Platform, string> = { FACEBOOK: 'FB', INSTAGRAM: 'IG', THREADS: 'TH' };

/** Chi tiết chiến lược (read-only) — 8 mục 01–08 + "Tóm tắt chiến lược". */
export default function StrategyDetail({ s, onEdit, onDelete }: { s: ContentStrategy; onEdit: () => void; onDelete: () => void }) {
  const { t } = useApp();
  const meta = statusMeta(s.status, t);

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onDelete} style={{ border: '1px solid #f3c9d6', background: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}>{t.csDeleteBtn}</button>
          <button onClick={onEdit} style={{ border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--brand)', cursor: 'pointer' }}>{t.csEditBtn}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <Sec n="01" label={t.csGoal}><ReadChips items={s.goals} /></Sec>
        <Sec n="02" label={t.csTypes}><ReadChips items={s.contentTypes} /></Sec>
        <Sec n="03" label={t.csFreq}><span style={valTxt}>{s.postsPerWeek} {t.csPostsPerWeek}</span></Sec>
        <Sec n="04" label={t.csPlatforms}>
          <div style={{ display: 'flex', gap: 7 }}>
            {s.platforms.map((p) => { const pl = PLATFORMS.find((x) => x.tag === TAG_BY_ENUM[p]); return pl ? <PlatformTag key={p} tag={pl.tag} bg={pl.bg} size={26} radius={7} /> : null; })}
          </div>
        </Sec>
        <Sec n="05" label={t.csTimes}><ReadChips items={s.timeSlots} /></Sec>
        <Sec n="06" label={t.csAudience}><ReadChips items={s.audiences} /></Sec>
        <Sec n="07" label={t.csStyle}><ReadChips items={s.styles} /></Sec>
        <Sec n="08" label={t.csCta}><ReadChips items={s.ctas} /></Sec>
      </div>

      <StrategySummary s={s} />
    </div>
  );
}

const valTxt = { fontSize: 14, fontWeight: 700, color: '#211c38' } as const;

function Sec({ n, label, children }: { n: string; label: string; children: ReactNode }) {
  return (
    <div style={{ border: '1px solid #efeaf8', borderRadius: 13, padding: 15 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', fontFamily: "'Plus Jakarta Sans'" }}>{n}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#574f6e' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}
