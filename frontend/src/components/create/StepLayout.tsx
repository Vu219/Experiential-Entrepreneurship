import type { ReactNode } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';

/**
 * Khung 2 cột dùng chung cho CẢ 5 bước wizard — độ rộng cột nhất quán để không
 * giật layout khi chuyển bước.
 * - Desktop (>1024): trái 1.2fr (nội dung thao tác) / phải .9fr (panel phụ trợ, sticky).
 * - Tablet (760–1024): 1 cột, panel phụ trợ xuống dưới nội dung.
 * - Mobile (<760): 1 cột; nút hành động chính nổi ở thanh sticky đáy màn cho dễ bấm.
 */
export default function StepLayout({
  main,
  side,
  action,
}: {
  main: ReactNode;
  side?: ReactNode;
  /** Nút hành động chính của bước (Tiếp tục / Lưu) — desktop nằm cuối cột phải, mobile dính đáy. */
  action?: ReactNode;
}) {
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.2fr .9fr', gap: 20, alignItems: 'start' }}>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>{main}</div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18, position: stacked ? 'static' : 'sticky', top: 98 }}>
          {side}
          {!isMobile && action}
        </div>
      </div>
      {isMobile && action && (
        <div style={{ position: 'sticky', bottom: 8, zIndex: 20, background: '#fff', border: '1px solid #efeaf8', borderRadius: 14, padding: 10, boxShadow: '0 10px 30px -12px rgba(80,40,140,.35)' }}>
          {action}
        </div>
      )}
    </>
  );
}
