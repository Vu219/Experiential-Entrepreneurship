import { Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useLandingContent } from '../../hooks/useLandingContent';
import { tr } from '../../api/landing';
import { Reveal } from '../motion/Reveal';
import LandingLink from './LandingLink';
import { C } from '../../styles/colors';

// CTA cuối trang (nội dung từ admin): badge → tiêu đề → mô tả → 2 nút → hàng checkmark.
// Nền gradient theo chế độ hiển thị + 2 blob màu ở góc; nút chính tái dùng style nút hero
// (btn-grad + brandGradient), nút phụ nền trắng viền mảnh.
// Đã đăng nhập: nút chính đổi thành "Truy cập ngay" → dashboard (khỏi mời tạo tài khoản).
export default function CtaSection() {
  const { t, lang, brandGradient } = useApp();
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const { cta } = useLandingContent();

  const btnBase = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, fontWeight: 700, fontSize: isMobile ? 14.5 : 16, textDecoration: 'none', cursor: 'pointer' } as const;

  return (
    <section style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '0 18px 56px' : '0 28px 84px' }}>
      {/* once: FAQ phía trên giãn/co đẩy CTA qua lại ngưỡng viewport — không được fade lại. */}
      <Reveal y={18} once>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, background: C.landingCta, padding: isMobile ? '44px 24px 36px' : '56px 60px 44px', textAlign: 'center' }}>
          {/* Blob mờ ở góc = radial-gradient (KHÔNG dùng filter: blur — blur 64–72px phải vẽ lại
              mỗi frame khi FAQ đẩy CTA di chuyển, gây giật). Không cản click. */}
          <div aria-hidden style={{ position: 'absolute', top: -120, left: -110, width: 360, height: 360, background: C.landingCtaGlowBlue, pointerEvents: 'none' }} />
          <div aria-hidden style={{ position: 'absolute', bottom: -130, right: -110, width: 380, height: 380, background: C.landingCtaGlowPink, pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.surface, border: `1px solid ${C.legacyBordere2e8f0}`, borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, letterSpacing: '.03em', color: C.landingCtaSmall, boxShadow: `0 2px 8px -4px ${C.legacyShadowrgba152342_15_}` }}>
              ⚡ {tr(cta.badge, lang)}
            </div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 26 : 36, letterSpacing: '-.02em', margin: '16px 0 0', color: C.landingCtaTitle }}>{tr(cta.title, lang)}</h2>
            <p style={{ fontSize: isMobile ? 14.5 : 16.5, lineHeight: 1.6, color: C.landingCtaText, maxWidth: 560, margin: '12px auto 0' }}>{tr(cta.subtitle, lang)}</p>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'center', alignItems: isMobile ? 'stretch' : 'center', gap: 12, marginTop: 26 }}>
              <LandingLink
                href={user ? '/dashboard' : cta.primaryCta.href}
                className="btn-grad"
                style={{ ...btnBase, border: 'none', padding: isMobile ? '13px 26px' : '15px 34px', color: C.onBrand, background: brandGradient, boxShadow: `0 18px 34px -14px ${C.legacyShadowrgba13992246_65_}` }}
              >
                {user ? t.ctaGoApp : tr(cta.primaryCta.label, lang)}
              </LandingLink>
              <LandingLink
                href={cta.secondaryCta.href}
                className="cta-btn-demo"
                style={{ ...btnBase, border: `1px solid ${C.legacyBordere2e8f0}`, padding: isMobile ? '12px 26px' : '13.5px 30px', color: C.landingCtaButton, background: C.surface }}
              >
                {tr(cta.secondaryCta.label, lang)}
              </LandingLink>
            </div>
            {cta.checks.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: isMobile ? 10 : 22, marginTop: 22 }}>
                {cta.checks.map((b, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: C.landingCtaSmall }}>
                    <Check size={14} strokeWidth={2.6} color={C.primary} />
                    {tr(b, lang)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
