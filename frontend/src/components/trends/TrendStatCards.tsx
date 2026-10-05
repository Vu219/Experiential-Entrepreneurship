import { memo } from 'react';
import { Card, Icon } from '../ui';
import { STATUS_COLORS } from '../../statusTokens';
import type { TrendStat } from '../../trendsData';
import { C } from '../../styles/colors';

/** 4 thẻ thống kê đầu trang Nghiên cứu xu hướng (memo — stats được page memo hóa). */
export default memo(function TrendStatCards({ stats }: { stats: TrendStat[] }) {
  return (
    <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
      {stats.map((s, i) => (
        <Card key={i} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon icon={s.icon} size={19} stroke={s.iconColor} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink550, lineHeight: 1.3 }}>{s.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: s.badge ? 16 : 26, color: C.textStrong, lineHeight: 1.2 }}>{s.value}</div>
            {s.delta && (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: s.deltaColor }}>
                {s.delta} <span style={{ fontWeight: 500, color: C.textMuted }}>{s.deltaLabel}</span>
              </span>
            )}
            {s.badge && (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: STATUS_COLORS.active.color, background: STATUS_COLORS.active.bg, borderRadius: 999, padding: '3px 10px' }}>{s.badge}</span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
});
