import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBreakpoint } from '../../hooks/useBreakpoint';

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
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(26,18,48,.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="view-pop"
        style={{ width: isMobile ? '100%' : 'min(100%, ' + width + 'px)', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-30px 0 80px -30px rgba(80,40,140,.5)' }}
      >
        <div style={{ flex: 'none', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 24px', borderBottom: '1px solid #f1eef8' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: '#211c38' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: '#8a85a0', marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ flex: 'none', width: 34, height: 34, border: 'none', borderRadius: 9, background: '#f4f1fb', color: '#6b6680', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px 24px' }}>{children}</div>

        {footer && <div style={{ flex: 'none', display: 'flex', gap: 10, padding: '16px 24px', borderTop: '1px solid #f1eef8' }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
