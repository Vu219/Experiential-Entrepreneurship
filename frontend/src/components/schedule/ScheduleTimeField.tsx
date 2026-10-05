import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { completeTime24, isTime24, maskTime24 } from '../../validations/scheduleValidation.ts';
import { C } from '../../styles/colors';

// Ô giờ đăng 24h (HH:mm) cho SchedulePlanner — thay <input type="time"> (hiển thị theo locale máy: 12h "06:34 PM"
// bị cắt chữ, lệch định dạng với gợi ý "08:00–09:00"). Gõ tay được, hoặc bấm vào ô / icon đồng hồ để mở bảng chọn
// (cột Giờ 00–23 + cột Phút bước 5). Giờ đã qua của hôm nay (trước `minTime`) làm mờ, trỏ chuột "cấm", không chọn
// được. Chỉ đẩy giá trị lên khi đủ HH:mm hợp lệ; đang gõ dở thì báo '' (dòng coi như chưa chọn giờ).

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const PANEL_W = 196;

export default function ScheduleTimeField({ value, onChange, ariaLabel, invalid = false, onInvalidChange, minTime = null }: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  invalid?: boolean;
  /** Báo ô đang chứa chữ không phải giờ hợp lệ (đã rời ô) — để hiện lỗi định dạng dưới ô. */
  onInvalidChange?: (bad: boolean) => void;
  /** Giờ sớm nhất chọn được trong ngày đang chọn (HH:mm); 'OVER' = hôm nay hết giờ; null = cả ngày chọn được. */
  minTime?: string | 'OVER' | null;
}) {
  const { t } = useApp();
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Giá trị đổi từ ngoài (chip gợi ý, khung giờ vàng) → hiện đúng giá trị mới; không đè chữ đang gõ dở.
  useEffect(() => {
    if (value !== (isTime24(draft) ? draft : '')) setDraft(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const bad = !focused && !open && draft !== '' && !isTime24(draft);
  useEffect(() => { onInvalidChange?.(bad); }, [bad]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: string) => {
    setDraft(next);
    const valid = isTime24(next) ? next : '';
    if (valid !== value) onChange(valid);
  };

  // ---- Bảng chọn giờ ----
  const over = minTime === 'OVER';
  const [minH, minM] = minTime && !over ? [minTime.slice(0, 2), minTime.slice(3, 5)] : ['00', '00'];
  const hourPast = (h: string) => over || h < minH;
  const minutePast = (h: string, m: string) => over || h < minH || (h === minH && m < minM);
  const selH = isTime24(draft) ? draft.slice(0, 2) : null;
  const selM = isTime24(draft) ? draft.slice(3, 5) : null;
  /** Phút bước 5 đầu tiên còn chọn được của giờ {h} (giữ phút đang chọn nếu còn hợp lệ). */
  const minuteFor = (h: string, keep: string | null) =>
    keep && !minutePast(h, keep) ? keep : MINUTES.find((m) => !minutePast(h, m)) ?? '00';

  const pickHour = (h: string) => { if (!hourPast(h)) update(`${h}:${minuteFor(h, selM)}`); };
  const pickMinute = (m: string) => {
    const h = selH ?? HOURS.find((x) => !minutePast(x, m)) ?? minH;
    if (minutePast(h, m)) return;
    update(`${h}:${m}`);
    setOpen(false);
  };

  // Neo dưới ô (lật lên nếu thiếu chỗ), cuộn cột tới giờ/phút đang chọn (hoặc giờ sớm nhất).
  useLayoutEffect(() => {
    if (!open || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    const h = panelRef.current?.offsetHeight ?? 280;
    const top = r.bottom + 6 + h > window.innerHeight && r.top - h - 6 > 0 ? r.top - h - 6 : r.bottom + 6;
    setPos({ top, left: Math.max(8, Math.min(r.right - PANEL_W, window.innerWidth - PANEL_W - 8)) });
    panelRef.current?.querySelectorAll<HTMLElement>('[data-current="true"]').forEach((el) => el.scrollIntoView({ block: 'center' }));
  }, [open]);

  // Đóng khi bấm ra ngoài / Esc / cuộn trang (bảng position: fixed).
  useEffect(() => {
    if (!open) return;
    const inside = (n: EventTarget | null) => !!n && (boxRef.current?.contains(n as Node) || panelRef.current?.contains(n as Node));
    const onDown = (e: MouseEvent) => { if (!inside(e.target)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); inputRef.current?.focus(); } };
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

  const cell = (label: string, on: boolean, past: boolean, current: boolean, onPick: () => void) => (
    <button key={label} type="button" role="option" aria-selected={on} aria-disabled={past || undefined}
      data-current={current || undefined} title={past ? t.planTimePast : undefined}
      onClick={() => { if (!past) onPick(); }}
      style={{
        ...cellBtn,
        background: on ? 'var(--brand)' : past ? 'transparent' : undefined,
        color: on ? C.onBrand : past ? C.legacyTextc9c4d8 : C.text,
        cursor: past ? 'not-allowed' : 'pointer',
        fontWeight: on ? 800 : 600,
      }}
      className={on || past ? undefined : 'btn-soft'}>
      {label}
    </button>
  );

  const firstOkHour = HOURS.find((h) => !hourPast(h));

  return (
    <>
      <div ref={boxRef}
        style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none', width: 140, height: 42, boxSizing: 'border-box', border: `1px solid ${invalid || bad ? C.inputErrorBorder : focused || open ? C.legacyBorderc4b5fd : C.border}`, borderRadius: 10, padding: '0 6px 0 12px', background: C.surface }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => update(maskTime24(e.target.value))}
          onClick={() => setOpen(true)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); if (draft) update(completeTime24(draft)); }}
          onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}
          placeholder="HH:mm"
          inputMode="numeric"
          maxLength={5}
          aria-label={ariaLabel}
          aria-invalid={invalid || bad}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={{ flex: 1, minWidth: 0, width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: C.textStrong, fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em', padding: 0, cursor: 'text' }}
        />
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label={t.planPickTime} title={t.planPickTime}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', width: 28, height: 28, border: 'none', borderRadius: 8, background: open ? C.border : 'transparent', cursor: 'pointer' }}>
          <Clock size={15} color={open ? C.primary : C.ink350} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
      {open && createPortal(
        <div ref={panelRef} role="dialog" aria-label={ariaLabel} className="menu-pop"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: PANEL_W, zIndex: 9999, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: `0 18px 38px -12px ${C.legacyShadowrgba8040140_35_}`, padding: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={colHead}>{t.planHourCol}</div>
            <div style={colHead}>{t.planMinuteCol}</div>
            <div role="listbox" aria-label={t.planHourCol} style={col}>
              {HOURS.map((h) => cell(h, selH === h, hourPast(h), selH ? selH === h : h === firstOkHour, () => pickHour(h)))}
            </div>
            <div role="listbox" aria-label={t.planMinuteCol} style={col}>
              {/* Chưa chọn giờ: phút nào cũng chọn được (tự ghép với giờ sớm nhất còn hợp lệ) */}
              {MINUTES.map((m) => cell(m, selM === m, selH ? minutePast(selH, m) : over, selM === m, () => pickMinute(m)))}
            </div>
          </div>
          {minTime && (
            <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.45, color: over ? C.amberText : C.textMuted }}>
              {over ? t.planTodayOver : t.planEarliestToday.replace('{time}', minTime)}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

const colHead: CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: C.textFaint, textAlign: 'center' };
const col: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 216, overflowY: 'auto', padding: 2, border: `1px solid ${C.surfaceMuted}`, borderRadius: 10 };
const cellBtn: CSSProperties = {
  font: 'inherit', border: 'none', borderRadius: 8, padding: '6px 0', fontSize: 13.5, background: C.surface,
  fontVariantNumeric: 'tabular-nums', textAlign: 'center', flex: 'none',
};
