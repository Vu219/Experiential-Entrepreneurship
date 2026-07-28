import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, Icon } from '../ui';
import Sparkline from '../Sparkline';
import { TONE_COLORS, type Tone } from '../../statusTokens';
import { SPARK_TONES, type SparkTone } from './revenue/chartTokens';

/** Tone ngữ nghĩa → tone nét sparkline, để chữ và đường luôn cùng màu. */
const SPARK_BY_TONE: Partial<Record<Tone, SparkTone>> = {
  success: 'emerald',
  danger: 'rose',
  neutral: 'slate',
};

/** Sparkline chỉ có nghĩa khi đủ điểm VÀ có ít nhất một điểm khác 0 — đường phẳng ở đáy
 *  hoặc 2 điểm nối thành một gai nhọn đều là hình vẽ đánh lừa, thà không vẽ. */
const isMeaningfulSeries = (series: number[], minPoints: number) =>
  series.length >= minPoints && series.some((v) => v !== 0);

/**
 * Thẻ KPI của trang Tổng quan quản trị. Khác `StatCard` dùng chung ở chỗ: icon nằm CÙNG HÀNG với
 * nhãn (không có pill % ở góc phải), và dòng cuối là "% thay đổi + mốc so sánh" đặt cạnh một
 * sparkline nhỏ bên phải.
 *
 * Màu lấy hết từ token: TONE_COLORS cho chữ tăng/giảm, SPARK_TONES cho nét sparkline — cùng tone
 * để đường và con số không bao giờ lệch màu nhau.
 */
export default function OverviewKpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  deltaPct,
  comparisonLabel,
  series,
  emptyDeltaLabel,
  higherIsBetter = true,
  deltaOverride,
  hideEmptySparkline = false,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: ReactNode;
  /** null = không có mốc so sánh (kỳ trước bằng 0, hoặc chỉ số không có lịch sử). */
  deltaPct: number | null;
  comparisonLabel: string;
  series: number[];
  /** Chữ thay cho "% so với…" khi deltaPct null, vd "chưa có mốc so sánh". */
  emptyDeltaLabel: string;
  /**
   * false cho các chỉ số mà TĂNG là XẤU (số bài lỗi, số người dùng bị ảnh hưởng…): mũi tên lên
   * tô đỏ, xuống tô xanh. Mặc định true để các thẻ đang dùng giữ nguyên màu.
   */
  higherIsBetter?: boolean;
  /**
   * Thay ô "%" bằng một nhãn cố định khi phép chia không có nghĩa: kỳ trước bằng 0 thì
   * "+∞%"/"-100%" đều sai. Truyền vào nhãn + tone, thẻ tự dùng tone đó cho cả sparkline.
   */
  deltaOverride?: { label: string; tone: Tone };
  /**
   * true → ẩn hẳn sparkline khi chuỗi không đủ 3 điểm hoặc toàn 0 (vẫn giữ chỗ nên thẻ
   * không lệch chiều cao). Mặc định false để các thẻ đang dùng giữ nguyên hành vi cũ.
   */
  hideEmptySparkline?: boolean;
}) {
  const up = deltaPct !== null && deltaPct >= 0;
  const good = up === higherIsBetter;
  const overrideTone = deltaOverride ? TONE_COLORS[deltaOverride.tone] : null;
  const deltaTone = overrideTone
    ?? (deltaPct === null ? TONE_COLORS.neutral : good ? TONE_COLORS.success : TONE_COLORS.danger);
  const sparkTone = deltaOverride
    ? SPARK_TONES[SPARK_BY_TONE[deltaOverride.tone] ?? 'slate']
    : deltaPct === null ? SPARK_TONES.slate : good ? SPARK_TONES.emerald : SPARK_TONES.rose;
  const showSparkline = hideEmptySparkline ? isMeaningfulSeries(series, 3) : series.length > 1;

  return (
    <Card style={{ padding: 20, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={icon} size={19} stroke={iconColor} />
        </div>
        <div style={{ fontSize: 13, color: '#8a85a0', fontWeight: 600 }}>{label}</div>
      </div>

      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 26, color: '#211c38', margin: '14px 0 0' }}>
        {value}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
        <div style={{ fontSize: 12, lineHeight: 1.45, minWidth: 0 }}>
          {deltaOverride ? (
            <>
              <span style={{ color: deltaTone.color, fontWeight: 700 }}>{deltaOverride.label}</span>{' '}
              <span style={{ color: '#a59fbb' }}>{comparisonLabel}</span>
            </>
          ) : deltaPct === null ? (
            <span style={{ color: '#a59fbb' }}>{emptyDeltaLabel}</span>
          ) : (
            <>
              <span style={{ color: deltaTone.color, fontWeight: 700 }}>
                {up ? '+' : ''}{deltaPct}%
              </span>{' '}
              <span style={{ color: '#a59fbb' }}>{comparisonLabel}</span>
            </>
          )}
        </div>

        {/* Sparkline là hình trang trí bổ trợ cho con số đã đọc được ở trên → ẩn với trình đọc màn hình.
            Khi không vẽ vẫn giữ đúng chỗ để 4 thẻ trong hàng không cao thấp lệch nhau. */}
        <div aria-hidden="true" style={{ width: 68, height: 30, flex: 'none' }}>
          {showSparkline && <Sparkline values={series} stroke={sparkTone.stroke} />}
        </div>
      </div>
    </Card>
  );
}
