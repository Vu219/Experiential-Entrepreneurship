import { CalendarRange } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import type { UsageDateRange } from '../../../api/adminUsage';

export type UsageRangePreset = '7d' | '30d' | 'month' | 'prevMonth' | 'custom';

export interface UsageRange {
  preset: UsageRangePreset;
  /** Chỉ dùng khi preset = custom (YYYY-MM-DD, `to` bao gồm). */
  from?: string;
  to?: string;
}

/** Trần khoảng tuỳ chọn — khớp MAX_RANGE_DAYS phía BE. */
export const MAX_RANGE_DAYS = 366;

const pad2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

/** Số ngày của khoảng (tính cả hai đầu). */
export const rangeDays = (r: UsageDateRange) =>
  Math.round((new Date(r.to).getTime() - new Date(r.from).getTime()) / 86_400_000) + 1;

/**
 * Preset → khoảng ngày cụ thể. `current` = đúng kỳ hạn mức đang chạy ("Tháng này"): khi đó các tab
 * Tổng quan/Theo gói/Theo người dùng KHÔNG gửi from/to để BE tính như enforcement (có % hạn mức);
 * khoảng vẫn được trả để heatmap và Nhật ký có mốc ngày cụ thể. null = khoảng tuỳ chọn chưa hợp lệ.
 */
export function resolveUsageRange(r: UsageRange): { range: UsageDateRange; current: boolean } | null {
  const today = new Date();
  switch (r.preset) {
    case '7d':
      return { range: { from: ymd(daysAgo(6)), to: ymd(today) }, current: false };
    case '30d':
      return { range: { from: ymd(daysAgo(29)), to: ymd(today) }, current: false };
    case 'month':
      return { range: { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) }, current: true };
    case 'prevMonth':
      return {
        range: {
          from: ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
          to: ymd(new Date(today.getFullYear(), today.getMonth(), 0)),
        },
        current: false,
      };
    case 'custom': {
      if (!r.from || !r.to || r.to < r.from) return null;
      const range = { from: r.from, to: r.to };
      return rangeDays(range) > MAX_RANGE_DAYS ? null : { range, current: false };
    }
  }
}

/** Đọc bộ lọc từ URL (`range`, và `from`/`to` khi custom); hỏng/thiếu → "Tháng này". */
export function usageRangeFromParams(params: URLSearchParams): UsageRange {
  const preset = params.get('range') as UsageRangePreset | null;
  if (preset === 'custom') return { preset, from: params.get('from') ?? '', to: params.get('to') ?? '' };
  return { preset: preset && ['7d', '30d', 'prevMonth'].includes(preset) ? preset : 'month' };
}

/**
 * Thanh chọn khoảng thời gian DÙNG CHUNG cho các tab dữ liệu của trang Token & hạn mức: preset nhanh
 * + "Tuỳ chọn" (2 ô ngày, tối đa 366 ngày). Chỉ phát giá trị — trang lo đồng bộ URL và nạp dữ liệu.
 */
export default function UsageRangeBar({ value, onChange }: { value: UsageRange; onChange: (next: UsageRange) => void }) {
  const { t, brandGradient } = useApp();
  const presets: [UsageRangePreset, string][] = [
    ['7d', t.auRange7d], ['30d', t.auRange30d], ['month', t.auRangeMonth],
    ['prevMonth', t.auRangePrevMonth], ['custom', t.auRangeCustom],
  ];
  const custom = value.preset === 'custom';
  const invalid = custom && !!value.from && !!value.to && resolveUsageRange(value) === null;
  const today = ymd(new Date());

  const inputStyle = {
    border: `1px solid ${invalid ? '#fca5a5' : '#ece8f6'}`, borderRadius: 9, padding: '6px 10px',
    fontSize: 12.5, color: '#2b2543', background: '#fff',
  } as const;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <CalendarRange size={16} color="#a59fbb" aria-hidden />
      {presets.map(([key, label]) => {
        const active = value.preset === key;
        return (
          <button key={key} onClick={() => {
            if (key === 'custom') {
              // Mở tuỳ chọn từ khoảng đang xem để admin chỉ cần sửa một đầu.
              const cur = resolveUsageRange(value);
              onChange({ preset: 'custom', from: cur?.range.from, to: cur?.range.to });
            } else onChange({ preset: key });
          }} style={{
            border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6', background: active ? brandGradient : '#fff',
            color: active ? '#fff' : '#5b5670', borderRadius: 999, padding: '6px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          }}>
            {label}
          </button>
        );
      })}
      {custom && (
        <>
          <input type="date" aria-label={t.aueFrom} value={value.from ?? ''} max={value.to || today}
            onChange={(e) => onChange({ ...value, from: e.target.value })} style={inputStyle} />
          <span style={{ color: '#a59fbb' }}>–</span>
          <input type="date" aria-label={t.aueTo} value={value.to ?? ''} min={value.from} max={today}
            onChange={(e) => onChange({ ...value, to: e.target.value })} style={inputStyle} />
          {invalid && <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>{t.auRangeInvalid}</span>}
        </>
      )}
    </div>
  );
}
