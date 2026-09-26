import { memo, useMemo } from 'react';
import {
  Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { useApp } from '../../../context/AppContext';
import { formatVND } from '../../../api/admin';
import { formatCompactVND } from '../../../utils/format';
import type { RevenueForecast, RevenuePoint } from '../../../api/revenue';
import {
  AREA_STROKE, AXIS_TEXT, REVENUE_NEGATIVE, FUTURE_FILL, GRID_LINE, PROJECTION_STROKE,
} from './chartTokens';

const GRADIENT_ID = 'aima-revenue-area';

export type RevenueChartMode = 'daily' | 'cumulative';

interface ChartRow extends RevenuePoint {
  /** Giá trị vẽ đường thực thu (theo ngày hoặc lũy kế); null = ngày chưa tới. */
  actual: number | null;
  /** Đường dự kiến nét đứt; chỉ có từ hôm nay tới cuối tháng. */
  projected: number | null;
  /** Doanh thu lũy kế tới bucket này (tooltip chế độ lũy kế). */
  running: number;
  future: boolean;
}

/** Bước "đẹp" 1/2/2.5/5 × 10^k để trục Y chia theo dữ liệu thật thay vì nấc tự động. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * pow;
}

function yTicks(min: number, max: number): number[] {
  const lo = Math.min(0, min);
  const hi = Math.max(max, 1);
  const step = niceStep((hi - lo) / 4);
  const ticks: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step; v += step) ticks.push(v);
  return ticks;
}

/**
 * Dựng dữ liệu vẽ. Có `forecast` (chỉ truyền khi đang xem THEO NGÀY của đúng tháng hiện tại) thì
 * các ngày sau hôm nay không vẽ đường thực thu mà vẽ đường dự kiến tuyến tính, nối từ điểm hôm
 * nay: theo ngày = mức TB/ngày đã thu, lũy kế = tăng đều tới đúng số `projected` của backend.
 */
function buildRows(points: RevenuePoint[], mode: RevenueChartMode, forecast?: RevenueForecast | null): ChartRow[] {
  const elapsed = forecast?.daysElapsed ?? points.length;
  const avgPerDay = forecast && forecast.daysElapsed > 0 ? forecast.actualSoFar / forecast.daysElapsed : 0;
  let running = 0;

  return points.map((p, i) => {
    const day = i + 1;
    const future = !!forecast && day > elapsed;
    if (!future) running += p.revenue;
    const actual = future ? null : mode === 'cumulative' ? running : p.revenue;

    let projected: number | null = null;
    if (forecast && day >= elapsed) {
      if (day === elapsed) projected = actual;
      else if (mode === 'cumulative') {
        projected = day === points.length
          ? forecast.projected
          : Math.round(forecast.actualSoFar + avgPerDay * (day - elapsed));
      } else projected = Math.round(avgPerDay);
    }
    return { ...p, actual, projected, running, future };
  });
}

function ChartTooltip({ active, payload, mode }: TooltipContentProps & { mode: RevenueChartMode }) {
  const { t } = useApp();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ChartRow;

  return (
    <div style={{
      background: '#fff', border: '1px solid #ece8f6', borderRadius: 12, padding: '10px 12px',
      boxShadow: '0 18px 38px -20px rgba(80,40,140,.5)', minWidth: 150,
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#211c38', marginBottom: 6 }}>{row.label}</div>
      {row.future ? (
        <div style={{ fontSize: 13, fontWeight: 700, color: PROJECTION_STROKE }}>
          {t.revChartProjected} ≈ {formatVND(row.projected ?? 0)}
        </div>
      ) : (
        <>
          {mode === 'cumulative' && (
            <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>
              {t.revChartCumulative}: {formatVND(row.running)}
            </div>
          )}
          <div style={{
            fontSize: mode === 'cumulative' ? 12 : 13, fontWeight: mode === 'cumulative' ? 600 : 700,
            color: mode === 'cumulative' ? '#5b5670' : row.revenue < 0 ? REVENUE_NEGATIVE : '#7c3aed',
            marginTop: mode === 'cumulative' ? 3 : 0,
          }}>
            {mode === 'cumulative' && `${t.revChartInBucket}: `}{formatVND(row.revenue)}
          </div>
          <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 3 }}>
            {row.transactions} {t.revTxnUnit}
          </div>
          {row.refunded > 0 && (
            <div style={{ fontSize: 11.5, color: REVENUE_NEGATIVE, marginTop: 3 }}>
              − {formatVND(row.refunded)} {t.revRefundedShort}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Area chart "Doanh thu theo thời gian". Chế độ theo ngày: đường doanh thu net từng bucket (có thể
 * âm khi hoàn tiền kỳ trước rơi vào — chấm đỏ + vạch 0). Chế độ lũy kế: cộng dồn trong kỳ.
 * Xem tháng hiện tại thì phần ngày chưa tới tô nền nhạt + đường dự kiến nét đứt.
 */
function RevenueChart({ points, mode, forecast }: {
  points: RevenuePoint[];
  mode: RevenueChartMode;
  /** Chỉ truyền khi chuỗi đang vẽ là các ngày của tháng hiện tại. */
  forecast?: RevenueForecast | null;
}) {
  const rows = useMemo(() => buildRows(points, mode, forecast), [points, mode, forecast]);

  const ticks = useMemo(() => {
    const values = rows.flatMap((r) => [r.actual ?? 0, r.projected ?? 0]);
    return yTicks(Math.min(...values), Math.max(...values));
  }, [rows]);

  const firstFuture = rows.find((r) => r.future);
  const hasNegative = ticks[0] < 0;
  // Nhãn trục X dày quá thì giãn ra để chữ không chồng nhau (tháng 31 ngày, khoảng tuỳ chỉnh dài).
  const tickInterval = rows.length > 20 ? Math.floor(rows.length / 12) : 0;

  // Chấm chỉ ở bucket có phát sinh, để đường dài toàn số 0 không thành một vệt chấm.
  const renderDot = (props: { cx?: number; cy?: number; index?: number; payload?: ChartRow }) => {
    const { cx, cy, index, payload } = props;
    if (cx === undefined || cy === undefined || !payload || payload.future || payload.revenue === 0) {
      return <g key={`dot-${index}`} />;
    }
    const color = payload.revenue < 0 ? REVENUE_NEGATIVE : AREA_STROKE;
    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3.5} fill="#fff" stroke={color} strokeWidth={2} />;
  };

  // Chiều cao do div bọc bên ngoài quyết định (responsive theo breakpoint), không cố định ở đây.
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={AREA_STROKE} stopOpacity={0.28} />
            <stop offset="100%" stopColor={AREA_STROKE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={GRID_LINE} />
        {firstFuture && (
          <ReferenceArea x1={firstFuture.label} x2={rows[rows.length - 1].label}
            fill={FUTURE_FILL} fillOpacity={1} strokeOpacity={0} ifOverflow="extendDomain" />
        )}
        <XAxis dataKey="label" interval={tickInterval} tickLine={false} axisLine={false}
          tick={{ fontSize: 11, fill: AXIS_TEXT }} />
        <YAxis tickFormatter={formatCompactVND} tickLine={false} axisLine={false} width={52}
          ticks={ticks} domain={[ticks[0], ticks[ticks.length - 1]]} interval={0}
          tick={{ fontSize: 11, fill: AXIS_TEXT }} />
        {hasNegative && <ReferenceLine y={0} stroke="#d9d3ea" />}
        {/* Render qua arrow function (không truyền <ChartTooltip/> trực tiếp): recharts gọi
            `content` như một hàm thường, nếu không bọc thành element thì hook useApp bên trong
            tooltip sẽ chạy ngoài cây React. */}
        <Tooltip content={(props) => <ChartTooltip {...props} mode={mode} />}
          cursor={{ stroke: '#ddd6fe', strokeWidth: 1.5 }} />
        <Area type="monotone" dataKey="actual" stroke={AREA_STROKE} strokeWidth={2.4}
          fill={`url(#${GRADIENT_ID})`} fillOpacity={1} connectNulls={false}
          dot={renderDot} activeDot={{ r: 4.5 }} isAnimationActive={false} />
        {forecast && (
          <Area type="monotone" dataKey="projected" stroke={PROJECTION_STROKE} strokeWidth={2}
            strokeDasharray="5 4" fill="none" connectNulls={false} dot={false}
            activeDot={{ r: 4, fill: PROJECTION_STROKE }} isAnimationActive={false} />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default memo(RevenueChart);
