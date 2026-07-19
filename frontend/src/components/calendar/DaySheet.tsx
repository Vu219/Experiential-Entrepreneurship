import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet cho mobile (UI-07 redesign): danh sách lịch đăng của một ngày, hoặc thân form
 * (CreateScheduleModal mobile) với `footer` dính đáy (tóm tắt + nút hành động, không cuộn theo).
 * Cùng pattern focus trap / Esc / khóa scroll với components/Modal.tsx — không dùng chung vì
 * Modal căn giữa còn sheet neo đáy màn hình (như ErrorDetailModal của FailedPosts).
 */
export default function DaySheet({ title, subtitle, onClose, children, footer }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
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

  return createPortal(
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(26,18,48,.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="view-pop"
        style={{
          width: '100%', maxWidth: 560, background: '#fff', borderRadius: '22px 22px 0 0',
          boxShadow: '0 -20px 60px -20px rgba(60,30,110,.45)',
          maxHeight: '86vh', display: 'flex', flexDirection: 'column', position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, border: 'none', borderRadius: 9, background: '#f4f1fb', color: '#6b6680', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={16} strokeWidth={2} />
        </button>
        <div style={{ padding: '18px 16px 0', flex: 'none' }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: '#211c38', paddingRight: 34 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12.5, color: '#6b6680', marginTop: 4 }}>{subtitle}</div>}
        </div>
        <div style={{ padding: footer ? '14px 16px' : '14px 16px calc(18px + env(safe-area-inset-bottom))', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {children}
        </div>
        {footer && (
          <div style={{ flex: 'none', padding: '12px 16px calc(14px + env(safe-area-inset-bottom))', borderTop: '1px solid #efeaf8', background: '#fff' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
