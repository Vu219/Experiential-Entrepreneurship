import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';

// ---- helpers ----
const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

// ---- styles ----
const dropShadow = '0 18px 38px -12px rgba(80,40,140,.35)';
const brandGrad = 'linear-gradient(135deg,#8b5cf6,#d946ef)';

const cellBase: CSSProperties = {
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 10,
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  background: 'transparent',
  color: '#3f3a55',
  transition: 'background .15s, color .15s, transform .1s',
  position: 'relative',
};

interface DatePickerProps {
  value: string;                // yyyy-MM-dd ISO or ''
  onChange: (v: string) => void;
  max?: string;                 // yyyy-MM-dd — dates after this are disabled
  min?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  error?: string;
  style?: CSSProperties;       // override trigger wrapper
  inputStyle?: CSSProperties;  // override input element
}

export default function DatePicker({
  value,
  onChange,
  max,
  min,
  placeholder = 'dd/mm/yyyy',
  icon,
  error,
  style,
  inputStyle: inputStyleOverride,
}: DatePickerProps) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Navigation state — start at selected date or today.
  const today = useMemo(() => new Date(), []);
  const initial = value ? parseISO(value) : { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() };
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  // Sync view when value changes externally.
  useEffect(() => {
    if (value) {
      const p = parseISO(value);
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);
  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const selectDay = (day: number) => {
    onChange(toISO(viewYear, viewMonth, day));
    setOpen(false);
  };

  const selectToday = () => {
    const now = new Date();
    if (max && toISO(now.getFullYear(), now.getMonth(), now.getDate()) > max) return;
    onChange(toISO(now.getFullYear(), now.getMonth(), now.getDate()));
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setOpen(false);
  };

  // Build day grid.
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDow = firstDayOfWeek(viewYear, viewMonth);

  // Previous month fill.
  const prevMonthDays = daysInMonth(
    viewMonth === 0 ? viewYear - 1 : viewYear,
    viewMonth === 0 ? 11 : viewMonth - 1,
  );

  const cells: { day: number; current: boolean; disabled: boolean }[] = [];
  // Leading days from previous month.
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, current: false, disabled: true });
  }
  // Current month.
  for (let d = 1; d <= totalDays; d++) {
    const iso = toISO(viewYear, viewMonth, d);
    const disabled = (max ? iso > max : false) || (min ? iso < min : false);
    cells.push({ day: d, current: true, disabled });
  }
  // Trailing days to fill 6 rows (42 cells) or at least complete row.
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, current: false, disabled: true });
    }
  }

  const weekDays = [t.dpSun, t.dpMon, t.dpTue, t.dpWed, t.dpThu, t.dpFri, t.dpSat];
  const monthNames = t.dpMonths.split(',');

  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedISO = value;

  // Display value formatted.
  const displayValue = useMemo(() => {
    if (!value) return '';
    const p = parseISO(value);
    return `${pad(p.day)}/${pad(p.month + 1)}/${p.year}`;
  }, [value]);

  // Panel position — anchor below trigger.
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelHeight = 340;
    const panelWidth = 300;
    let top = rect.bottom + 6;
    let left = rect.left;
    // Flip if not enough space below.
    if (top + panelHeight > window.innerHeight) {
      top = rect.top - panelHeight - 6;
    }
    // Keep within horizontal bounds.
    if (left + panelWidth > window.innerWidth) {
      left = window.innerWidth - panelWidth - 8;
    }
    setPos({ top, left });
  }, [open]);

  return (
    <>
      <div
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: `1.5px solid ${error ? '#f3aabf' : '#e7e2f2'}`,
          borderRadius: 13,
          padding: '0 15px',
          background: '#fbfaff',
          transition: 'border .2s',
          cursor: 'pointer',
          ...style,
        }}
      >
        {icon}
        <input
          readOnly
          value={displayValue}
          placeholder={placeholder}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 15,
            padding: '14px 0',
            color: '#241f3a',
            cursor: 'pointer',
            ...inputStyleOverride,
          }}
        />
        <CalendarIcon size={17} color="#a39bbf" strokeWidth={1.7} />
      </div>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              zIndex: 9999,
              width: 300,
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #efeaf8',
              boxShadow: dropShadow,
              padding: '16px 16px 12px',
              animation: 'datepicker-enter .2s ease-out',
            }}
          >
            {/* Header — month/year + arrows */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button
                type="button"
                onClick={prevMonth}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: '#f6f3fc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background .15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#ece8f6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f6f3fc'; }}
              >
                <ChevronLeft size={16} color="#6b6680" strokeWidth={2} />
              </button>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  style={{ appearance: 'none', background: 'transparent', border: 'none', outline: 'none', fontWeight: 700, fontSize: 14.5, color: '#211c38', cursor: 'pointer', padding: 0 }}
                >
                  {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  style={{ appearance: 'none', background: 'transparent', border: 'none', outline: 'none', fontWeight: 700, fontSize: 14.5, color: '#211c38', cursor: 'pointer', padding: 0 }}
                >
                  {Array.from({ length: 120 }, (_, i) => today.getFullYear() - 100 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={nextMonth}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: '#f6f3fc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background .15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#ece8f6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f6f3fc'; }}
              >
                <ChevronRight size={16} color="#6b6680" strokeWidth={2} />
              </button>
            </div>

            {/* Weekday headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
              {weekDays.map((wd) => (
                <div
                  key={wd}
                  style={{
                    textAlign: 'center',
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#a39bbf',
                    padding: '4px 0',
                  }}
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {cells.map((cell, idx) => {
                const iso = cell.current ? toISO(viewYear, viewMonth, cell.day) : '';
                const isToday = iso === todayISO;
                const isSelected = iso === selectedISO;

                return (
                  <button
                    type="button"
                    key={idx}
                    disabled={cell.disabled}
                    onClick={() => { if (cell.current && !cell.disabled) selectDay(cell.day); }}
                    style={{
                      ...cellBase,
                      color: isSelected ? '#fff' : cell.current ? (cell.disabled ? '#d0cce0' : '#3f3a55') : '#d0cce0',
                      background: isSelected ? brandGrad : 'transparent',
                      boxShadow: isSelected ? '0 6px 16px -6px rgba(139,92,246,.5)' : 'none',
                      cursor: cell.disabled ? 'default' : 'pointer',
                      outline: isToday && !isSelected ? '2px solid #d8cdf2' : 'none',
                      outlineOffset: -2,
                      fontWeight: isToday || isSelected ? 800 : 600,
                    }}
                    onMouseEnter={(e) => {
                      if (!cell.disabled && !isSelected && cell.current)
                        e.currentTarget.style.background = '#f6f3fc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Footer — Clear / Today */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '0 2px' }}>
              <button
                type="button"
                onClick={clear}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#e23d6e',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                  transition: 'background .15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fdeef2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {t.dpClear}
              </button>
              <button
                type="button"
                onClick={selectToday}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#8b5cf6',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                  transition: 'background .15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f6f3fc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {t.dpToday}
              </button>
            </div>
          </div>,
          document.body,
        )}

      {/* Animation keyframes — injected once */}
      <style>{`
        @keyframes datepicker-enter {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
