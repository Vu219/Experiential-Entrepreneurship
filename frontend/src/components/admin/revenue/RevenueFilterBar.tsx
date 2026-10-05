import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { FilterSelect } from '../AdminListPage';
import DatePicker from '../../DatePicker';
import type { RevenueFilter, RevenueFilterMode } from '../../../api/revenue';
import { C } from '../../../styles/colors';

const MODES: RevenueFilterMode[] = ['DAY', 'WEEK', 'MONTH', 'YEAR', 'CUSTOM'];

/** Trần khoảng tuỳ chỉnh — khớp MAX_CUSTOM_DAYS của BE. */
const MAX_CUSTOM_DAYS = 366;
const PANEL_WIDTH = 340;

const pad2 = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const ddmmyyyy = (s: string) => `${ddmm(s)}/${s.slice(0, 4)}`;

/** Tuần (Thứ 2 → Chủ nhật) chứa ngày `day`. */
export function weekOf(day: string): { from: string; to: string } {
  const d = parse(day);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: iso(monday), to: iso(sunday) };
}

/** Danh sách năm chọn được: 5 năm gần nhất + năm hiện tại (mới nhất lên đầu). */
function yearOptions(): [string, string][] {
  const now = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => {
    const y = String(now - i);
    return [y, y] as [string, string];
  });
}

/** Bộ tham số mặc định của từng chế độ (BE trả lỗi 2038 nếu thiếu). */
function defaultsFor(mode: RevenueFilterMode): RevenueFilter {
  const now = new Date();
  const year = now.getFullYear();
  switch (mode) {
    case 'DAY':
      return { granularity: mode, year, month: now.getMonth() + 1 };
    case 'WEEK':
      return { granularity: mode, ...weekOf(iso(now)) };
    case 'MONTH':
      return { granularity: mode, year };
    case 'YEAR':
      return { granularity: mode, fromYear: year - 4, toYear: year };
    default:
      return { granularity: 'CUSTOM', from: iso(new Date(year, now.getMonth(), 1)), to: iso(now) };
  }
}

function isValid(f: RevenueFilter): boolean {
  if (f.granularity === 'YEAR') return (f.fromYear ?? 0) <= (f.toYear ?? 0);
  if (f.granularity !== 'CUSTOM') return true;
  if (!f.from || !f.to || f.from > f.to) return false;
  return (parse(f.to).getTime() - parse(f.from).getTime()) / 86_400_000 + 1 <= MAX_CUSTOM_DAYS;
}

/**
 * Bộ lọc thời gian của trang Doanh thu & Đơn hàng: MỘT nút "Lọc ▾" (hiện tóm tắt kỳ đang áp) mở
 * dropdown chọn chế độ + phạm vi. Mọi thay đổi trong dropdown là BẢN NHÁP — chỉ khi bấm "Lọc"
 * mới gọi `onChange` (trang mới nạp lại dữ liệu), nên chỉnh tuỳ chỉnh từng ô ngày không bắn API.
 * Popover render qua portal + toạ độ fixed (cùng mẫu DateRangePill).
 */
