import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, Icon } from '../ui';
import { TONE_COLORS, type Tone } from '../../statusTokens';

/**
 * Stat card chuẩn cho mọi trang Quản trị (gộp từ các bản inline của Overview/Users/Revenue):
 * ô icon vuông bo góc + pill nhỏ góc phải (trend/tỉ lệ, tone từ statusTokens) + số lớn + nhãn.
 * `valueFontSize` hạ xuống khi giá trị dài (vd chuỗi VND ở trang Doanh thu).
 */
export default function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  pill,
  pillTone = 'success',
  valueFontSize = 26,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  value: ReactNode;
  label: string;
  pill?: string | null;
  pillTone?: Tone;
  valueFontSize?: number;
}) {
  const pillColors = TONE_COLORS[pillTone];
  return (
    <Card style={{ padding: 20, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={icon} stroke={iconColor} />
        </div>
        {pill && (
          <span style={{ fontSize: 12, fontWeight: 700, color: pillColors.color, background: pillColors.bg, padding: '3px 9px', borderRadius: 999 }}>
            {pill}
          </span>
        )}
      </div>
      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: valueFontSize, color: '#211c38', margin: '14px 0 2px' }}>{value}</div>
      <div style={{ fontSize: 13, color: '#8a85a0' }}>{label}</div>
    </Card>
  );
}
