import { useApp } from '../../context/AppContext';
import { C } from '../../styles/colors';

/** Thanh "Độ hoàn thiện" — tái dùng cho card (compact) và form/panel xem. */
export default function BrandHealthBar({ percent, compact = false }: { percent: number; compact?: boolean }) {
  const { t, brandGradient } = useApp();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: compact ? 11.5 : 12.5, fontWeight: 700, color: compact ? C.textMuted : C.ink600 }}>
          {compact ? t.bpCompleteness : t.bpAiHealth}
        </span>
        <span style={{ fontSize: compact ? 12 : 13, fontWeight: 800, color: C.primary }}>{percent}%</span>
      </div>
      <div style={{ height: compact ? 6 : 9, background: C.border, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percent}%`, background: brandGradient, borderRadius: 999, transition: 'width .3s' }} />
      </div>
    </div>
  );
}
