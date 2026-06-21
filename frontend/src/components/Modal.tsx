import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Centered modal overlay used by the profile security / delete-account flows.
 * Backdrop click and Esc close it. Width adapts to mobile via max-width.
 */
export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 460,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // Khoá cuộn nền khi modal mở.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Render qua portal ở document.body để overlay không bị "nhốt" trong ancestor có transform
  // (vd .view-pop) — nhờ vậy nền mờ phủ toàn màn hình thay vì chỉ một vùng nhỏ.
  return createPortal(
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(26,18,48,.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="view-pop"
        style={{
          width: '100%', maxWidth, background: '#fff', borderRadius: 20,
          boxShadow: '0 40px 80px -30px rgba(60,30,110,.55)', padding: 26, position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, border: 'none', borderRadius: 9, background: '#f4f1fb', color: '#6b6680', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: '#211c38', paddingRight: 28 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13.5, color: '#6b6680', marginTop: 6 }}>{subtitle}</div>}
        <div style={{ marginTop: 18 }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
