import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { C } from '../../styles/colors';

/** Khoảng cách tối thiểu tới mép viewport / tới trigger. */
const EDGE = 16;
const GAP = 8;

/**
 * Khuôn popover cho hàng công cụ trang Phân tích: portal ra body (không bị cắt bởi card cha),
 * neo dưới nút trigger (tự lật lên trên khi thiếu chỗ), đóng khi Esc / click ngoài. Khác
 * `admin/RowActionsMenu` ở chỗ **không đóng khi cuộn** mà tính lại vị trí để panel luôn dính theo trigger.
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
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Căn MÉP PHẢI theo trigger (align end), rồi dịch/kẹp để panel luôn nằm trọn trong viewport
      // (cách mép EDGE px) — bề rộng cũng bị kẹp theo viewport, khớp `maxWidth` bên dưới.
      const w = Math.min(width, vw - EDGE * 2);
      const left = Math.max(EDGE, Math.min(r.right - w, vw - w - EDGE));
      // Lật lên trên trigger khi phía dưới không đủ chỗ và phía trên rộng hơn.
      const h = panelRef.current?.scrollHeight ?? 0;
      const below = vh - r.bottom - GAP - EDGE;
      const above = r.top - GAP - EDGE;
      if (h > below && above > below) {
        setCoords({ bottom: vh - r.top + GAP, left, maxHeight: above });
      } else {
        setCoords({ top: r.bottom + GAP, left, maxHeight: below });
      }
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

  return createPortal(
    <div
      ref={panelRef}
      className="menu-pop"
      role="dialog"
      aria-label={ariaLabel}
      style={{
        // Lượt render đầu chưa có toạ độ: vẽ ẩn để đo chiều cao rồi mới đặt vị trí (lật trên/dưới).
        position: 'fixed', top: coords?.top, bottom: coords?.bottom, left: coords?.left ?? 0,
        visibility: coords ? 'visible' : 'hidden',
        width, maxWidth: `calc(100vw - ${EDGE * 2}px)`,
        maxHeight: coords?.maxHeight, overflowY: 'auto',
        background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`,
        boxShadow: `0 24px 50px -22px ${C.legacyShadowrgba8040140_5_}`, zIndex: 1000, padding: 14,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
