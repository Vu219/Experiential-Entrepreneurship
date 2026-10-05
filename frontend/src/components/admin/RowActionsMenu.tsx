import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { C } from '../../styles/colors';

export interface RowAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
}

const MENU_WIDTH = 208;

/**
 * Menu "3 chấm" (kebab) cho một hàng bảng Quản trị. Trigger là icon dọc; menu mở
 * ngay tại vị trí đó (portal ra body để không bị cắt bởi vùng cuộn của bảng).
 * Desktop/tablet: popover định vị dưới nút. Mobile: bottom-sheet full-width.
 * Đóng khi: click ra ngoài, phím Esc, cuộn trang, hoặc chọn một mục.
 */
export default function RowActionsMenu({ actions, ariaLabel }: { actions: RowAction[]; ariaLabel: string }) {
  const { isMobile } = useBreakpoint();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || isMobile) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    setCoords({ top: r.bottom + 6, left });
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    const focusTimer = setTimeout(() => menuRef.current?.querySelector<HTMLElement>('button')?.focus(), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      clearTimeout(focusTimer);
    };
  }, [open]);

  const runAction = (a: RowAction) => {
    setOpen(false);
    a.onClick();
  };

  const items = (big: boolean) => (
    <div role="menu" aria-label={ariaLabel}>
      {actions.map((a) => (
        <MenuButton key={a.key} action={a} big={big} onRun={() => runAction(a)} />
      ))}
    </div>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 32, height: 32, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${C.border}`, background: open ? C.primarySoft : C.surface, borderRadius: 9,
          color: open ? C.primaryStrong : C.ink550, cursor: 'pointer',
        }}
      >
        <MoreVertical size={17} strokeWidth={1.9} />
      </button>

      {open && createPortal(
        isMobile ? (
          <div
            onMouseDown={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: C.legacyBgrgba261848_42_, backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end' }}
          >
            <div
              ref={menuRef}
              onMouseDown={(e) => e.stopPropagation()}
              className="view-pop"
              style={{ width: '100%', background: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '8px 0 14px', boxShadow: `0 -22px 50px -18px ${C.legacyShadowrgba6030110_5_}` }}
            >
              <div aria-hidden style={{ width: 40, height: 4, borderRadius: 999, background: C.border, margin: '4px auto 8px' }} />
              {items(true)}
            </div>
          </div>
        ) : (
          <div
            ref={menuRef}
            className="menu-pop"
            style={{
              position: 'fixed', top: coords.top, left: coords.left, width: MENU_WIDTH,
              background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
              boxShadow: `0 24px 50px -22px ${C.legacyShadowrgba8040140_5_}`, overflow: 'hidden', zIndex: 1000, padding: '6px 0',
            }}
          >
            {items(false)}
          </div>
        ),
        document.body,
      )}
    </>
  );
}

function MenuButton({ action, big, onRun }: { action: RowAction; big: boolean; onRun: () => void }) {
  const [hover, setHover] = useState(false);
  const { danger } = action;
  return (
    <button
      role="menuitem"
      onClick={onRun}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        padding: big ? '14px 22px' : '10px 14px', border: 'none',
        background: hover ? (danger ? C.roseSoft : C.bg) : 'transparent',
        fontSize: big ? 15 : 13.5, fontWeight: 600, cursor: 'pointer',
        color: danger ? C.rose : hover ? C.primary : C.ink650, transition: 'background .15s, color .15s',
      }}
    >
      <span style={{ color: danger ? C.rose : C.ink350, display: 'flex', flex: 'none' }}>{action.icon}</span>
      {action.label}
    </button>
  );
}
