import { memo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { useApp } from '../../../context/AppContext';
import { formatVND } from '../../../api/admin';
import { formatCompactVND } from '../../../utils/format';
import type { RevenuePoint } from '../../../api/revenue';
import { AXIS_TEXT, BAR_GRADIENT_FROM, BAR_GRADIENT_TO, BAR_NEGATIVE, GRID_LINE } from './chartTokens';

const GRADIENT_ID = 'aima-revenue-bar';

/** Tooltip: nhãn kỳ + doanh thu VNĐ + số giao dịch (yêu cầu mục D). */
function ChartTooltip({ active, payload }: TooltipContentProps) {
  const { t } = useApp();
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as RevenuePoint;

  return (
    <div style={{
      background: '#fff', border: '1px solid #ece8f6', borderRadius: 12, padding: '10px 12px',
      boxShadow: '0 18px 38px -20px rgba(80,40,140,.5)', minWidth: 150,
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#211c38', marginBottom: 6 }}>{point.label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>{formatVND(point.revenue)}</div>
      <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 3 }}>
        {point.transactions} {t.revTxnUnit}
      </div>
      {point.refunded > 0 && (
        <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 3 }}>
          − {formatVND(point.refunded)} {t.revRefundedShort}
        </div>
      )}
    </div>
  );
}

/**
 * Chart cột "Doanh thu theo thời gian". Cột doanh thu ÂM (hoàn tiền kỳ trước rơi vào bucket
 * này) tô đỏ thay vì gradient — nếu tô cùng màu thì nhìn hệt cột dương, dễ đọc sai.
 */
function RevenueChart({ points }: { points: RevenuePoint[] }) {
  // Nhãn trục X dày quá thì giãn ra để chữ không chồng nhau (tháng 31 ngày, khoảng tuỳ chỉnh dài).
  const tickInterval = points.length > 20 ? Math.floor(points.length / 12) : 0;

  // Chiều cao do div bọc bên ngoài quyết định (responsive theo breakpoint), không cố định ở đây.
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={points} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BAR_GRADIENT_FROM} />
            <stop offset="100%" stopColor={BAR_GRADIENT_TO} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={GRID_LINE} />
        <XAxis dataKey="label" interval={tickInterval} tickLine={false} axisLine={false}
          tick={{ fontSize: 11, fill: AXIS_TEXT }} />
        <YAxis tickFormatter={formatCompactVND} tickLine={false} axisLine={false} width={52}
          tick={{ fontSize: 11, fill: AXIS_TEXT }} />
        {/* Render qua arrow function (không truyền <ChartTooltip/> trực tiếp): recharts gọi
            `content` như một hàm thường, nếu không bọc thành element thì hook useApp bên trong
            tooltip sẽ chạy ngoài cây React. */}
        <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ fill: 'rgba(139,92,246,.06)' }} />
        <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={46}>
          {points.map((p) => (
            <Cell key={p.bucket} fill={p.revenue < 0 ? BAR_NEGATIVE : `url(#${GRADIENT_ID})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default memo(RevenueChart);
