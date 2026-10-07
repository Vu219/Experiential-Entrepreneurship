import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { weekdays } from '../../data.ts';
import { PLATFORM_BG } from '../../theme.ts';
import { MONTHS_EN, WEEKDAYS_FULL } from '../calendar/dateUtils.ts';
import type { Platform } from '../../api/brandProfile.ts';
import type { CalendarMode } from './plannerLogic.ts';
import { monthGrid, monthOfDay, shiftDay, shiftDayByMonth, shiftMonth, weekdayIndex } from './scheduleCalendarLogic.ts';
import { C, alpha } from '../../styles/colors';

// Lịch tháng INLINE của SchedulePlanner (cột phải mỗi card nền tảng / box giờ chung). Dùng chung state ngày với ô
// nhập: `value` đổi từ ngoài → lịch nhảy đúng tháng; bấm ngày → onSelect. Thứ Hai đầu tuần, lưới 6 × 7, ngày đã
// qua khóa (aria-disabled), chấm màu = lịch đã có của tài khoản đang chọn, viền = ngày có giờ gợi ý.
// Bàn phím: mũi tên (±1 ngày / ±1 tuần), Home/End (đầu/cuối tuần), PageUp/PageDown (±1 tháng), Enter/Space chọn.

// Platform → mã màu nền tảng (FB/IG/TH) cho chấm lịch đã có.
const PLATFORM_DOT: Record<Platform, string> = { FACEBOOK: PLATFORM_BG.FB, INSTAGRAM: PLATFORM_BG.IG, THREADS: PLATFORM_BG.TH };
const NAV_KEYS: Record<string, (day: string) => string> = {
  ArrowLeft: (d) => shiftDay(d, -1),
  ArrowRight: (d) => shiftDay(d, 1),
  ArrowUp: (d) => shiftDay(d, -7),
  ArrowDown: (d) => shiftDay(d, 7),
  Home: (d) => shiftDay(d, -weekdayIndex(d)),
  End: (d) => shiftDay(d, 6 - weekdayIndex(d)),
  PageUp: (d) => shiftDayByMonth(d, -1),
  PageDown: (d) => shiftDayByMonth(d, 1),
};

