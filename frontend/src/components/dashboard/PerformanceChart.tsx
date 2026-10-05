import { memo, useId, useMemo } from 'react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipContentProps,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui';
import { formatCompactNumber, formatGroupedNumber } from '../../utils/format';
import { AXIS_TEXT, ENGAGEMENT_LINE, GRID_LINE, REACH_LINE } from './dashboardTokens';
import DemoBadge from './DemoBadge';
import type { DashboardPoint, DashboardRange } from '../../api/dashboard';
import { C } from '../../styles/colors';

/**
 * Biểu đồ "Hiệu suất nội dung": 2 đường (lượt tiếp cận + lượt tương tác) theo ngày đăng, kèm bộ
 * lọc khoảng thời gian. Backend đã zero-fill mọi ngày trong khoảng nên đường luôn liền mạch.
 */

const RANGES: DashboardRange[] = [7, 30];

function PerformanceChart({
  points,
  range,
  onRangeChange,
  demo = false,
}: {
  points: DashboardPoint[];
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  /** true = đang hiển thị dữ liệu mẫu (chưa có số liệu thật) → gắn nhãn "Dữ liệu mẫu". */
  demo?: boolean;
}) {
  const { t, lang } = useApp();

  // useId sinh chuỗi chứa ':' — không hợp lệ trong url(#...); mỗi series 1 gradient riêng.
  const gradientId = useId().replace(/:/g, '');
  const reachGradient = `perf-reach-${gradientId}`;
  const engagementGradient = `perf-engagement-${gradientId}`;

  const data = useMemo(
    () => points.map((p) => ({ ...p, label: `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}` })),
    [points]
  );
  const hasData = useMemo(() => points.some((p) => p.reach > 0 || p.engagement > 0), [points]);
  // 30 ngày mà hiện đủ nhãn thì trục X chồng chữ — giãn ra còn ~7 mốc.
  const tickInterval = data.length > 10 ? Math.floor(data.length / 7) : 0;

  return (
    <Card>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: C.textStrong }}>{t.perfTitle}</span>
            {demo && <DemoBadge label={t.dbDemoData} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
            <LegendDot color={REACH_LINE} label={t.dbReach} />
            <LegendDot color={ENGAGEMENT_LINE} label={t.dbEngagement} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }} role="group" aria-label={t.perfTitle}>
          {RANGES.map((r) => {
            const on = range === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onRangeChange(r)}
                aria-pressed={on}
                style={{
                  fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 8, padding: '6px 12px',
                  cursor: 'pointer', transition: 'background .15s, color .15s',
                  color: on ? C.primary : C.textSecondary, background: on ? C.primarySoft : C.surfaceAlt,
                }}
              >
                {r === 7 ? t.dbRange7 : t.dbRange30}
              </button>
            );
          })}
        </div>
      </div>

      {hasData ? (
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
              {/* Cùng kỹ thuật gradient với components/Sparkline: nhạt ở trên (opacity .16) fade
                  dần xuống trong suốt ở dưới; mỗi series 1 gradient theo đúng màu đường. */}
              <defs>
                <linearGradient id={reachGradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={REACH_LINE} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={REACH_LINE} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={engagementGradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ENGAGEMENT_LINE} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={ENGAGEMENT_LINE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_LINE} vertical={false} />
              <XAxis dataKey="label" interval={tickInterval} axisLine={false} tickLine={false}
                tick={{ fontSize: 11, fill: AXIS_TEXT }} tickMargin={8} />
              <YAxis width={46} axisLine={false} tickLine={false} allowDecimals={false}
                tick={{ fontSize: 11, fill: AXIS_TEXT }} tickFormatter={formatCompactNumber} />
              {/* Dạng hàm (không phải element) để nhận đủ type của recharts 3 — payload/label
                  được đọc từ context nên element tĩnh sẽ thiếu prop bắt buộc. */}
              <Tooltip
                cursor={{ stroke: GRID_LINE, strokeWidth: 2 }}
                content={(props) => (
                  <ChartTooltip {...props} reachLabel={t.dbReach} engagementLabel={t.dbEngagement} lang={lang} />
                )}
              />
              {/* Vẽ Lượt tiếp cận (vùng lớn) TRƯỚC để nằm dưới, Lượt tương tác chồng lên trên;
                  stroke của Area giữ nguyên nét đường như bản Line cũ. */}
              <Area type="monotone" dataKey="reach" stroke={REACH_LINE} strokeWidth={2.4}
                fill={`url(#${reachGradient})`} fillOpacity={1}
                dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              <Area type="monotone" dataKey="engagement" stroke={ENGAGEMENT_LINE} strokeWidth={2.4}
                fill={`url(#${engagementGradient})`} fillOpacity={1}
                dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{
          height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '0 24px', fontSize: 13.5, lineHeight: 1.6, color: C.textMuted,
        }}>
          {t.dbPerfEmpty}
        </div>
      )}
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: C.textSecondary }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
      {label}
    </span>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  reachLabel,
  engagementLabel,
  lang,
}: TooltipContentProps & { reachLabel: string; engagementLabel: string; lang: string }) {
  if (!active || !payload?.length) return null;
  const valueOf = (key: string) => Number(payload.find((p) => p.dataKey === key)?.value ?? 0);
  const reach = valueOf('reach');
  const engagement = valueOf('engagement');
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px',
      boxShadow: `0 12px 28px -18px ${C.legacyShadowrgba8040140_6_}`, fontSize: 12.5,
    }}>
      <div style={{ fontWeight: 700, color: C.textStrong, marginBottom: 6 }}>{label}</div>
      <TooltipRow color={REACH_LINE} label={reachLabel} value={reach} lang={lang} />
      <TooltipRow color={ENGAGEMENT_LINE} label={engagementLabel} value={engagement} lang={lang} />
    </div>
  );
}

function TooltipRow({ color, label, value, lang }: { color: string; label: string; value: number; lang: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.ink550 }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <span style={{ flex: 1 }}>{label}</span>
      <strong style={{ color: C.textStrong }}>{formatGroupedNumber(value, lang)}</strong>
    </div>
  );
}

export default memo(PerformanceChart);
