import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';

const MENU_WIDTH = 208;

/**
 * Bộ lọc chọn-một dạng nút gọn ("Trạng thái ▾") thay cho `<select>` gốc — select gốc luôn rộng
 * bằng lựa chọn dài nhất nên chiếm chỗ trên header card. Chưa chọn: nút nhãn trung tính.
 * Đã chọn: chip tím hiện giá trị + nút × để bỏ lọc. Menu portal ra body (không bị vùng cuộn cắt),
 * đóng khi click ra ngoài / Esc / cuộn trang / chọn xong — cùng hành vi `RowActionsMenu`.
 */
export default function FilterMenu({
  label,
  allLabel,
  clearLabel,
  value,
  options,
  onChange,
}: {
  /** Nhãn nút khi chưa lọc, vd "Trạng thái". */
  label: string;
  /** Mục đầu menu để bỏ lọc, vd "Mọi trạng thái". */
  allLabel: string;
  /** aria-label của nút × trên chip. */
  clearLabel: string;
  /** '' = không lọc. */
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find(([v]) => v === value);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    setCoords({ top: r.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      close();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const pick = (v: string) => {
    setOpen(false);
    if (v !== value) onChange(v);
  };

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', height: 38, borderRadius: 10,
      border: `1px solid ${selected ? '#ddd0fb' : '#ece8f6'}`, background: selected ? '#f5f0ff' : '#fff',
    }}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: '100%', border: 'none',
          background: 'none', padding: selected ? '0 4px 0 12px' : '0 10px 0 12px', cursor: 'pointer',
          fontSize: 13.5, fontWeight: 600, color: selected ? '#6d28d9' : '#4b4660', whiteSpace: 'nowrap',
        }}
      >
        {selected ? selected[1] : label}
        {!selected && <ChevronDown size={15} strokeWidth={2} color="#a59fbb" />}
      </button>
      {selected && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onChange('')}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
            marginRight: 5, border: 'none', borderRadius: 7, background: 'none', color: '#8b5cf6', cursor: 'pointer',
          }}
        >
          <X size={14} strokeWidth={2.2} />
        </button>
      )}

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="menu-pop"
          style={{
            position: 'fixed', top: coords.top, left: coords.left, width: MENU_WIDTH, zIndex: 1000,
            background: '#fff', borderRadius: 12, border: '1px solid #ece8f6', padding: '6px 0',
            boxShadow: '0 24px 50px -22px rgba(80,40,140,.5)',
          }}
        >
          {[['', allLabel] as [string, string], ...options].map(([v, l]) => (
            <MenuItem key={v || '__all'} label={l} active={v === value} onPick={() => pick(v)} />
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function MenuItem({ label, active, onPick }: { label: string; active: boolean; onPick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitemradio"
      aria-checked={active}
      onClick={onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: '9px 14px', border: 'none', background: hover ? '#f7f6fd' : 'transparent', textAlign: 'left',
        fontSize: 13.5, fontWeight: active ? 700 : 600, color: active || hover ? '#7c3aed' : '#514b66', cursor: 'pointer',
      }}
    >
      {label}
      {active && <Check size={15} strokeWidth={2.2} />}
    </button>
  );
}