export default function ScheduleCalendar({ value, todayISO, mode, onSelect, booked, suggested, label, notes }: {
  /** Ngày đang chọn yyyy-MM-dd ('' = chưa chọn). */
  value: string;
  /** Hôm nay theo múi giờ đang chọn — ngày trước đó bị khóa. */
  todayISO: string;
  mode: Exclude<CalendarMode, 'hidden'>;
  onSelect?: (day: string) => void;
  /** Ngày → nền tảng của các lịch đã có (chấm màu). */
  booked: ReadonlyMap<string, Platform[]>;
  /** Ngày có giờ gợi ý (viền màu chủ đạo). */
  suggested?: ReadonlySet<string>;
  /** Nhãn đọc màn hình của lưới. */
  label: string;
  /** Chú thích dưới lịch. */
  notes: string[];
}) {
  const { t, lang } = useApp();
  const interactive = mode === 'interactive';
  const [view, setView] = useState(() => monthOfDay(value || todayISO));
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Ngày chọn từ ô nhập / chip gợi ý / chế độ Đăng ngay → lịch nhảy tới tháng của ngày đó.
  useEffect(() => {
    if (value) setView(monthOfDay(value));
  }, [value]);

  const days = useMemo(() => monthGrid(view), [view]);
  const inView = (d: string | null) => !!d && days.includes(d);
  const firstOfView = `${view}-01`;
  const activeDay = inView(focusDay) ? focusDay! : inView(value) && monthOfDay(value) === view ? value
    : monthOfDay(todayISO) === view ? todayISO : firstOfView;

  // Sau khi đổi tháng bằng bàn phím, đưa focus vào đúng ô mới.
  useEffect(() => {
    const day = pendingFocus.current;
    if (!day) return;
    pendingFocus.current = null;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    const move = NAV_KEYS[e.key];
    if (!move || !interactive) return;
    e.preventDefault();
    const next = move(activeDay);
    if (!days.includes(next) || monthOfDay(next) !== view) setView(monthOfDay(next));
    setFocusDay(next);
    pendingFocus.current = next;
  };

  const [y, m] = [+view.slice(0, 4), +view.slice(5, 7)];
  const title = t.planMonthTitle.replace('{m}', String(m)).replace('{y}', String(y)).replace('{month}', MONTHS_EN[m - 1]);
  const canPrev = mode !== 'disabled' && view > monthOfDay(todayISO);
  const canNext = mode !== 'disabled';
  const shift = (delta: number) => { setFocusDay(null); setView((v) => shiftMonth(v, delta)); };

  const dayLabel = (day: string, extras: string[]) => {
    const [dy, dm, dd] = [day.slice(0, 4), +day.slice(5, 7), +day.slice(8, 10)];
    const base = t.planDayAria.replace('{weekday}', WEEKDAYS_FULL[lang][weekdayIndex(day)])
      .replace('{d}', String(dd)).replace('{m}', String(dm)).replace('{month}', MONTHS_EN[dm - 1]).replace('{y}', dy);
    return [base, ...extras].join(', ');
  };

  const rows = Array.from({ length: 6 }, (_, r) => days.slice(r * 7, r * 7 + 7));

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, background: C.surfaceSubtle, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <button type="button" onClick={() => shift(-1)} disabled={!canPrev} aria-label={t.planPrevMonth} className={canPrev ? 'btn-soft' : undefined}
          style={{ ...navBtn, opacity: canPrev ? 1 : 0.4, cursor: canPrev ? 'pointer' : 'not-allowed' }}>
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        <span aria-live="polite" style={{ fontSize: 13.5, fontWeight: 800, color: C.textStrong, fontVariantNumeric: 'tabular-nums' }}>{title}</span>
        <button type="button" onClick={() => shift(1)} disabled={!canNext} aria-label={t.planNextMonth} className={canNext ? 'btn-soft' : undefined}
          style={{ ...navBtn, opacity: canNext ? 1 : 0.4, cursor: canNext ? 'pointer' : 'not-allowed' }}>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>

      <div style={{ position: 'relative' }}>
        <div ref={gridRef} role="grid" aria-label={label} aria-readonly={!interactive || undefined} aria-disabled={mode === 'disabled' || undefined}
          onKeyDown={onKeyDown}
          style={{ display: 'flex', flexDirection: 'column', gap: 3, opacity: mode === 'disabled' ? 0.35 : mode === 'readonly' ? 0.72 : 1 }}>
          <div role="row" style={week}>
            {weekdays(lang).map((w, i) => (
              <span key={w} role="columnheader" aria-label={WEEKDAYS_FULL[lang][i]}
                style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.textFaint, padding: '2px 0' }}>{w}</span>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row[0]} role="row" style={week}>
              {row.map((day) => {
                const muted = monthOfDay(day) !== view;
                const past = day < todayISO;
                const today = day === todayISO;
                const selected = !!value && day === value;
                const platforms = booked.get(day) ?? [];
                const hasSuggestion = !!suggested?.has(day);
                const disabled = !interactive || past;
                const extras = [
                  today ? t.planDayToday : '',
                  platforms.length ? t.planDayBooked : '',
                  hasSuggestion ? t.planDaySuggested : '',
                  past ? t.planDayPast : '',
                ].filter(Boolean);
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    data-day={day}
                    tabIndex={interactive && day === activeDay ? 0 : -1}
                    aria-selected={selected}
                    aria-disabled={disabled || undefined}
                    aria-current={today ? 'date' : undefined}
                    aria-label={dayLabel(day, extras)}
                    title={past && interactive ? t.planDayPast : undefined}
                    onClick={() => {
                      if (disabled) return;
                      setFocusDay(day);
                      onSelect?.(day);
                    }}
                    className={!disabled && !selected ? 'sch-hover' : undefined}
                    style={{
                      ...cell,
                      background: selected ? alpha(C.primary, 0.14) : 'transparent',
                      border: `1px solid ${selected ? alpha(C.primary, 0.4) : today ? alpha(C.primary, 0.45) : 'transparent'}`,
                      boxShadow: hasSuggestion ? `inset 0 0 0 1.5px ${C.primary}` : 'none',
                      color: selected ? C.primaryStrong : today ? C.primary : past || muted ? C.textFaint : C.text,
                      fontWeight: selected ? 800 : today ? 700 : 600,
                      opacity: past ? 0.45 : muted ? 0.55 : 1,
                      cursor: !interactive ? 'default' : past ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <span>{+day.slice(8, 10)}</span>
                    <span aria-hidden="true" style={{ display: 'flex', gap: 2, height: 5 }}>
                      {platforms.slice(0, 3).map((p, i) => (
                        // Chấm Threads (đen) thêm viền mảnh để còn thấy trên nền tối.
                        <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: PLATFORM_DOT[p] ?? C.textFaint, boxShadow: p === 'THREADS' ? `0 0 0 1px ${C.textFaint}` : undefined }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {mode === 'disabled' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.45, color: C.textMuted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '7px 12px', textAlign: 'center', boxShadow: C.shadowCard }}>
              {t.planCalOff}
            </span>
          </div>
        )}
      </div>

      {mode !== 'disabled' && notes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, fontSize: 11.5, lineHeight: 1.5, color: C.textMuted }}>
          <Info size={13} aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />
          <span>{notes.join(' ')}</span>
        </div>
      )}
    </div>
  );
}

const week: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3 };
const cell: CSSProperties = {
  font: 'inherit', height: 38, minWidth: 0, borderRadius: 10, padding: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 12.5, fontVariantNumeric: 'tabular-nums',
};
const navBtn: CSSProperties = {
  width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.textSecondary,
};
