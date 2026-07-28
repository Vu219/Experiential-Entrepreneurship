import type { ReactNode } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';

/**
 * Khung 2 cột dùng chung cho CẢ 5 bước wizard — độ rộng cột nhất quán để không
 * giật layout khi chuyển bước.
 * - Desktop (>1024): trái 1.2fr (nội dung thao tác) / phải .9fr (panel phụ trợ).
 * - Tablet (760–1024): 1 cột, panel phụ trợ xuống dưới nội dung.
 *
 * Cột phải chia hai tầng:
 * - `side` — cuộn bình thường (thông tin nguồn, brand voice: xem một lần rồi thôi).
 * - `sideSticky` — từ khối này TRỞ XUỐNG dính theo màn hình khi cuộn (xem trước bài đăng,
 *   trạng thái, nút hành động), để lúc sửa nội dung ở cột trái vẫn thấy bài sắp đăng.
 *   Bản cũ cho dính CẢ cột phải nên khi cột đó cao hơn màn hình thì phần dưới (đúng chỗ có
 *   preview) không bao giờ dính được. Lưới để `stretch` để cột phải cao bằng cột trái —
 *   sticky cần khoảng trống dưới mới trượt theo được.
 *
 * Nút hành động chính của bước có hai chỗ:
 * - `action` — thanh NEO ĐÁY màn (mốc 1/2).
 * - `sideAction` — nằm ngay dưới khối dính của cột phải (mốc 3: thanh neo đáy khiến card dài
 *   lêu nghêu). Khi xuống một cột (mobile/tablet) nó tự quay về thanh neo đáy cho dễ bấm.
 */
export default function StepLayout({
  main,
  side,
  sideSticky,
  action,
  sideAction,
}: {
  main: ReactNode;
  side?: ReactNode;
  sideSticky?: ReactNode;
  /** Cụm nút hành động chính của bước — hiển thị trong thanh sticky đáy màn. */
  action?: ReactNode;
  /** Cụm nút gắn dưới khối dính của cột phải trên desktop (mobile vẫn về thanh neo đáy). */
  sideAction?: ReactNode;
}) {
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;

  const bottomAction = action ?? (stacked ? sideAction : undefined);
  const pinned = !stacked && sideAction ? (
    <>
      {sideSticky}
      {sideAction}
    </>
  ) : (
    sideSticky
  );

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.2fr .9fr', gap: 20, alignItems: stacked ? 'start' : 'stretch' }}>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>{main}</div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {side}
          {pinned && (
            <div
              style={{
                display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0,
                position: stacked ? 'static' : 'sticky', top: 98,
                // Khối dính cao hơn màn hình thì cuộn TRONG nó — không để nút hành động
                // ở đáy khối rơi ra ngoài vùng nhìn thấy.
                maxHeight: stacked ? undefined : 'calc(100vh - 110px)',
                overflowY: stacked ? undefined : 'auto',
              }}
            >
              {pinned}
            </div>
          )}
        </div>
      </div>
      {bottomAction && (
        <div style={{ position: 'sticky', bottom: 8, zIndex: 20, background: '#fff', border: '1px solid #efeaf8', borderRadius: 14, padding: 10, boxShadow: '0 10px 30px -12px rgba(80,40,140,.35)' }}>
          {/* Desktop: cụm nút neo phải với bề rộng vừa tay — không kéo nút Tiếp tục dài hết trang */}
          <div style={{ maxWidth: isMobile ? '100%' : 460, marginLeft: 'auto' }}>{bottomAction}</div>
        </div>
      )}
    </>
  );
}
