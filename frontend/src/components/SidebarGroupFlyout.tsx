import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Icon } from './ui';
import type { Route } from '../types';

export interface FlyoutItem {
  key: Route;
  label: string;
  icon: LucideIcon;
}

/** Khoảng cách flyout ↔ mép phải sidebar, và lề tối thiểu với mép màn hình. */
const GAP = 8;
const EDGE = 8;

/**
 * Một nhóm của sidebar admin ở trạng thái THU GỌN: chỉ một icon đại diện, mục con nằm
 * trong flyout nổi bên phải sidebar. Flyout portal ra body (vùng cuộn .sb-scroll cắt
 * overflow) và tự đẩy lên khi nhóm nằm thấp. Trạng thái mở do Sidebar giữ (một flyout
 * tại một thời điểm, trễ đóng khi rời chuột) — component chỉ báo lại qua callback.
 */
export default function SidebarGroupFlyout({
  id, label, icon, items, route, open, triggerStyle, brandGradient, anchorRef,
  onOpen, onClose, onCancelClose, onNavigate,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  items: FlyoutItem[];
  route: Route;
  open: boolean;
  /** Style nút icon (itemBase của Sidebar) — để nút nhóm trông y hệt các mục khác. */
  triggerStyle: (active: boolean) => CSSProperties;
  brandGradient: string;
  /** Sidebar (aside) — flyout neo theo mép phải của nó. */
  anchorRef: RefObject<HTMLElement>;
  onOpen: () => void;
  /** delay > 0 = hẹn đóng (rời chuột), để kịp di chuột từ icon sang flyout. */
  onClose: (delay?: number) => void;
  onCancelClose: () => void;
  onNavigate: (key: Route) => void;
}) {
  const active = items.some((i) => i.key === route);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Mở bằng bàn phím → focus vào mục đầu/cuối ngay khi flyout hiện.
  const focusOnOpen = useRef<'first' | 'last' | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [hi, setHi] = useState(-1);
  const menuId = `sb-flyout-${id}`;

  const menuItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useLayoutEffect(() => {
    if (!open) { setCoords(null); setHi(-1); return; }
    const t = triggerRef.current?.getBoundingClientRect();
    const a = anchorRef.current?.getBoundingClientRect();
    const h = menuRef.current?.offsetHeight ?? 0;
    if (!t) return;
    const top = Math.max(EDGE, Math.min(t.top - 6, window.innerHeight - h - EDGE));
    setCoords({ top, left: (a?.right ?? t.right) + GAP });
  }, [open, anchorRef]);

  // Focus sau khi đã định vị: lúc đo, flyout còn visibility hidden nên chưa focus được.
  useEffect(() => {
    if (!coords || !focusOnOpen.current) return;
    const list = menuItems();
    (focusOnOpen.current === 'first' ? list[0] : list[list.length - 1])?.focus();
    focusOnOpen.current = null;
  }, [coords]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const inside = menuRef.current?.contains(document.activeElement);
      onClose();
      if (inside) triggerRef.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    };
    const onResize = () => onClose();
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open, onClose]);

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusOnOpen.current = e.key === 'ArrowUp' ? 'last' : 'first';
      if (open) {
        const list = menuItems();
        (e.key === 'ArrowUp' ? list[list.length - 1] : list[0])?.focus();
        focusOnOpen.current = null;
      } else {
        onOpen();
      }
    }
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const list = menuItems();
    const idx = list.indexOf(document.activeElement as HTMLElement);
    const move = (i: number) => { e.preventDefault(); list[(i + list.length) % list.length]?.focus(); };
    if (e.key === 'ArrowDown') move(idx + 1);
    else if (e.key === 'ArrowUp') move(idx - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(list.length - 1);
    else if (e.key === 'Tab') {
      // Trả focus về icon nhóm rồi để Tab mặc định đi tiếp từ đó (flyout nằm cuối body).
      onClose();
      triggerRef.current?.focus();
    }
  };

  return (
    <>
      <motion.button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={onOpen}
        onKeyDown={onTriggerKey}
        onMouseEnter={onOpen}
        onMouseLeave={() => onClose(150)}
        style={{ ...triggerStyle(active), ...(open && !active ? { background: '#f6f3fc' } : null) }}
        whileHover={{
          y: -2,
          scale: 1.03,
          boxShadow: active ? '0 12px 24px -10px rgba(139,92,246,.95)' : '0 8px 16px -8px rgba(124,92,255,.25)',
          background: active ? brandGradient : '#f6f3fc',
        }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', mass: 0.1, stiffness: 200, damping: 15 }}
      >
        <Icon icon={icon} stroke={active ? '#fff' : open ? '#7c3aed' : '#9b94b5'} />
      </motion.button>

      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={`${menuId}-label`}
          onKeyDown={onMenuKey}
          onMouseEnter={onCancelClose}
          onMouseLeave={() => onClose(150)}
          className="menu-pop menu-pop--left"
          style={{
            position: 'fixed', top: coords?.top ?? 0, left: coords?.left ?? 0,
            visibility: coords ? 'visible' : 'hidden',
            // Trên Topbar (40) và aside (41); dưới modal/overlay (≥1000).
            zIndex: 60, minWidth: 220, maxWidth: 280,
            background: '#fff', border: '1px solid #ece8f6', borderRadius: 14, padding: 6,
            boxShadow: '0 24px 50px -22px rgba(80,40,140,.5)',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}
        >
          <div
            id={`${menuId}-label`}
            style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', color: '#3f3a55', padding: '8px 10px 6px' }}
          >
            {label}
          </div>
          {items.map((n, i) => {
            const itemActive = route === n.key;
            return (
              <button
                key={n.key}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-current={itemActive ? 'page' : undefined}
                onClick={() => { onClose(); onNavigate(n.key); }}
                onMouseEnter={() => setHi(i)}
                onMouseLeave={() => setHi(-1)}
                onFocus={() => setHi(i)}
                onBlur={() => setHi(-1)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', whiteSpace: 'nowrap',
                  border: 'none', borderRadius: 10, padding: '9px 10px', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, outline: 'none',
                  background: itemActive ? brandGradient : hi === i ? '#f6f3fc' : 'transparent',
                  color: itemActive ? '#fff' : hi === i ? '#6d28d9' : '#5b5670',
                  boxShadow: itemActive ? '0 12px 24px -14px rgba(139,92,246,.8)' : 'none',
                  transition: 'background .15s, color .15s',
                }}
              >
                <Icon icon={n.icon} size={18} stroke={itemActive ? '#fff' : hi === i ? '#7c3aed' : '#9b94b5'} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
