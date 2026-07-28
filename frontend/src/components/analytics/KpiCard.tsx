import { memo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Icon, cardStyle } from '../ui';
import Sparkline from '../Sparkline';
import { formatCompactNumber, formatDeltaPct, formatGroupedNumber } from '../../utils/format';
import { STAT_TONES, type StatTone } from '../dashboard/dashboardTokens';
import type { DashboardStat } from '../../api/dashboard';

/**
 * Thẻ KPI trang Phân tích — bố cục NGANG: icon | (nhãn → số → delta) | sparkline.
 *
 * Khác `dashboard/StatCard` (bố cục dọc, sparkline chạy full chiều rộng ở đáy) ở chỗ thẻ thấp hơn
 * ~40% nên bốn thẻ + biểu đồ cùng lọt một màn hình. Cùng dữ liệu, cùng cách format, cùng tone màu
 * `STAT_TONES` — chỉ khác cách trình bày. Bảng điều khiển vẫn dùng `StatCard`; hai thẻ này sẽ gộp
 * lại ở PR sau (xem docs/PLAN.md).
 */
function KpiCard({
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
    <div style={{ ...cardStyle, padding: 16, borderRadius: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: 38, height: 38, borderRadius: 12, background: bg, flex: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon icon={icon} size={19} stroke={color} />
      </span>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#8a85a0', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </div>

        {/* Số lớn rút gọn (7K) cho gọn thẻ; số ĐẦY ĐỦ theo ngôn ngữ nằm ở title để tra cứu chính xác —
            hai cách hiển thị cùng một con số, không còn lẫn lộn định dạng giữa thẻ và bảng. */}
        <div
          title={formatGroupedNumber(stat.total, lang)}
          style={{
            fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 23, color: '#211c38',
            lineHeight: 1.15, marginTop: 2,
          }}
        >
          {formatCompactNumber(stat.total)}
        </div>

        {/* Delta + kỳ so sánh trên MỘT dòng: thẻ ngang hẹp hơn thẻ dọc cũ nên nhãn kỳ so sánh cắt
            bằng ellipsis, bản đầy đủ nằm ở tooltip — thà cắt còn hơn để thẻ cao thêm 2 dòng. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, minWidth: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, borderRadius: 999, padding: '1px 7px',
            fontSize: 11.5, fontWeight: 700, color: badge.color, background: badge.bg, flex: 'none',
          }}>
            {!flat && <span aria-hidden>{up ? '↑' : '↓'}</span>}
            {formatDeltaPct(stat.deltaPct)}
          </span>
          <span title={comparisonLabel} style={{
            fontSize: 11, color: '#a39bbf', minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {comparisonLabel}
          </span>
        </div>
      </div>

      {/* Sparkline nhỏ, căn giữa theo chiều dọc, cùng tông với metric. Kích thước cố định để bốn thẻ
          bằng nhau kể cả thẻ chưa đủ điểm vẽ đường (Sparkline trả null khi < 2 điểm). */}
      <div style={{ width: 62, height: 36, flex: 'none' }} aria-hidden>
        <Sparkline values={stat.series} stroke={stroke} />
      </div>
    </div>
  );
}

export default memo(KpiCard);
