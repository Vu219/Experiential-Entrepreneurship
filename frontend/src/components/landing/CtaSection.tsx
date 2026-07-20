import { Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { CTA_BG } from '../../theme';
import { Reveal } from '../motion/Reveal';
import { CONTACT_EMAIL } from './LandingFooter';

// CTA cuối trang (redesign): eyebrow → tiêu đề → mô tả → 2 nút (chính + Đặt Demo)
// → hàng badge tin cậy. Nền gradient SÁNG theo brand + vài blob mờ ở góc để hoà
// vào trang; nút chính tái dùng đúng style nút hero (btn-grad + brandGradient),
// nút phụ nền trắng viền mảnh.
// Đã đăng nhập: nút chính đổi thành "Truy cập ngay" → dashboard (khỏi mời tạo tài khoản).
export default function CtaSection() {
  const { t, go, brandGradient } = useApp();
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();

  const badges = [t.ctaHint, t.ctaCancelAnytime];

  return (
    // contain: giới hạn phạm vi repaint trong section. translateZ(0): đẩy CTA lên
    // compositor layer riêng → khi FAQ phía trên giãn đẩy CTA xuống, cú dịch chuyển
    // chỉ RE-COMPOSITE (tái dùng texture gradient đã vẽ) thay vì repaint gradient mỗi
    // frame → hết giật khi mở item FAQ cuối. Dùng tiết chế: chỉ 1 element này.
    <section style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '0 18px 56px' : '0 28px 84px', contain: 'layout paint', transform: 'translateZ(0)' }}>
      <Reveal y={18}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, background: CTA_BG, padding: isMobile ? '44px 24px 36px' : '56px 60px 44px', textAlign: 'center' }}>
          {/* Blob mờ ở góc — điểm nhấn nền giống hero, không cản click (pointerEvents none) */}
          <div aria-hidden style={{ position: 'absolute', top: -60, left: -40, width: 220, height: 220, borderRadius: '50%', background: '#93C5FD', opacity: 0.35, filter: 'blur(64px)', pointerEvents: 'none' }} />
          <div aria-hidden style={{ position: 'absolute', bottom: -70, right: -40, width: 240, height: 240, borderRadius: '50%', background: '#F9A8D4', opacity: 0.4, filter: 'blur(72px)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, letterSpacing: '.03em', color: '#334155', boxShadow: '0 2px 8px -4px rgba(15,23,42,.15)' }}>
              ⚡ {t.ctaEyebrow}
            </div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 26 : 36, letterSpacing: '-.02em', margin: '16px 0 0', color: '#1E1B4B' }}>{t.ctaTitle}</h2>
            <p style={{ fontSize: isMobile ? 14.5 : 16.5, lineHeight: 1.6, color: '#475569', maxWidth: 560, margin: '12px auto 0' }}>{t.ctaSub}</p>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'center', alignItems: isMobile ? 'stretch' : 'center', gap: 12, marginTop: 26 }}>
              <button className="btn-grad" onClick={() => go(user ? 'dashboard' : 'register')} style={{ border: 'none', borderRadius: 14, padding: isMobile ? '13px 26px' : '15px 34px', fontWeight: 700, fontSize: isMobile ? 14.5 : 16, color: '#fff', background: brandGradient, boxShadow: '0 18px 34px -14px rgba(139,92,246,.65)', cursor: 'pointer' }}>
                {user ? t.ctaGoApp : t.ctaBtn}
              </button>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="cta-btn-demo"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: 14, padding: isMobile ? '12px 26px' : '13.5px 30px', fontWeight: 700, fontSize: isMobile ? 14.5 : 16, color: '#1e293b', background: '#fff', textDecoration: 'none', cursor: 'pointer' }}
              >
                {t.bookDemo}
              </a>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: isMobile ? 10 : 22, marginTop: 22 }}>
              {badges.map((b, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                  <Check size={14} strokeWidth={2.6} color="#7C3AED" />
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
