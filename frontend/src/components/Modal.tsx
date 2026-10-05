import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { C } from '../styles/colors';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Centered modal overlay used by the profile security / delete-account flows.
 * Backdrop click and Esc close it. Width adapts to mobile via max-width; the
 * panel scrolls internally (max-height) so long forms never overflow the viewport.
 * Focus is trapped inside the panel and restored to the trigger on close.
 */
export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 460,
  animateScale = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  /** true → overlay fade + panel scale nhẹ (thay cho slide-up view-pop mặc định). */
  animateScale?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Focus trap: giữ Tab luẩn quẩn trong panel.
      if (e.key === 'Tab' && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    // Khoá cuộn nền khi modal mở.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Đưa focus vào phần tử đầu tiên trong panel.
    const focusTimer = setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(focusTimer);
      prevFocused?.focus?.();
    };
  }, [onClose]);

  // Render qua portal ở document.body để overlay không bị "nhốt" trong ancestor có transform
  // (vd .view-pop) — nhờ vậy nền mờ phủ toàn màn hình thay vì chỉ một vùng nhỏ.
  return createPortal(
    <div
      onMouseDown={onClose}
      className={animateScale ? 'modal-fade-in' : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: C.modalOverlay, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={animateScale ? 'modal-scale-in' : 'view-pop'}
        style={{
          width: '100%', maxWidth, background: C.surface, borderRadius: 20,
          boxShadow: C.shadowModal, padding: 26, position: 'relative',
          maxHeight: 'calc(100vh - 36px)', overflowY: 'auto',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, border: 'none', borderRadius: 9, background: C.surfaceMuted, color: C.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={16} strokeWidth={2} />
        </button>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: C.textStrong, paddingRight: 28 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13.5, color: C.textSecondary, marginTop: 6 }}>{subtitle}</div>}
        <div style={{ marginTop: 18 }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
