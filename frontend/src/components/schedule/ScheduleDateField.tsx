import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import MonthGrid, { buildMonth } from '../calendar/MonthGrid.tsx';
import { MONTHS_EN } from '../calendar/dateUtils.ts';
import type { PostSchedule } from '../../api/schedules.ts';

// Ô chọn ngày của SchedulePlanner: lịch tháng mở dạng POPOVER khi bấm (thay lưới tháng cố định chiếm nửa màn),
// vẫn giữ chấm màu các ngày đã có lịch của tài khoản đang chọn. Ngày trước hôm nay không chọn được.

const POPOVER_W = 320;

export default function ScheduleDateField({ value, min, onChange, schedules, ariaLabel, invalid = false }: {
  /** yyyy-MM-dd hoặc ''. */
  value: string;
  /** Ngày sớm nhất chọn được (hôm nay theo múi giờ đăng). */
  min: string;
  onChange: (v: string) => void;
  /** Lịch hiện có của tài khoản đích — hiện chấm màu trên lưới. */
  schedules: PostSchedule[];
  ariaLabel: string;
  invalid?: boolean;
}) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthOf(value || min));
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) setView(monthOf(value || min)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Neo dưới ô (lật lên trên nếu thiếu chỗ), không tràn mép phải.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const h = panelRef.current?.offsetHeight ?? 360;
    const top = r.bottom + 6 + h > window.innerHeight && r.top - h - 6 > 0 ? r.top - h - 6 : r.bottom + 6;
    setPos({ top, left: Math.max(8, Math.min(r.left, window.innerWidth - POPOVER_W - 8)) });
  }, [open, view]);

  // Đóng khi bấm ra ngoài / Esc / cuộn trang (popover position: fixed).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
    const onScroll = (e: Event) => { if (!panelRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const cells = useMemo(() => buildMonth(view, schedules), [view, schedules]);
  const pick = (key: string | null) => {
    if (!key || key < min) return;
    onChange(key);
    setOpen(false);
  };
  const shift = (delta: number) => setView((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1, 12));
  const monthLabel = lang === 'en' ? `${MONTHS_EN[view.getMonth()]} ${view.getFullYear()}` : `Tháng ${view.getMonth() + 1}/${view.getFullYear()}`;
  const display = value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ ...field, borderColor: invalid ? '#f3aabf' : open ? '#c4b5fd' : '#ece8f6', color: display ? '#241f3a' : '#a59fbb' }}
      >
        <span style={{ flex: 1, textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>{display || t.planPickDate}</span>
        <CalendarIcon size={16} color="#a39bbf" strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div ref={panelRef} role="dialog" aria-label={ariaLabel} className="menu-pop menu-pop--left"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: POPOVER_W, zIndex: 9999, background: '#fff', border: '1px solid #efeaf8', borderRadius: 16, boxShadow: '0 18px 38px -12px rgba(80,40,140,.35)', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" onClick={() => shift(-1)} aria-label={t.planPrevMonth} style={navBtn}><ChevronLeft size={15} aria-hidden="true" /></button>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#3f3a55' }}>{monthLabel}</span>
            <button type="button" onClick={() => shift(1)} aria-label={t.planNextMonth} style={navBtn}><ChevronRight size={15} aria-hidden="true" /></button>
          </div>
          <MonthGrid cells={cells} selectedDay={value || null} onSelectDay={pick} compact minDay={min} disabledLabel={t.planDayPast} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
            {/* Chú thích: ngày đã qua (mờ, không chọn được) · hôm nay · chấm = ngày đã có lịch */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11, color: '#8a85a0' }}>
              <span style={legendItem}><span aria-hidden="true" style={{ ...swatch, background: '#f4f3f8', opacity: 0.8 }} />{t.planLegendPast}</span>
              <span style={legendItem}><span aria-hidden="true" style={{ ...swatch, background: '#f6f1ff', border: '1px solid #c4b5fd' }} />{t.planToday}</span>
              <span style={legendItem}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: '#1877f2' }} />{t.planLegendBooked}</span>
            </span>
            <button type="button" onClick={() => pick(min)} className="link-underline"
              style={{ flex: 'none', background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: '#7c3aed', cursor: 'pointer' }}>
              {t.planToday}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

const monthOf = (iso: string) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, 1, 12);

const field: CSSProperties = {
  font: 'inherit', display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0, height: 42, border: '1px solid #ece8f6',
  borderRadius: 10, padding: '0 12px', background: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
};
const legendItem: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5 };
const swatch: CSSProperties = { width: 11, height: 11, borderRadius: 3, flex: 'none' };
const navBtn: CSSProperties = { width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ece8f6', borderRadius: 8, background: '#fff', cursor: 'pointer' };
