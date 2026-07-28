import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import DatePicker from '../../DatePicker';
import { formatDateVN } from '../../../utils/format';

// MỘT nút pill "13/07/2026 - 19/07/2026" mở popover chọn khoảng, thay cho hai ô <input type="date">
// đặt cạnh nhau. Popover render qua portal + toạ độ fixed (giống RowActionsMenu) để không bị cắt
// bởi vùng cuộn/overflow của thanh công cụ.
//
// Bên trong vẫn là DatePicker sẵn có của dự án (chọn MỘT ngày) — không thêm thư viện lịch mới;
// popover chỉ gom hai bộ chọn + vài mốc nhanh vào một chỗ và chỉ áp dụng khi bấm "Áp dụng".

const PANEL_WIDTH = 320;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Mốc nhanh: n ngày gần nhất tính CẢ hôm nay. */
function lastDays(days: number): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  return { from: iso(start), to: iso(today) };
}

function thisMonth(): { from: string; to: string } {
  const today = new Date();
  return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
}

export default function DateRangePill({
  value,
  onChange,
}: {
  value: { from: string; to: string };
  onChange: (range: { from: string; to: string }) => void;
}) {
  const { t, brandGradient } = useApp();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Mở lại thì luôn bắt đầu từ khoảng đang áp dụng, không giữ bản nháp dở của lần trước.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value.from, value.to]);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setCoords({
      top: r.bottom + 6,
      left: Math.max(8, Math.min(r.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8)),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      // DatePicker tự render lịch qua portal riêng — bấm vào lịch không được coi là bấm ra ngoài.
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

  const apply = (next: { from: string; to: string }) => {
    onChange(next);
    setOpen(false);
  };

  const presetBtn = (label: string, range: { from: string; to: string }) => (
    <button
      key={label}
      onClick={() => apply(range)}
      className="btn-soft"
      style={{
        border: '1px solid #ece8f6', background: '#fff', borderRadius: 999, padding: '6px 12px',
        fontSize: 12, fontWeight: 700, color: '#5b5670', cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="btn-soft"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px',
          border: `1px solid ${open ? '#c4b5fd' : '#ece8f6'}`, borderRadius: 10,
          background: open ? '#f7f4ff' : '#fff',
          fontSize: 13, fontWeight: 700, color: '#4b4660', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <Calendar size={15} strokeWidth={1.8} color="#8b5cf6" />
        {formatDateVN(value.from)} - {formatDateVN(value.to)}
        <ChevronDown size={14} strokeWidth={2} color="#a39bbf" />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`${t.apRangeFrom} – ${t.apRangeTo}`}
          className="menu-pop"
          style={{
            position: 'fixed', top: coords.top, left: coords.left, width: PANEL_WIDTH, zIndex: 1000,
            background: '#fff', border: '1px solid #ece8f6', borderRadius: 14, padding: 14,
            boxShadow: '0 24px 50px -22px rgba(80,40,140,.5)',
          }}
        >
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
            {presetBtn(t.apRangePreset7, lastDays(7))}
            {presetBtn(t.apRangePreset30, lastDays(30))}
            {presetBtn(t.apRangePresetMonth, thisMonth())}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#8a85a0' }}>{t.apRangeFrom}</label>
            <DatePicker
              value={draft.from} max={draft.to} ariaLabel={t.apRangeFrom}
              onChange={(from) => setDraft((d) => ({ ...d, from }))}
            />
            <label style={{ fontSize: 12, fontWeight: 700, color: '#8a85a0', marginTop: 4 }}>{t.apRangeTo}</label>
            <DatePicker
              value={draft.to} min={draft.from} ariaLabel={t.apRangeTo}
              onChange={(to) => setDraft((d) => ({ ...d, to }))}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={() => setOpen(false)}
              className="btn-soft"
              style={{
                flex: 1, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10,
                padding: '9px 0', fontSize: 13, fontWeight: 700, color: '#5b5670', cursor: 'pointer',
              }}
            >
              {t.close}
            </button>
            <button
              onClick={() => apply(draft)}
              disabled={!draft.from || !draft.to || draft.from > draft.to}
              style={{
                flex: 1, border: 'none', borderRadius: 10, padding: '9px 0', fontSize: 13, fontWeight: 700,
                color: '#fff', background: brandGradient,
                cursor: !draft.from || !draft.to || draft.from > draft.to ? 'default' : 'pointer',
                opacity: !draft.from || !draft.to || draft.from > draft.to ? 0.55 : 1,
              }}
            >
              {t.clFilterApply}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
