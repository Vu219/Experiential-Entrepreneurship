import { useIsDark } from '../../hooks/useIsDark';
import { useState } from 'react';
import { Mail, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useLandingContent } from '../../hooks/useLandingContent';
import { tr } from '../../api/landing';
import { validEmail } from '../../validations/authValidation';
import LandingLink from './LandingLink';
import { SocialIcon, socialLabel } from './landingIcons';
import { C } from '../../styles/colors';

// Footer Landing (dùng chung với /pricing) — mô tả, email, mạng xã hội, các cột link và
// đoạn giới thiệu bản tin do admin quản lý. Link "/#id" hoạt động cả khi đang ở trang khác
// (LandingLink điều hướng về "/#id" rồi LandingPage tự cuộn tới section theo hash).
export default function LandingFooter() {
  const isDark = useIsDark();
  const { t, lang, brandGradient, toggleLang } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;
  const { footer } = useLandingContent();
  const linkStyle = { cursor: 'pointer', fontSize: 14, color: C.textSecondary, textDecoration: 'none' } as const;
  const legalLinkStyle = { fontSize: 13, color: C.textMuted, textDecoration: 'none' } as const;

  // Đăng ký nhận tin — chỉ xác nhận phía FE, chưa có endpoint newsletter.
  const [nlEmail, setNlEmail] = useState('');
  const [nlState, setNlState] = useState<'idle' | 'done' | 'invalid'>('idle');
  const subscribeNews = () => {
    if (!validEmail(nlEmail.trim())) {
      setNlState('invalid');
      return;
    }
    setNlState('done');
  };

  return (
    <footer id="resources" className="scroll-anchor" style={{ position: 'relative', zIndex: 1, borderTop: `1px solid ${C.border}`, background: C.landingFooter, overflow: 'hidden' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '48px 24px 104px' : '64px 28px 30px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(2,1fr)' : `1.7fr ${'1fr '.repeat(footer.columns.length)}1.4fr`, gap: isMobile ? 28 : 34, textAlign: 'left', justifyItems: 'stretch' }}>
          {/* Brand */}
          <div style={{ gridColumn: stacked ? '1 / -1' : undefined }}>
            <img src={isDark ? "/aima-v-dark.png" : "/aima-logo.png"} alt="AIMA" style={{ height: 44, width: 'auto', display: 'block' }} />
            <p style={{ fontSize: 14, lineHeight: 1.65, color: C.textSecondary, maxWidth: 300, margin: '18px 0 0' }}>{tr(footer.description, lang)}</p>
            <a className="link-underline" href={`mailto:${footer.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 14, color: C.textSecondary, textDecoration: 'none' }}>
              <Mail size={16} color={C.violetLight} strokeWidth={1.8} />
              {footer.email}
            </a>
            {footer.socials.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
                {footer.socials.map((so, i) => (
                  <div key={i} className="social-item" data-social={so.platform}>
                    <a href={so.url} target="_blank" rel="noopener noreferrer" aria-label={socialLabel(so.platform)} className="social-icon">
                      <span className="social-fill" />
                      <SocialIcon platform={so.platform} />
                    </a>
                    <span className="social-tip">{socialLabel(so.platform)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {footer.columns.map((col, ci) => (
            <div key={ci}>
              <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 14, color: C.textStrong, marginBottom: 16 }}>{tr(col.title, lang)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {col.links.map((ln, li) => (
                  <LandingLink key={li} href={ln.href} className="link-underline" style={linkStyle}>{tr(ln.label, lang)}</LandingLink>
                ))}
              </div>
            </div>
          ))}

          {/* Đăng ký nhận tin */}
          <div style={{ gridColumn: isMobile ? '1 / -1' : undefined }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 14, color: C.textStrong, marginBottom: 10 }}>{t.ftNews}</div>
            {tr(footer.newsletterText, lang) && (
              <div style={{ fontSize: 13, lineHeight: 1.55, color: C.textSecondary, marginBottom: 14, maxWidth: 280 }}>{tr(footer.newsletterText, lang)}</div>
            )}
            {nlState === 'done' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.successSoft, border: `1px solid ${C.legacyBorderbfe8cd}`, borderRadius: 12, padding: '12px 14px', width: '100%', maxWidth: isMobile ? '100%' : 300, fontSize: 13.5, fontWeight: 600, color: C.legacyText15803d }}>
                {t.ftNewsDone}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: C.surface, border: `1px solid ${nlState === 'invalid' ? C.inputErrorBorder : C.border}`, borderRadius: 12, padding: '5px 5px 5px 14px', width: '100%', maxWidth: isMobile ? '100%' : 300, boxShadow: `0 10px 24px -18px ${C.legacyShadowrgba8040140_5_}` }}>
                  <input
                    type="email"
                    value={nlEmail}
                    onChange={(e) => { setNlEmail(e.target.value); if (nlState === 'invalid') setNlState('idle'); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') subscribeNews(); }}
                    placeholder={t.ftEmailPh}
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: C.ink750, minWidth: 0 }}
                  />
                  <button className="btn-grad" onClick={subscribeNews} style={{ border: 'none', borderRadius: 9, padding: '10px 16px', fontWeight: 700, fontSize: 13, color: C.onBrand, background: brandGradient, cursor: 'pointer', whiteSpace: 'nowrap' }}>{t.ftSubscribe}</button>
                </div>
                {nlState === 'invalid' && (
                  <div style={{ fontSize: 12.5, color: C.legacyTextd6336c, marginTop: 8 }}>{t.ftNewsInvalid}</div>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ height: 1, background: C.border, margin: '44px 0 22px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'space-between', gap: isMobile ? 18 : 16, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row', textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 12 : 18, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
            <button className="btn-soft" onClick={toggleLang} style={{ display: 'flex', alignItems: 'center', gap: 7, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: C.ink650, cursor: 'pointer' }}>
              <Globe size={15} color={C.violetLight} strokeWidth={1.8} />
              {t.langLabel}
            </button>
            <span style={{ fontSize: 13, color: C.textMuted }}>{t.ftRights}</span>
          </div>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
            <LandingLink href="/terms" className="link-underline" style={legalLinkStyle}>{t.ftTerms}</LandingLink>
            <LandingLink href="/privacy" className="link-underline" style={legalLinkStyle}>{t.ftPrivacy}</LandingLink>
            <LandingLink href="/data-deletion" className="link-underline" style={legalLinkStyle}>{t.ftDataDeletion}</LandingLink>
            <span className="link-underline" style={{ cursor: 'pointer', fontSize: 13, color: C.textMuted }}>{t.ftCookie}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
