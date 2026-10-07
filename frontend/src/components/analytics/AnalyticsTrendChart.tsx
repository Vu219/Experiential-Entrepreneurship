import { memo, useId, useMemo, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipContentProps,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui';
import { formatCompactNumber, formatGroupedNumber } from '../../utils/format';
import RangeBadge from './RangeBadge';
import { AXIS_TEXT, GRID_LINE, METRIC_COLOR, METRIC_ORDER, type MetricKey } from './analyticsTokens';
import type { AnalyticsPoint } from '../../api/analytics';
import { C } from '../../styles/colors';

/**
 * Khối C — "Bài đã đăng & số liệu tổng quan": biểu đồ vùng đa series (Lượt xem / Lượt thích /
 * Bình luận / Chia sẻ) theo ngày. Backend đã zero-fill nên các đường liền mạch; trục X tự co giãn
 * theo range (giãn nhãn khi > 10 điểm). Legend ngang ở góc trên trái, bấm để bật/tắt từng series;
 * badge khoảng ngày ở góc trên phải; tooltip gộp mọi series đang hiển thị. Cùng kỹ thuật gradient +
 * tooltip-dạng-hàm với `dashboard/PerformanceChart`.
 *
 * Ngày có số ƯỚC TÍNH (`point.estimated` — bài được theo dõi muộn, phần tăng tới lần đồng bộ đầu được chia đều từ ngày đăng):
 * điểm rỗng viền đứt (điểm thật tô đặc), tooltip ghi "Ước tính…", và một dòng chú thích dưới biểu đồ khi kỳ có ngày ước tính.
 */
function AnalyticsTrendChart({ points, from, to }: { points: AnalyticsPoint[]; from: string; to: string }) {
  const { t, lang } = useApp();
  const [hidden, setHidden] = useState<Set<MetricKey>>(new Set());

  const gid = useId().replace(/:/g, '');
  const metricLabel: Record<MetricKey, string> = {
    views: t.anaViews, likes: t.anaLikes, comments: t.anaComments, shares: t.anaShares,
  };

  const data = useMemo(
    () => points.map((p) => ({ ...p, label: `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}` })),
    [points],
  );
  const hasData = useMemo(
    () => points.some((p) => p.views > 0 || p.likes > 0 || p.comments > 0 || p.shares > 0),
    [points],
  );
  const hasEstimated = useMemo(() => points.some((p) => p.estimated), [points]);
  const tickInterval = data.length > 10 ? Math.floor(data.length / 7) : 0;
  const showDots = data.length <= 31;
  const toggle = (k: MetricKey) => setHidden((prev) => {
    const next = new Set(prev);
    // Không cho tắt series cuối cùng — biểu đồ rỗng vô nghĩa.
    if (next.has(k)) next.delete(k);
    else if (next.size < METRIC_ORDER.length - 1) next.add(k);
    return next;
  });

  return (
    // Card cao đầy ô lưới (xem `.ana-cell`) → vùng chart co giãn theo card cạnh bên, không cần
    // đặt chiều cao cứng cho hai card khớp nhau.
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, marginBottom: 16,
      }}>
        {/* Cụm trái: tiêu đề + legend NGANG ngay dưới — legend là thứ người dùng thao tác nhiều nhất
            nên đặt ở góc trên trái, không dồn sang phải chung chỗ với badge khoảng ngày. */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.textStrong }}>{t.anaTrendTitle}</div>
          <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2 }}>{t.anaTrendSub}</div>
          {/* Legend tương tác — bấm để bật/tắt series. */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }} role="group" aria-label={t.anaTrendTitle}>
            {METRIC_ORDER.map((k) => {
              const off = hidden.has(k);
              return (
                <button key={k} type="button" onClick={() => toggle(k)} aria-pressed={!off}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 8,
                    padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    color: off ? C.ink350 : C.ink550, background: off ? C.bg : C.primarySoft,
                    opacity: off ? 0.7 : 1,
                  }}>
                  <span aria-hidden style={{
                    width: 9, height: 9, borderRadius: 3,
                    background: off ? C.legacyBgcfc9e0 : METRIC_COLOR[k],
                  }} />
                  {metricLabel[k]}
                </button>
              );
            })}
          </div>
        </div>
        <RangeBadge from={from} to={to} />
      </div>

      {hasData ? (
        <div style={{ flex: 1, minHeight: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
              <defs>
                {METRIC_ORDER.map((k) => (
                  <linearGradient key={k} id={`ana-${k}-${gid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={METRIC_COLOR[k]} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={METRIC_COLOR[k]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke={GRID_LINE} vertical={false} />
              <XAxis dataKey="label" interval={tickInterval} axisLine={false} tickLine={false}
                tick={{ fontSize: 11, fill: AXIS_TEXT }} tickMargin={8} />
              <YAxis width={46} axisLine={false} tickLine={false} allowDecimals={false}
                tick={{ fontSize: 11, fill: AXIS_TEXT }} tickFormatter={formatCompactNumber} />
              <Tooltip
                cursor={{ stroke: GRID_LINE, strokeWidth: 2 }}
                content={(props) => (
                  <ChartTooltip {...props} labels={metricLabel} hidden={hidden} lang={lang} estimatedLabel={t.anaEstimatedTip} />
                )}
              />
              {METRIC_ORDER.filter((k) => !hidden.has(k)).map((k) => (
                <Area key={k} type="monotone" dataKey={k} stroke={METRIC_COLOR[k]} strokeWidth={2.2}
                  fill={`url(#ana-${k}-${gid})`} fillOpacity={1}
                  // Marker tròn trên từng điểm; range dài (>31 ngày) thì bỏ marker, nếu không các
                  // chấm dính liền thành một vệt dày che mất đường.
                  // Điểm thật tô đặc; ngày ước tính là điểm rỗng viền đứt.
                  dot={showDots ? (props: DotProps) => <TrendDot key={`${k}-${props.index}`} {...props} color={METRIC_COLOR[k]} /> : false}
                  activeDot={{ r: 4 }} isAnimationActive={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{
          flex: 1, minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '0 24px', fontSize: 13.5, lineHeight: 1.6, color: C.textMuted,
        }}>
          {t.anaTrendEmpty}
        </div>
      )}

      {hasData && hasEstimated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, fontSize: 11.5, lineHeight: 1.5, color: C.textMuted }}>
          <svg width="12" height="12" aria-hidden style={{ flex: 'none' }}>
            <circle cx="6" cy="6" r="4" fill={C.surface} stroke={C.textMuted} strokeWidth={1.6} strokeDasharray="2 1.6" />
          </svg>
          <span>{t.anaEstimatedNote}</span>
        </div>
      )}
    </Card>
  );
}

type DotProps = { cx?: number; cy?: number; index?: number; payload?: { estimated?: boolean } };

/** Marker một điểm: thật = tô đặc màu metric; ước tính = rỗng (nền card) viền đứt. */
function TrendDot({ cx, cy, payload, color }: DotProps & { color: string }) {
  if (cx == null || cy == null) return null;
  const estimated = !!payload?.estimated;
  return (
    <circle cx={cx} cy={cy} r={estimated ? 3.5 : 3} stroke={color} strokeWidth={estimated ? 1.6 : 2}
      fill={estimated ? C.surface : color} strokeDasharray={estimated ? '2 1.6' : undefined} />
  );
}

function ChartTooltip({
  active, payload, label, labels, hidden, lang, estimatedLabel,
}: TooltipContentProps & {
  labels: Record<MetricKey, string>;
  hidden: Set<MetricKey>;
  lang: string;
  estimatedLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const estimated = !!(payload[0]?.payload as { estimated?: boolean } | undefined)?.estimated;
  const valueOf = (k: MetricKey) => Number(payload.find((p) => p.dataKey === k)?.value ?? 0);
  const rows = METRIC_ORDER.filter((k) => !hidden.has(k));
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px',
      boxShadow: `0 12px 28px -18px ${C.legacyShadowrgba8040140_6_}`, fontSize: 12.5, minWidth: 150,
    }}>
      <div style={{ fontWeight: 700, color: C.textStrong, marginBottom: 6 }}>{label}</div>
      {rows.map((k) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.ink550, marginTop: 2 }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: METRIC_COLOR[k] }} />
          <span style={{ flex: 1 }}>{labels[k]}</span>
          <strong style={{ color: C.textStrong }}>{formatGroupedNumber(valueOf(k), lang)}</strong>
        </div>
      ))}
      {estimated && (
        <div style={{ marginTop: 7, paddingTop: 6, borderTop: `1px dashed ${C.border}`, fontSize: 11.5, color: C.textMuted, maxWidth: 220 }}>
          {estimatedLabel}
        </div>
      )}
    </div>
  );
}

export default memo(AnalyticsTrendChart);
