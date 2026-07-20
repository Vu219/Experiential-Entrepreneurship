import { useId, useMemo, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { Icon, cardStyle } from '../../ui';
import { formatDeltaPct } from '../../../utils/format';
import { SPARK_TONES, type SparkTone } from './chartTokens';

/**
 * Thẻ số liệu của trang Doanh thu: nhãn + giá trị + badge % và một sparkline nền canh giữa mép phải.
 * DÙNG CHUNG cho cả 3 thẻ KPI lẫn thẻ "Doanh thu dự kiến" — mọi chỗ cần sparkline trong trang
 * này phải đi qua đây, đừng dựng lại chart ở component khác.
 *
 * Kích thước hoàn toàn theo % của card (không px cứng) nên thẻ co giãn được theo breakpoint.
 */

/** Trên ~16 điểm thì khung sparkline quá hẹp, đường thành răng cưa → gộp trung bình theo nhóm. */
const MAX_POINTS = 16;

function downsample(values: number[]): number[] {
  if (values.length <= MAX_POINTS) return values;
  const groupSize = Math.ceil(values.length / MAX_POINTS);
  const out: number[] = [];
  for (let i = 0; i < values.length; i += groupSize) {
    const group = values.slice(i, i + groupSize);
    out.push(group.reduce((sum, v) => sum + v, 0) / group.length);
  }
  return out;
}

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
  // useId sinh chuỗi chứa dấu ':' — không hợp lệ trong url(#...) nên phải bỏ đi.
  // Mỗi card một id riêng, nếu trùng thì mọi card sẽ ăn chung gradient của card render đầu tiên.
  const gradientId = `spark-${useId().replace(/:/g, '')}`;

  const data = useMemo(() => downsample(sparkline).map((v) => ({ v })), [sparkline]);

  const up = deltaPct !== null && deltaPct > 0;
  const flat = deltaPct === null || deltaPct === 0;
  const activeTone = tone ?? (flat ? 'slate' : up ? 'emerald' : 'rose');
  const { stroke, badge } = SPARK_TONES[activeTone];

  return (
    <div className="relative overflow-hidden" style={{ ...cardStyle, padding: 20, borderRadius: 18 }}>
      {data.length >= 2 && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-[45%] items-center">
          {/* Khung con 60% chiều cao: flex + items-center của lớp ngoài canh nó giữa card theo
              chiều dọc, thay vì để chart dính đáy. */}
          <div className="h-[60%] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {/* margin trên/dưới 2px để stroke 2px không bị cắt ở đỉnh/đáy chart. */}
              <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={2}
                  fill={`url(#${gradientId})`} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
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
          <div style={{ fontSize: 13, color: '#8a85a0', fontWeight: 600 }}>{label}</div>
        </div>

        <div style={{
          fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 25, color: '#211c38',
          lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {value}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>
            {!flat && <span aria-hidden>{up ? '↑' : '↓'}</span>}
            {formatDeltaPct(deltaPct)}
          </span>
          <span className="text-xs font-normal text-slate-400">{comparisonLabel}</span>
        </div>

        {footer}
      </div>
    </div>
  );
}
