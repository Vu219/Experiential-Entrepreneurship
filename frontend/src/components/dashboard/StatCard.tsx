import { memo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Icon, cardStyle } from '../ui';
import Sparkline from '../Sparkline';
import { formatCompactNumber, formatDeltaPct, formatGroupedNumber } from '../../utils/format';
import { STAT_TONES, type StatTone } from './dashboardTokens';
import type { DashboardStat } from '../../api/dashboard';

/**
 * Một thẻ trong hàng 4 thẻ thống kê: số tích lũy + % thay đổi 7 ngày + sparkline 7 ngày.
 *
 * Khác `admin/revenue/SparklineCard` (sparkline nền mờ chạy dọc mép phải): ở đây sparkline nằm
 * hẳn dưới đáy thẻ để 4 thẻ đứng cạnh nhau vẫn đọc được số. Đường vẽ dùng chung `components/Sparkline`.
 */
function StatCard({
  icon,
  label,
  tone,
  stat,
  comparisonLabel,
}: {
  icon: LucideIcon;
  label: string;
  tone: StatTone;
  stat: DashboardStat;
  comparisonLabel: string;
}) {
  const { lang } = useApp();
  const { bg, color, stroke } = STAT_TONES[tone];
  const up = stat.deltaPct !== null && stat.deltaPct > 0;
  const flat = stat.deltaPct === null || stat.deltaPct === 0;
  // Badge đổi màu theo CHIỀU thay đổi, không theo tone của thẻ — tăng là xanh, giảm là đỏ.
  const badge = flat
    ? { color: '#64748b', bg: '#f1f5f9' }
    : up
      ? { color: '#16a34a', bg: '#eafbf1' }
      : { color: '#e23d6e', bg: '#fdecf1' };

  return (
    <div style={{ ...cardStyle, padding: 20, borderRadius: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{
          width: 38, height: 38, borderRadius: 11, background: bg, flex: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon icon={icon} size={19} stroke={color} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#8a85a0' }}>{label}</span>
      </div>

      {/* Số lớn rút gọn (7K) cho gọn thẻ; số ĐẦY ĐỦ theo ngôn ngữ nằm ở title để tra cứu chính xác —
          hai cách hiển thị cùng một con số, không còn lẫn lộn định dạng giữa thẻ và bảng. */}
      <div
        title={formatGroupedNumber(stat.total, lang)}
        style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 28, color: '#211c38', lineHeight: 1.1 }}
      >
        {formatCompactNumber(stat.total)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3, borderRadius: 999, padding: '2px 9px',
          fontSize: 12, fontWeight: 700, color: badge.color, background: badge.bg,
        }}>
          {!flat && <span aria-hidden>{up ? '↑' : '↓'}</span>}
          {formatDeltaPct(stat.deltaPct)}
        </span>
        <span style={{ fontSize: 11.5, color: '#a39bbf' }}>{comparisonLabel}</span>
      </div>

      {/* Chiều cao cố định để 4 thẻ luôn bằng nhau, kể cả thẻ chưa đủ dữ liệu vẽ đường.
          Chừa 8px dưới đáy — trước đây margin âm kéo đường dính sát mép card. */}
      <div style={{ height: 42, margin: '-2px -4px 0', paddingBottom: 8 }} aria-hidden>
        <Sparkline values={stat.series} stroke={stroke} />
      </div>
    </div>
  );
}

export default memo(StatCard);