export default function RevenueFilterBar({
  value,
  onChange,
}: {
  value: RevenueFilter;
  onChange: (next: RevenueFilter) => void;
}) {
  const { t, brandGradient } = useApp();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RevenueFilter>(value);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const years = yearOptions();
  const now = new Date();

  // Mở lại luôn bắt đầu từ bộ lọc đang áp, không giữ bản nháp dở của lần trước.
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

  const modeLabel: Record<RevenueFilterMode, string> = {
    DAY: t.revModeDay, WEEK: t.revModeWeek, MONTH: t.revModeMonth, YEAR: t.revModeYear, CUSTOM: t.revModeCustom,
  };

  const summary = (f: RevenueFilter): string => {
    switch (f.granularity) {
      case 'DAY': return `${t.revMonthPrefix} ${f.month}/${f.year}`;
      case 'WEEK':
      case 'CUSTOM': return f.from && f.to ? `${ddmm(f.from)} – ${ddmmyyyy(f.to)}` : '';
      case 'MONTH': return String(f.year);
      case 'YEAR': return `${f.fromYear} – ${f.toYear}`;
    }
  };

  const monthOptions: [string, string][] = Array.from({ length: 12 }, (_, i) => [
    String(i + 1), `${t.revMonthPrefix} ${i + 1}`,
  ]);
  const activeMode = value.granularity;
  const draftMode = draft.granularity;
  const valid = isValid(draft);

  const label = (text: string) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, margin: '12px 0 7px' }}>{text}</div>
  );

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px',
          border: `1px solid ${open ? C.legacyBorderc4b5fd : C.border}`, borderRadius: 10, background: open ? C.surfaceMuted : C.surface,
          fontSize: 13, fontWeight: 700, color: C.ink650, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <SlidersHorizontal size={15} strokeWidth={1.9} color={C.violetLight} />
        {modeLabel[activeMode]}
        <span style={{ color: C.textFaint, fontWeight: 600 }}>· {summary(value)}</span>
        <ChevronDown size={14} strokeWidth={2} color={C.ink350} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t.revFilterTitle}
          className="menu-pop menu-pop--left"
          style={{
            position: 'fixed', top: coords.top, left: coords.left, width: PANEL_WIDTH, zIndex: 1000,
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14,
            boxShadow: `0 24px 50px -22px ${C.legacyShadowrgba8040140_5_}`,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 7 }}>{t.revFilterMode}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MODES.map((mode) => {
              const active = draftMode === mode;
              return (
                <button key={mode} onClick={() => !active && setDraft(defaultsFor(mode))} style={{
                  border: '1px solid', borderColor: active ? 'transparent' : C.border,
                  background: active ? brandGradient : C.surface, color: active ? C.onBrand : C.ink550,
                  borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                }}>
                  {modeLabel[mode]}
                </button>
              );
            })}
          </div>

          {/* Bộ chọn phạm vi ĐỘNG theo chế độ đang chọn (bản nháp). */}
          {draftMode === 'DAY' && (
            <>
              {label(t.revFilterPeriod)}
              <div style={{ display: 'flex', gap: 8 }}>
                <FilterSelect value={String(draft.month ?? 1)} options={monthOptions}
                  onChange={(v) => setDraft({ ...draft, month: Number(v) })} />
                <FilterSelect value={String(draft.year ?? now.getFullYear())} options={years}
                  onChange={(v) => setDraft({ ...draft, year: Number(v) })} />
              </div>
            </>
          )}

          {draftMode === 'WEEK' && (
            <>
              {label(t.revFilterWeekPick)}
              <DatePicker value={draft.from ?? ''} max={iso(now)} ariaLabel={t.revFilterWeekPick}
                onChange={(v) => v && setDraft({ granularity: 'WEEK', ...weekOf(v) })} />
              {draft.from && draft.to && (
                <div style={{ fontSize: 12.5, color: C.ink550, fontWeight: 600, marginTop: 8 }}>
                  {t.revModeWeek}: {ddmm(draft.from)} – {ddmmyyyy(draft.to)}
                </div>
              )}
            </>
          )}

          {draftMode === 'MONTH' && (
            <>
              {label(t.revFilterYear)}
              <FilterSelect value={String(draft.year ?? now.getFullYear())} options={years}
                onChange={(v) => setDraft({ granularity: 'MONTH', year: Number(v) })} />
            </>
          )}

          {draftMode === 'YEAR' && (
            <>
              {label(t.revFilterPeriod)}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <FilterSelect value={String(draft.fromYear ?? now.getFullYear() - 4)} options={years}
                  onChange={(v) => setDraft({ ...draft, fromYear: Number(v) })} />
                <span style={{ fontSize: 13, color: C.textMuted }}>—</span>
                <FilterSelect value={String(draft.toYear ?? now.getFullYear())} options={years}
                  onChange={(v) => setDraft({ ...draft, toYear: Number(v) })} />
              </div>
            </>
          )}

          {draftMode === 'CUSTOM' && (
            <>
              {label(t.revFrom)}
              <DatePicker value={draft.from ?? ''} max={draft.to} ariaLabel={t.revFrom}
                onChange={(v) => setDraft({ ...draft, from: v })} />
              {label(t.revTo)}
              <DatePicker value={draft.to ?? ''} min={draft.from} ariaLabel={t.revTo}
                onChange={(v) => setDraft({ ...draft, to: v })} />
            </>
          )}

          {!valid && (
            <div style={{ fontSize: 12, fontWeight: 600, color: C.danger, marginTop: 10 }}>{t.revFilterInvalid}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => setOpen(false)} style={{
              flex: 1, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 10, padding: '9px 0',
              fontSize: 13, fontWeight: 700, color: C.ink550, cursor: 'pointer',
            }}>
              {t.close}
            </button>
            <button
              onClick={() => { onChange(draft); setOpen(false); }}
              disabled={!valid}
              style={{
                flex: 1, border: 'none', borderRadius: 10, padding: '9px 0', fontSize: 13, fontWeight: 700,
                color: C.onBrand, background: brandGradient, cursor: valid ? 'pointer' : 'default', opacity: valid ? 1 : 0.55,
              }}
            >
              {t.revFilterApply}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
