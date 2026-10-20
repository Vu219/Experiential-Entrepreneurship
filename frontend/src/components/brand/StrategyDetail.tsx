import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../ui';
import { PLATFORMS } from '../../theme';
import StatusBadge from '../admin/StatusBadge';
import { statusMeta } from './StrategyCard';
import StrategySummary from './StrategySummary';
import { ReadChips } from './chips';
import type { ContentStrategy, Platform } from '../../api/contentStrategy';
import { FREQUENCY_UNIT_OPTIONS } from '../../data';
import StrategyOptimization from './StrategyOptimization';
import { C } from '../../styles/colors';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
};
const TAG_BY_ENUM: Record<Platform, string> = { FACEBOOK: 'FB', INSTAGRAM: 'IG', THREADS: 'TH' };

/** Chi tiết chiến lược (read-only) — 8 mục thuộc tính + "Tóm tắt chiến lược". */
export default function StrategyDetail({ s, onEdit, onDelete }: { s: ContentStrategy; onEdit: () => void; onDelete: () => void }) {
  const { t, lang } = useApp();
  const [isAtBottom, setIsAtBottom] = useState(false);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bottomSentinelRef.current;
    if (!el) return;

    const checkBottom = () => {
      const rect = el.getBoundingClientRect();
      const reached = (rect.top <= window.innerHeight - 20) || (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 35);
      setIsAtBottom(reached);
    };

    checkBottom();

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsAtBottom(entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: '0px 0px -20px 0px',
        threshold: 0,
      }
    );

    observer.observe(el);
    window.addEventListener('scroll', checkBottom, { passive: true });
    window.addEventListener('resize', checkBottom, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', checkBottom);
      window.removeEventListener('resize', checkBottom);
    };
  }, []);
  const meta = statusMeta(s.status, t);
  const unitLabel = FREQUENCY_UNIT_OPTIONS(lang).find((u) => u.value === (s.frequencyUnit ?? 'WEEK'))?.label ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: C.textStrong }}>{s.name}</span>
            <StatusBadge tone={meta.tone} label={meta.label} />
          </div>
          <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>{t.csCreatedAt}: {fmtDate(s.createdAt)} · {t.csUpdatedAt}: {fmtDate(s.updatedAt)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
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

      {/* FR-65..FR-68: đề xuất tối ưu từ dữ liệu + duyệt/từ chối + lịch sử */}
      <StrategyOptimization strategyId={s.id} />

      {/* Card Tóm tắt chiến lược */}
      <StrategySummary s={s} />

      {/* Sentinel để nhận biết khi người dùng cuộn đến đáy card */}
      <div ref={bottomSentinelRef} style={{ height: 1, width: '100%', pointerEvents: 'none' }} />

      {/* Thanh nút bấm — khi ở trên ôm sát các nút và nổi lên; khi cuộn xuống dưới dãn dài theo kích cỡ card */}
      <div
        style={{
          position: 'sticky',
          bottom: isAtBottom ? -22 : 18,
          zIndex: 30,
          margin: isAtBottom ? '24px -22px -22px -22px' : '18px 0 0 0',
          display: 'flex',
          justifyContent: isAtBottom ? 'stretch' : 'flex-end',
          pointerEvents: 'none',
          transition: 'bottom 0.38s cubic-bezier(0.16, 1, 0.3, 1), margin 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            width: isAtBottom ? '100%' : 'auto',
            background: C.surface,
            borderTop: `1px solid ${C.border}`,
            borderBottom: isAtBottom ? 'none' : `1px solid ${C.border}`,
            borderLeft: isAtBottom ? 'none' : `1px solid ${C.border}`,
            borderRight: isAtBottom ? 'none' : `1px solid ${C.border}`,
            borderRadius: isAtBottom ? '0 0 20px 20px' : 16,
            padding: isAtBottom ? '14px 22px' : '8px 12px',
            boxShadow: isAtBottom ? 'none' : '0 10px 30px -4px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isAtBottom ? 'space-between' : 'flex-end',
            gap: 10,
            flexWrap: 'wrap',
            transition: 'width 0.38s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.38s cubic-bezier(0.16, 1, 0.3, 1), padding 0.38s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.38s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <button onClick={onDelete} style={{ border: `1px solid ${C.legacyBorderf3c9d6}`, background: C.surface, borderRadius: 12, padding: '10px 18px', fontSize: 13.5, fontWeight: 700, color: C.legacyTextd6336c, cursor: 'pointer', marginRight: isAtBottom ? 'auto' : undefined }}>{t.csDeleteBtn}</button>
          <button onClick={onEdit} className="btn-grad" style={{ border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 13.5, fontWeight: 700, color: C.onBrand, background: 'var(--brand)', cursor: 'pointer' }}>{t.csEditBtn}</button>
        </div>
      </div>
    </div>
  );
}

const valTxt = { fontSize: 14, fontWeight: 700, color: C.textStrong } as const;

function Sec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 13, padding: 15 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink600, marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}
