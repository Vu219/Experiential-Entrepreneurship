import { memo, useId, useMemo, useState } from 'react';
import { Download, HelpCircle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui';
import { formatCompactNumber, formatGroupedNumber } from '../../utils/format';
import { AXIS_TEXT, ENGAGEMENT_LINE, GRID_LINE, REACH_LINE } from '../dashboard/dashboardTokens';
import { C } from '../../styles/colors';

export type UsageChartRange = 'week' | 'month';
export interface UsageDayPoint {
  /** Ngày trong tháng (1–31). */
  day: number;
  value: number;
}

/**
 * Card "Token theo ngày" của tab Cài đặt → Token & mức dùng: tiêu đề + dòng phụ "token thô", nút Tuần/Tháng dạng
 * segmented + xuất CSV, hàng 3 số tóm tắt của khoảng đang xem, biểu đồ cột recharts (cùng lưới/trục/gradient với
 * biểu đồ Bảng điều khiển). Dữ liệu đã được UsageTab lấp đủ ngày — component chỉ hiển thị.
 */
function UsageDailyChart({ points, period, range, onRangeChange, onExport, empty }: {
  points: UsageDayPoint[];
  /** Kỳ "2026-10" — dựng nhãn ngày dd/MM. */
  period: string;
  range: UsageChartRange;
  onRangeChange: (range: UsageChartRange) => void;
  onExport: () => void;
  /** Nội dung thay biểu đồ khi kỳ chưa có hoạt động AI. */
  empty?: React.ReactNode;
}) {
  const { t, lang } = useApp();
  const [rawOpen, setRawOpen] = useState(false);
  const gradientId = `usage-bar-${useId().replace(/:/g, '')}`;
  const month = period.slice(5, 7);
  const dayLabel = (day: number) => dayMonth(day, month, lang);

  const data = useMemo(() => points.map((p) => ({ ...p, label: dayMonth(p.day, month, lang) })), [points, lang, month]);
  const total = points.reduce((s, p) => s + p.value, 0);
  const peak = points.reduce<UsageDayPoint | null>((best, p) => (p.value > 0 && (!best || p.value > best.value) ? p : best), null);
  const activeDays = points.filter((p) => p.value > 0).length;
  // Tháng 30 cột mà hiện đủ nhãn thì chồng chữ — giãn còn ~7 mốc.
  const tickInterval = data.length > 10 ? Math.ceil(data.length / 7) - 1 : 0;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.textStrong }}>{t.tuChartTitle}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 3, fontSize: 12.5, color: C.textSecondary }}>
            <span>{sentenceCase(t.tuRawNote)}</span>
            <button type="button" onClick={() => setRawOpen((v) => !v)} aria-expanded={rawOpen} title={t.tuRawWhat}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', padding: 0, fontSize: 12.5, fontWeight: 700, color: C.primary, cursor: 'pointer' }}>
              <HelpCircle size={14} strokeWidth={2.2} /> {t.tuRawWhat}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div role="group" aria-label={t.tuChartTitle} style={{ display: 'inline-flex', padding: 3, borderRadius: 11, background: C.surfaceMuted }}>
            {(['week', 'month'] as const).map((r) => {
              const on = range === r;
              return (
                <button key={r} type="button" aria-pressed={on} onClick={() => onRangeChange(r)} style={{
                  border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  background: on ? C.surface : 'transparent', color: on ? C.primary : C.textSecondary,
                  boxShadow: on ? `0 1px 3px ${C.legacyShadowrgba8040140_6_}` : 'none',
                }}>
                  {r === 'week' ? t.tuWeek : t.tuMonth}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={onExport} className="btn-soft" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${C.border}`, background: C.surface,
            borderRadius: 10, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, color: C.ink550, cursor: 'pointer',
          }}>
            <Download size={14} strokeWidth={2.2} /> {t.tuExportCsv}
          </button>
        </div>
      </div>

      {rawOpen && (
        <div style={{ fontSize: 12.5, color: C.ink550, lineHeight: 1.6, background: C.surfaceSubtle, border: `1px solid ${C.surfaceMuted}`, borderRadius: 12, padding: '10px 14px', marginTop: 12 }}>
          {t.tuRawExplain}
        </div>
      )}

      {empty ?? (
        <>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', margin: '18px 0 14px' }}>
            <Summary label={t.tuRangeTotal} value={formatGroupedNumber(total, lang)} />
            <Summary label={t.tuPeakDay} value={peak ? formatCompactNumber(peak.value) : '—'} hint={peak ? dayLabel(peak.day) : undefined} />
            <Summary label={t.tuActiveDays} value={`${activeDays}/${points.length}`} />
          </div>
          <div style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barCategoryGap={range === 'week' ? '28%' : '22%'}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ENGAGEMENT_LINE} />
                    <stop offset="100%" stopColor={REACH_LINE} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_LINE} vertical={false} />
                <XAxis dataKey="label" interval={tickInterval} axisLine={false} tickLine={false}
                  tick={{ fontSize: 11, fill: AXIS_TEXT }} tickMargin={8} />
                <YAxis width={44} axisLine={false} tickLine={false} allowDecimals={false}
                  tick={{ fontSize: 11, fill: AXIS_TEXT }} tickFormatter={formatCompactNumber} />
                <Tooltip cursor={{ fill: GRID_LINE, opacity: 0.6 }}
                  content={(props) => <DayTooltip {...props} unit={t.tuTokens} lang={lang} />} />
                <Bar dataKey="value" fill={`url(#${gradientId})`} radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}

/** Viết hoa CHỈ chữ đầu ("token thô — …" → "Token thô — …"); CSS capitalize sẽ viết hoa mọi từ. */
export const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Nhãn ngày theo ngôn ngữ: vi `21/10`, en `10/21`. */
const dayMonth = (day: number, month: string, lang: string) =>
  lang === 'en' ? `${month}/${String(day).padStart(2, '0')}` : `${String(day).padStart(2, '0')}/${month}`;

function Summary({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: C.textFaint }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
        <span style={{ fontFamily: "'Plus Jakarta Sans'", fontSize: 18, fontWeight: 800, color: C.textStrong }}>{value}</span>
        {hint && <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{hint}</span>}
      </div>
    </div>
  );
}

function DayTooltip({ active, payload, label, unit, lang }: TooltipContentProps & { unit: string; lang: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '9px 12px', fontSize: 12.5,
      boxShadow: `0 12px 28px -18px ${C.legacyShadowrgba8040140_6_}`,
    }}>
      <div style={{ fontWeight: 700, color: C.textStrong, marginBottom: 4 }}>{label}</div>
      <div style={{ color: C.ink550 }}>
        <strong style={{ color: C.textStrong }}>{formatGroupedNumber(Number(payload[0].value ?? 0), lang)}</strong> {unit}
      </div>
    </div>
  );
}

export default memo(UsageDailyChart);
