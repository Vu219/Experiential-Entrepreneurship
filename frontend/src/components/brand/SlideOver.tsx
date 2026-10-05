import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { C } from '../../styles/colors';

/**
 * Panel trượt từ phải — dùng cho form Tạo/Sửa hồ sơ & xem hồ sơ (form dài, không
 * dùng modal vì cuộn khó chịu). Esc / click nền để đóng. Render qua portal ở body.
 */
export default function SlideOver({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 560,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: C.legacyBgrgba261848_5_, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="view-pop"
        style={{ width: isMobile ? '100%' : 'min(100%, ' + width + 'px)', height: '100%', background: C.surface, display: 'flex', flexDirection: 'column', boxShadow: `-30px 0 80px -30px ${C.legacyShadowrgba8040140_5_}` }}
      >
        <div style={{ flex: 'none', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 24px', borderBottom: `1px solid ${C.surfaceMuted}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: C.textStrong }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ flex: 'none', width: 34, height: 34, border: 'none', borderRadius: 9, background: C.surfaceMuted, color: C.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px 24px' }}>{children}</div>

        {footer && <div style={{ flex: 'none', display: 'flex', gap: 10, padding: '16px 24px', borderTop: `1px solid ${C.surfaceMuted}` }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
