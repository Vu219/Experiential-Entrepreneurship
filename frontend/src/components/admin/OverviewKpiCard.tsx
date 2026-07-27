import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, Icon } from '../ui';
import Sparkline from '../Sparkline';
import { TONE_COLORS } from '../../statusTokens';
import { SPARK_TONES } from './revenue/chartTokens';

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
}) {
  const up = deltaPct !== null && deltaPct >= 0;
  const deltaTone = deltaPct === null ? TONE_COLORS.neutral : up ? TONE_COLORS.success : TONE_COLORS.danger;
  const sparkTone = deltaPct === null ? SPARK_TONES.slate : up ? SPARK_TONES.emerald : SPARK_TONES.rose;

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
          {deltaPct === null ? (
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

        {/* Sparkline là hình trang trí bổ trợ cho con số đã đọc được ở trên → ẩn với trình đọc màn hình. */}
        {series.length > 1 && (
          <div aria-hidden="true" style={{ width: 68, height: 30, flex: 'none' }}>
            <Sparkline values={series} stroke={sparkTone.stroke} />
          </div>
        )}
      </div>
    </Card>
  );
}
