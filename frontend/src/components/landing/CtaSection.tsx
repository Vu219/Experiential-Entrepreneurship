import { Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { CTA_BG, BRAND_GLOW } from '../../theme';
import { Reveal } from '../motion/Reveal';
import { CONTACT_EMAIL } from './LandingFooter';

// CTA cuối trang (redesign): eyebrow → tiêu đề → mô tả → 2 nút (chính + Đặt Demo)
// → hàng badge tin cậy. Nền indigo sâu + glow brand ở 2 góc để có chiều sâu; nút
// chính dùng dải brand để bật lên, nút phụ dạng ghost/viền.
export default function CtaSection() {
  const { t, go, brandGradient } = useApp();
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
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.25)', borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, letterSpacing: '.03em', color: '#fff' }}>
              ⚡ {t.ctaEyebrow}
            </div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 26 : 36, letterSpacing: '-.02em', margin: '16px 0 0', color: '#fff' }}>{t.ctaTitle}</h2>
            <p style={{ fontSize: isMobile ? 14.5 : 16.5, lineHeight: 1.6, color: 'rgba(255,255,255,.88)', maxWidth: 560, margin: '12px auto 0' }}>{t.ctaSub}</p>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'center', alignItems: isMobile ? 'stretch' : 'center', gap: 12, marginTop: 26 }}>
              <button className="btn-grad" onClick={() => go('register')} style={{ border: 'none', borderRadius: 14, padding: isMobile ? '13px 26px' : '15px 34px', fontWeight: 700, fontSize: isMobile ? 14.5 : 16, color: '#fff', background: brandGradient, boxShadow: `0 18px 36px -14px ${BRAND_GLOW}`, cursor: 'pointer' }}>
                {t.ctaBtn}
              </button>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="lift-card"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(255,255,255,.45)', borderRadius: 14, padding: isMobile ? '12px 26px' : '13.5px 30px', fontWeight: 700, fontSize: isMobile ? 14.5 : 16, color: '#fff', background: 'transparent', textDecoration: 'none', cursor: 'pointer' }}
              >
                {t.bookDemo}
              </a>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: isMobile ? 10 : 22, marginTop: 22 }}>
              {badges.map((b, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>
                  <Check size={14} strokeWidth={2.6} color="rgba(255,255,255,.9)" />
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
