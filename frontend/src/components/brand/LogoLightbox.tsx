import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * Lightbox xem logo thương hiệu full size — mở khi bấm vào ảnh logo ở màn Xem hồ sơ.
 * Render qua portal (như Modal dùng chung) để overlay phủ toàn màn hình; đóng bằng
 * backdrop click / Esc / nút X.
 */
export default function LogoLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const { t } = useApp();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // Khoá cuộn nền khi lightbox mở (cùng cơ chế Modal).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(16,10,32,.78)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <button
        onClick={onClose}
        aria-label={t.close}
        title={t.close}
        style={{ position: 'absolute', top: 18, right: 18, width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        <X size={20} color="#fff" />
      </button>
      <img
        src={src}
        alt={alt}
        onMouseDown={(e) => e.stopPropagation()}
        className="view-pop"
        style={{ maxWidth: 'min(92vw, 720px)', maxHeight: '82vh', objectFit: 'contain', borderRadius: 18, background: '#fff', boxShadow: '0 32px 80px -24px rgba(0,0,0,.6)' }}
      />
    </div>,
    document.body,
  );
}
