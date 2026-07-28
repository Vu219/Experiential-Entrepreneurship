import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * Khuôn popover cho hàng công cụ trang Phân tích: portal ra body (không bị cắt bởi card cha),
 * neo dưới nút trigger, đóng khi Esc / click ngoài. Khác `admin/RowActionsMenu` ở chỗ **không đóng
 * khi cuộn** mà tính lại vị trí để panel luôn dính theo trigger.
 * Mobile dùng bottom sheet riêng (`FilterSheet`), không dùng component này.
 */
export default function FilterPopover({
  anchorRef,
  onClose,
  width,
  ariaLabel,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  width: number;
  ariaLabel: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      // Căn phải theo trigger, kẹp trong viewport để popover rộng không tràn mép trái/phải.
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
      setCoords({ top: r.bottom + 8, left });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchorRef, width]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    const focusTimer = setTimeout(() => panelRef.current?.querySelector<HTMLElement>('button')?.focus(), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      clearTimeout(focusTimer);
    };
  }, [anchorRef, onClose]);

  if (!coords) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="menu-pop"
      role="dialog"
      aria-label={ariaLabel}
      style={{
        position: 'fixed', top: coords.top, left: coords.left, width,
        maxHeight: `calc(100vh - ${coords.top + 16}px)`, overflowY: 'auto',
        background: '#fff', borderRadius: 16, border: '1px solid #efeaf8',
        boxShadow: '0 24px 50px -22px rgba(80,40,140,.5)', zIndex: 1000, padding: 14,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
