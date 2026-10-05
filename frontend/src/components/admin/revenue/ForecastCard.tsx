import { memo, useId, useMemo } from 'react';
import {
  Area, AreaChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { useApp } from '../../../context/AppContext';
import { cardStyle } from '../../ui';
import { formatVND } from '../../../api/admin';
import { formatCompactVND, formatDeltaPct } from '../../../utils/format';
import type { RevenueForecast } from '../../../api/revenue';
import { AREA_STROKE, AXIS_TEXT, PROJECTION_STROKE, SPARK_TONES } from './chartTokens';
import { C } from '../../../styles/colors';

interface Row {
  day: number;
  /** Lũy kế thực thu tới ngày này; null = ngày chưa tới. */
  actual: number | null;
  /** Đường dự kiến tuyến tính từ hôm nay tới cuối tháng; null = trước hôm nay. */
  projected: number | null;
  daily: number | null;
}

/**
 * Dựng chuỗi LŨY KẾ của tháng: thực thu tới hôm nay (đường liền) + dự kiến tăng đều tới đúng
 * `projected` của backend (nét đứt, nối từ điểm hôm nay). Lũy kế luôn đi lên nên mượt, khác chuỗi
 * theo ngày (đa số ngày = 0 → răng cưa).
 */
function buildRows(fc: RevenueForecast): Row[] {
  const perDay = fc.daysElapsed > 0 ? fc.actualSoFar / fc.daysElapsed : 0;
  let running = 0;
  return Array.from({ length: fc.daysInMonth }, (_, i) => {
    const day = i + 1;
    const past = day <= fc.daysElapsed;
    if (past) running += fc.sparkline[i] ?? 0;
    let projected: number | null = null;
    if (day === fc.daysElapsed) projected = running;
    else if (day > fc.daysElapsed) {
      projected = day === fc.daysInMonth ? fc.projected : Math.round(fc.actualSoFar + perDay * (day - fc.daysElapsed));
    }
    return { day, actual: past ? running : null, projected, daily: past ? fc.sparkline[i] ?? 0 : null };
  });
}

function ForecastTooltip({ active, payload }: TooltipContentProps) {
  const { t } = useApp();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px',
      boxShadow: `0 14px 30px -18px ${C.legacyShadowrgba8040140_5_}`, minWidth: 130,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.textStrong, marginBottom: 4 }}>
        {t.revForecastDay.replace('{d}', String(row.day))}
      </div>
      {row.actual !== null ? (
        <>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.primary }}>{t.revChartCumulative}: {formatVND(row.actual)}</div>
          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>{t.revChartInBucket}: {formatVND(row.daily ?? 0)}</div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: PROJECTION_STROKE }}>
          {t.revChartProjected} ≈ {formatVND(row.projected ?? 0)}
        </div>
      )}
    </div>
  );
}

/** Thẻ "Doanh thu dự kiến tháng này" (panel phải trang Doanh thu & Đơn hàng). */
function ForecastCard({ forecast }: { forecast: RevenueForecast }) {
  const { t } = useApp();
  const gradientId = `fc-${useId().replace(/:/g, '')}`;
  const rows = useMemo(() => buildRows(forecast), [forecast]);

  const up = forecast.deltaPct !== null && forecast.deltaPct > 0;
  const flat = forecast.deltaPct === null || forecast.deltaPct === 0;
  const { badge } = SPARK_TONES[flat ? 'slate' : up ? 'emerald' : 'rose'];
  const top = Math.max(forecast.projected, forecast.previousMonth, forecast.actualSoFar, 1);
  const daysLeft = forecast.daysInMonth - forecast.daysElapsed;
  const elapsedPct = (forecast.daysElapsed / forecast.daysInMonth) * 100;

  return (
    <div style={{ ...cardStyle, padding: 20, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{t.revForecast}</div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>
          {!flat && <span aria-hidden>{up ? '↑' : '↓'}</span>}
          {formatDeltaPct(forecast.deltaPct)}
        </span>
      </div>
      <div style={{
        fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 25, color: C.textStrong, lineHeight: 1.15, marginTop: 8,
      }}>
        {formatVND(forecast.projected)}
      </div>
      <div style={{ fontSize: 12, color: C.textFaint, marginTop: 4 }}>
        {t.revVsPrevMonth} · {formatVND(forecast.previousMonth)}
      </div>

      {/* Chart lũy kế: liền = đã thu, nét đứt = dự kiến; vạch ngang = tổng tháng trước. */}
      <div style={{ height: 120, margin: '14px -4px 0' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={AREA_STROKE} stopOpacity={0.3} />
                <stop offset="100%" stopColor={AREA_STROKE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={[0, top * 1.08]} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} interval={0} height={18}
              tick={{ fontSize: 10.5, fill: AXIS_TEXT }}
              ticks={[1, Math.ceil(forecast.daysInMonth / 2), forecast.daysInMonth]} />
            {forecast.previousMonth > 0 && (
              <ReferenceLine y={forecast.previousMonth} stroke={C.borderStrong} strokeDasharray="3 4"
                label={{
                  value: `${t.revForecastPrevMonth} ${formatCompactVND(forecast.previousMonth)}`,
                  position: 'insideTopRight', fontSize: 10.5, fill: AXIS_TEXT,
                }} />
            )}
            <Tooltip content={(props) => <ForecastTooltip {...props} />} cursor={{ stroke: C.legacyTextddd6fe, strokeWidth: 1.5 }} />
            <Area type="monotone" dataKey="actual" stroke={AREA_STROKE} strokeWidth={2.4}
              fill={`url(#${gradientId})`} connectNulls={false} dot={false}
              activeDot={{ r: 4 }} isAnimationActive={false} />
            <Area type="linear" dataKey="projected" stroke={PROJECTION_STROKE} strokeWidth={2}
              strokeDasharray="5 4" fill="none" connectNulls={false} dot={false}
              activeDot={{ r: 3.5, fill: PROJECTION_STROKE }} isAnimationActive={false} />
            <ReferenceDot x={forecast.daysElapsed} y={forecast.actualSoFar} r={4.5}
              fill="#fff" stroke={AREA_STROKE} strokeWidth={2.4} />
            <ReferenceDot x={forecast.daysInMonth} y={forecast.projected} r={3.5}
              fill={PROJECTION_STROKE} stroke="#fff" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Tiến độ tháng: đã thu + số ngày còn lại. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 12, fontSize: 12 }}>
        <span style={{ color: C.textMuted }}>
          {t.revForecastCollected} <strong style={{ color: C.text }}>{formatVND(forecast.actualSoFar)}</strong>
        </span>
        <span style={{ color: C.textMuted, whiteSpace: 'nowrap' }}>
          {t.revForecastDaysLeft.replace('{n}', String(daysLeft))}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: C.surfaceMuted, overflow: 'hidden', marginTop: 6 }}>
        <div style={{ width: `${elapsedPct}%`, height: '100%', borderRadius: 999, background: AREA_STROKE }} />
      </div>

      <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 10, lineHeight: 1.5 }}>
        {t.revForecastNote
          .replace('{actual}', formatVND(forecast.actualSoFar))
          .replace('{elapsed}', String(forecast.daysElapsed))
          .replace('{total}', String(forecast.daysInMonth))}
      </div>
    </div>
  );
}

export default memo(ForecastCard);
