import { useApp } from '../../context/AppContext';

/** Thanh "Độ hoàn thiện" — tái dùng cho card (compact) và form/panel xem. */
export default function BrandHealthBar({ percent, compact = false }: { percent: number; compact?: boolean }) {
  const { t, brandGradient } = useApp();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: compact ? 11.5 : 12.5, fontWeight: 700, color: compact ? '#8a85a0' : '#574f6e' }}>
          {compact ? t.bpCompleteness : t.bpAiHealth}
        </span>
        <span style={{ fontSize: compact ? 12 : 13, fontWeight: 800, color: '#7c3aed' }}>{percent}%</span>
      </div>
      <div style={{ height: compact ? 6 : 9, background: '#eee9f6', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percent}%`, background: brandGradient, borderRadius: 999, transition: 'width .3s' }} />
      </div>
    </div>
  );
}
