import { type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon, cardStyle } from '../../ui';
import Sparkline from '../../Sparkline';
import { formatDeltaPct } from '../../../utils/format';
import { SPARK_TONES, type SparkTone } from './chartTokens';
import { C } from '../../../styles/colors';

/**
 * Thẻ số liệu của trang Doanh thu: nhãn + giá trị + badge % và một sparkline nền canh giữa mép phải.
 * DÙNG CHUNG cho 3 thẻ KPI — sparkline KPI trong trang này phải đi qua đây. Thẻ "Doanh thu dự
 * kiến" có chart lũy kế + dự kiến riêng ở `ForecastCard`. Bản thân đường sparkline do
 * `components/Sparkline` vẽ (dùng chung với thẻ số liệu Bảng điều khiển).
 *
 * Kích thước hoàn toàn theo % của card (không px cứng) nên thẻ co giãn được theo breakpoint.
 */
export default function SparklineCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  deltaPct,
  comparisonLabel,
  sparkline,
  /** Ép tone màu (thẻ doanh thu dùng 'violet'); bỏ trống = suy ra từ dấu của `deltaPct`. */
  tone,
  footer,
}: {
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  label: string;
  value: string;
  deltaPct: number | null;
  comparisonLabel: string;
  sparkline: number[];
  tone?: SparkTone;
  footer?: ReactNode;
}) {
  const up = deltaPct !== null && deltaPct > 0;
  const flat = deltaPct === null || deltaPct === 0;
  const activeTone = tone ?? (flat ? 'slate' : up ? 'emerald' : 'rose');
  const { stroke, badge } = SPARK_TONES[activeTone];

  return (
    <div className="relative overflow-hidden" style={{ ...cardStyle, padding: 20, borderRadius: 18 }}>
      {sparkline.length >= 2 && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-[45%] items-center">
          {/* Khung con 60% chiều cao: flex + items-center của lớp ngoài canh nó giữa card theo
              chiều dọc, thay vì để chart dính đáy. */}
          <div className="h-[60%] w-full">
            <Sparkline values={sparkline} stroke={stroke} />
          </div>
        </div>
      )}

      <div className="relative z-10">
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
          {icon && (
            <div style={{
              width: 38, height: 38, borderRadius: 11, background: iconBg, flex: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon icon={icon} size={19} stroke={iconColor} />
            </div>
          )}
          <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{label}</div>
        </div>

        <div style={{
          fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 25, color: C.textStrong,
          lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {value}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>
            {!flat && <span aria-hidden>{up ? '↑' : '↓'}</span>}
            {formatDeltaPct(deltaPct)}
          </span>
          <span className="text-xs font-normal text-[var(--c-legacy-text-94a3b8)]">{comparisonLabel}</span>
        </div>

        {footer}
      </div>
    </div>
  );
}
