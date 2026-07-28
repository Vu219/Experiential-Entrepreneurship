import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { cardStyle } from './ui';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export type DrawerVariant = 'docked' | 'overlay';

/**
 * Panel chi tiết dùng chung cho MỌI trang quản trị — không mang logic nghiệp vụ nào.
 * Khác `Modal` (căn giữa, hợp form ngắn) ở chỗ panel cao hết vùng chứa và cuộn được,
 * hợp với nội dung chi tiết dài.
 *
 * Hai biến thể, CÙNG một phần nội dung (children/footer do nơi gọi truyền vào — không nhân bản):
 *
 * - `docked` (màn hình rộng): panel là MỘT CỘT TRONG layout, đứng cạnh bảng. Không portal,
 *   không nền mờ, không khoá cuộn trang — người dùng vẫn bấm được sang hàng khác của bảng để
 *   đổi bài đang xem. Cũng KHÔNG bẫy focus, vì bẫy focus trong một panel không chặn tương tác
 *   sẽ giam bàn phím khỏi phần còn lại của trang.
 * - `overlay` (màn hình hẹp): như một drawer thật — portal ra body, nền mờ, khoá cuộn nền,
 *   bẫy focus, bấm nền/Esc để đóng. Dưới 760px rơi về bottom-sheet.
 *
 * Cả hai biến thể đều đóng bằng Esc và bằng nút ✕.
 */
export default function Drawer({
  title,
  icon,
  onClose,
  children,
  footer,
  variant = 'overlay',
  width = 420,
  stickyTop,
  stickyMaxHeight,
  closeLabel = 'Close',
}: {
  title: string;
  /** Icon nhỏ cạnh tiêu đề (tuỳ chọn). */
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  variant?: DrawerVariant;
  width?: number;
  /**
   * CHỈ dùng cho `docked`. Có giá trị → panel `position: sticky` và ĐI THEO khi cuộn danh sách
   * dài (người dùng không phải cuộn ngược lên để đọc chi tiết). Bỏ trống → panel cao bằng cả
   * hàng chứa nó như một cột thường.
   *
   * Đây là offset so với VÙNG CUỘN chứa panel, không phải so với viewport — nơi gọi tự biết
   * vùng cuộn của mình là gì (trong AppShell thì đó là `<main>`, đã nằm dưới topbar rồi).
   */
  stickyTop?: number;
  /** Chiều cao tối đa khi sticky; mặc định trừ theo viewport, nơi gọi có thể truyền chính xác hơn. */
  stickyMaxHeight?: string;
  closeLabel?: string;
}) {
  const { isMobile } = useBreakpoint();
  const panelRef = useRef<HTMLDivElement>(null);
  const overlay = variant === 'overlay';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Bẫy focus CHỈ ở chế độ overlay — xem giải thích ở đầu file.
      if (!overlay || e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    if (!overlay) {
      return () => window.removeEventListener('keydown', onKey);
    }

    const prevFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = setTimeout(() => panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus(), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(focusTimer);
      prevFocused?.focus?.();
    };
  }, [onClose, overlay]);

  const header = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, padding: '16px 18px',
      borderBottom: '1px solid #f1eef8', flex: 'none',
    }}>
      {icon}
      <div style={{ flex: 1, minWidth: 0, fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15.5, color: '#211c38' }}>
        {title}
      </div>
      <button
        onClick={onClose}
        aria-label={closeLabel}
        style={{
          width: 30, height: 30, flex: 'none', border: 'none', borderRadius: 9, background: '#f4f1fb',
          color: '#6b6680', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  );

  const body = <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px' }}>{children}</div>;
  const footerNode = footer && (
    <div style={{ flex: 'none', borderTop: '1px solid #f1eef8', padding: '13px 18px' }}>{footer}</div>
  );

  // ---- Docked: một cột trong layout, cao bằng hàng chứa nó (align-items: stretch của cha) ----
  if (!overlay) {
    return (
      <aside
        ref={panelRef}
        role="complementary"
        aria-label={title}
        className="drawer-slide-in"
        style={{
          ...cardStyle,
          padding: 0,
          width,
          flex: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          // sticky cần phần tử THẤP HƠN vùng chứa mới có chỗ trượt → phải bỏ alignSelf:stretch
          // và chặn chiều cao theo viewport, nếu không panel cao bằng hàng và đứng yên.
          ...(stickyTop === undefined
            ? { alignSelf: 'stretch' }
            : {
              position: 'sticky',
              top: stickyTop,
              alignSelf: 'flex-start',
              maxHeight: stickyMaxHeight ?? `calc(100vh - ${stickyTop + 24}px)`,
            }),
        }}
      >
        {header}
        {body}
        {footerNode}
      </aside>
    );
  }

  // ---- Overlay: drawer trượt phải (mobile: bottom-sheet) ----
  return createPortal(
    <div
      onMouseDown={onClose}
      className="modal-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(26,18,48,.42)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'stretch', justifyContent: 'flex-end',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={isMobile ? 'drawer-sheet-in' : 'drawer-slide-in'}
        style={{
          display: 'flex', flexDirection: 'column', background: '#fff',
          width: isMobile ? '100%' : width,
          maxWidth: '100%',
          height: isMobile ? '88vh' : '100%',
          borderTopLeftRadius: isMobile ? 22 : 20,
          borderBottomLeftRadius: isMobile ? 0 : 20,
          borderTopRightRadius: isMobile ? 22 : 0,
          boxShadow: '0 40px 80px -30px rgba(60,30,110,.55)',
        }}
      >
        {header}
        {body}
        {footerNode}
      </div>
    </div>,
    document.body,
  );
}
