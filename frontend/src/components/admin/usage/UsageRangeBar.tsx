import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import DatePicker from '../../DatePicker';
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

const PANEL_WIDTH = 320;

const pad2 = (n: number) => String(n).padStart(2, '0');
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const ddmmyyyy = (s: string) => `${ddmm(s)}/${s.slice(0, 4)}`;
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
 * Bộ lọc khoảng thời gian DÙNG CHUNG cho các tab dữ liệu của trang Token & hạn mức — cùng mẫu với
 * `RevenueFilterBar` trang Doanh thu & Đơn hàng: MỘT nút (preset + khoảng đang áp) mở dropdown chọn
 * preset / "Tuỳ chọn" (2 ô ngày, tối đa 366 ngày). Mọi chỉnh sửa trong dropdown là BẢN NHÁP — chỉ khi
 * bấm "Lọc" mới gọi `onChange` (trang ghi URL + nạp lại), nên sửa từng ô ngày không bắn API.
 * Popover render qua portal + toạ độ fixed (cùng mẫu DateRangePill).
 */
export default function UsageRangeBar({ value, onChange }: { value: UsageRange; onChange: (next: UsageRange) => void }) {
  const { t, brandGradient } = useApp();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<UsageRange>(value);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const today = ymd(new Date());

  const presets: [UsageRangePreset, string][] = [
    ['7d', t.auRange7d], ['30d', t.auRange30d], ['month', t.auRangeMonth],
    ['prevMonth', t.auRangePrevMonth], ['custom', t.auRangeCustom],
  ];
  const presetLabel = Object.fromEntries(presets) as Record<UsageRangePreset, string>;

  // Mở lại luôn bắt đầu từ khoảng đang áp, không giữ bản nháp dở của lần trước.
  const valueKey = JSON.stringify(value);
  useEffect(() => {
    if (open) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, valueKey]);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setCoords({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - PANEL_WIDTH - 8)) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      // DatePicker render lịch qua portal riêng — bấm vào lịch không phải bấm ra ngoài.
      if ((target as HTMLElement).closest?.('[data-datepicker-panel]')) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const applied = resolveUsageRange(value);
  const draftResolved = resolveUsageRange(draft);
  const summary = applied ? `${ddmm(applied.range.from)} – ${ddmmyyyy(applied.range.to)}` : '';

  const pickPreset = (key: UsageRangePreset) => {
    if (key === draft.preset) return;
    if (key === 'custom') {
      // Mở tuỳ chọn từ khoảng đang chọn để admin chỉ cần sửa một đầu.
      const cur = resolveUsageRange(draft);
      setDraft({ preset: 'custom', from: cur?.range.from, to: cur?.range.to });
    } else setDraft({ preset: key });
  };

  const label = (text: string) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: '#8a85a0', margin: '12px 0 7px' }}>{text}</div>
  );

  return (
    <div>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px',
          border: `1px solid ${open ? '#c4b5fd' : '#ece8f6'}`, borderRadius: 10, background: open ? '#f7f4ff' : '#fff',
          fontSize: 13, fontWeight: 700, color: '#4b4660', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <SlidersHorizontal size={15} strokeWidth={1.9} color="#8b5cf6" />
        {presetLabel[value.preset]}
        {summary && <span style={{ color: '#a59fbb', fontWeight: 600 }}>· {summary}</span>}
        <ChevronDown size={14} strokeWidth={2} color="#a39bbf" />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t.revFilterTitle}
          className="menu-pop menu-pop--left"
          style={{
            position: 'fixed', top: coords.top, left: coords.left, width: PANEL_WIDTH, zIndex: 1000,
            background: '#fff', border: '1px solid #ece8f6', borderRadius: 14, padding: 14,
            boxShadow: '0 24px 50px -22px rgba(80,40,140,.5)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8a85a0', marginBottom: 7 }}>{t.revFilterPeriod}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {presets.map(([key, text]) => {
              const active = draft.preset === key;
              return (
                <button key={key} onClick={() => pickPreset(key)} style={{
                  border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6',
                  background: active ? brandGradient : '#fff', color: active ? '#fff' : '#5b5670',
                  borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                }}>
                  {text}
                </button>
              );
            })}
          </div>

          {draft.preset === 'custom' ? (
            <>
              {label(t.aueFrom)}
              <DatePicker value={draft.from ?? ''} max={draft.to || today} ariaLabel={t.aueFrom}
                onChange={(v) => setDraft({ ...draft, from: v })} />
              {label(t.aueTo)}
              <DatePicker value={draft.to ?? ''} min={draft.from} max={today} ariaLabel={t.aueTo}
                onChange={(v) => setDraft({ ...draft, to: v })} />
              {!draftResolved && (
                <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginTop: 10 }}>{t.auRangeInvalid}</div>
              )}
            </>
          ) : draftResolved && (
            <div style={{ fontSize: 12.5, color: '#5b5670', fontWeight: 600, marginTop: 12 }}>
              {ddmm(draftResolved.range.from)} – {ddmmyyyy(draftResolved.range.to)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => setOpen(false)} style={{
              flex: 1, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '9px 0',
              fontSize: 13, fontWeight: 700, color: '#5b5670', cursor: 'pointer',
            }}>
              {t.close}
            </button>
            <button
              onClick={() => { onChange(draft); setOpen(false); }}
              disabled={!draftResolved}
              style={{
                flex: 1, border: 'none', borderRadius: 10, padding: '9px 0', fontSize: 13, fontWeight: 700,
                color: '#fff', background: brandGradient, cursor: draftResolved ? 'pointer' : 'default',
                opacity: draftResolved ? 1 : 0.55,
              }}
            >
              {t.revFilterApply}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
