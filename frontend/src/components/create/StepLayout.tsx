import { useEffect, useRef, type ReactNode } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';

/** Mốc top của khối dính cột phải (ngay dưới topbar 70px + khoảng thở). */
const STICKY_TOP = 88;

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
 * - `sideFooter` — phần phụ đặt DƯỚI CÙNG khối dính, sau cụm nút (mốc 3: tóm tắt nguồn + brand voice thu gọn).
 * - `actionWide` — thanh neo đáy trải hết chiều ngang (mốc 4: "Quay lại" bên trái, nút chính bên phải).
 * - `wideMain` — cột trái rộng hơn (mốc 4: card từng nền tảng chiếm phần lớn chiều ngang, cột phải chỉ preview).
 */
export default function StepLayout({
  main,
  side,
  sideSticky,
  action,
  sideAction,
  sideFooter,
  actionWide = false,
  wideMain = false,
}: {
  main: ReactNode;
  side?: ReactNode;
  sideSticky?: ReactNode;
  /** Cụm nút hành động chính của bước — hiển thị trong thanh sticky đáy màn. */
  action?: ReactNode;
  /** Cụm nút gắn dưới khối dính của cột phải trên desktop (mobile vẫn về thanh neo đáy). */
  sideAction?: ReactNode;
  sideFooter?: ReactNode;
  actionWide?: boolean;
  wideMain?: boolean;
}) {
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;
  const pinnedRef = useRef<HTMLDivElement>(null);

  // Khối dính cao tối đa đúng phần còn lại của màn hình tính từ vị trí THẬT của nó: lúc chưa cuộn tới mốc top
  // (khối còn nằm thấp hơn 88px) mà dùng calc(100vh - …) cố định thì đáy khối — chỗ có cụm nút — tràn khỏi màn.
  useEffect(() => {
    const el = pinnedRef.current;
    if (!el || stacked) return;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = Math.max(STICKY_TOP, el.getBoundingClientRect().top);
        el.style.maxHeight = `${Math.max(240, window.innerHeight - top - 12)}px`;
      });
    };
    fit();
    window.addEventListener('scroll', fit, { passive: true });
    window.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', fit);
      window.removeEventListener('resize', fit);
      el.style.maxHeight = '';
    };
  }, [stacked]);

  const bottomAction = action ?? (stacked ? sideAction : undefined);
  const pinned = (!stacked && sideAction) || sideFooter ? (
    <>
      {sideSticky}
      {!stacked && sideAction && (
        // Khối dính cao hơn màn hình (cuộn bên trong) thì cụm nút vẫn bám đáy vùng nhìn thấy, không bị đẩy khuất.
        <div style={{ position: 'sticky', bottom: 0, zIndex: 2, background: '#fff', border: '1px solid #efeaf8', borderRadius: 16, padding: 12, boxShadow: '0 -8px 24px -14px rgba(80,40,140,.35)' }}>
          {sideAction}
        </div>
      )}
      {sideFooter}
    </>
  ) : (
    sideSticky
  );

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : wideMain ? '1.55fr .85fr' : '1.2fr .9fr', gap: 20, alignItems: stacked ? 'start' : 'stretch' }}>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>{main}</div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {side}
          {pinned && (
            <div
              ref={pinnedRef}
              style={{
                // Grid max-content (không dùng flex column): khối bị giới hạn chiều cao thì card con có overflow hidden
                // (tóm tắt nguồn / brand voice) KHÔNG bị co về 0 — phần dư cuộn bên trong.
                display: 'grid', gridAutoRows: 'max-content', gap: 18, minWidth: 0,
                position: stacked ? 'static' : 'sticky', top: STICKY_TOP,
                // Khối dính cao hơn màn hình thì cuộn TRONG nó (maxHeight đặt ở effect phía trên) — không để
                // nút hành động ở đáy khối rơi ra ngoài vùng nhìn thấy.
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
          <div style={{ maxWidth: isMobile || actionWide ? '100%' : 460, marginLeft: 'auto' }}>{bottomAction}</div>
        </div>
      )}
    </>
  );
}
