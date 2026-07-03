import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { validEmail } from '../../validations/authValidation';

export const CONTACT_EMAIL = 'aimarketing.aima@gmail.com';

// Footer Landing (tách từ LandingPage để /pricing dùng chung) + dải "Built with" nhỏ.
// Link section (#features…) hoạt động cả khi đang ở trang khác: điều hướng về "/#id"
// rồi LandingPage tự cuộn tới section theo hash.
export default function LandingFooter() {
  const { t, go, brandGradient, toggleLang } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const goSection = (id: string) => {
    if (pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate(`/#${id}`);
    }
  };

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

  const builtWith = ['React', 'TypeScript', 'Tailwind CSS'];

  return (
    <footer id="resources" className="scroll-anchor" style={{ position: 'relative', zIndex: 1, borderTop: '1px solid #ece7f6', background: 'linear-gradient(180deg,rgba(247,246,253,0),rgba(244,243,251,.92)),radial-gradient(820px 340px at 82% 130%,rgba(124,92,255,.12),transparent 60%),radial-gradient(620px 300px at 12% 120%,rgba(34,211,238,.10),transparent 60%),#fbfafe', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '48px 24px 104px' : '64px 28px 30px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(2,1fr)' : '1.7fr 1fr 1fr 1fr 1.4fr', gap: isMobile ? 28 : 34, textAlign: 'left', justifyItems: 'stretch' }}>
          {/* Brand */}
          <div style={{ gridColumn: stacked ? '1 / -1' : undefined }}>
            <img src="/aima-logo.png" alt="AIMA" style={{ height: 44, width: 'auto', display: 'block' }} />
            <p style={{ fontSize: 14, lineHeight: 1.65, color: '#6b6680', maxWidth: 300, margin: '18px 0 0' }}>{t.ftTagline}</p>
            <a className="link-underline" href={`mailto:${CONTACT_EMAIL}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 14, color: '#6b6680', textDecoration: 'none' }}>
              <Mail size={16} color="#8b5cf6" strokeWidth={1.8} />
              {CONTACT_EMAIL}
            </a>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              {[
                ['Facebook', 'facebook', 'M14 9h3V5.5h-3c-2.2 0-3.8 1.7-3.8 3.9V11H8v3.4h2.2V21h3.4v-6.6H16L16.5 11h-2.9V9.4c0-.3.2-.4.4-.4z'],
                ['Instagram', 'instagram', ''],
                ['LinkedIn', 'linkedin', 'M6.5 8.5A1.5 1.5 0 106.5 5.5a1.5 1.5 0 000 3zM5.2 10h2.6v9H5.2zM10 10h2.5v1.3c.4-.7 1.4-1.5 2.9-1.5 2.4 0 3.4 1.5 3.4 4.1V19h-2.6v-4.6c0-1.2-.4-2-1.5-2-.9 0-1.4.6-1.6 1.2-.1.2-.1.5-.1.8V19H10z'],
                ['YouTube', 'youtube', ''],
              ].map(([label, social, path]) => (
                <div key={label} className="social-item" data-social={social}>
                  <a aria-label={label} className="social-icon">
                    <span className="social-fill" />
                    {label === 'Instagram' ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" /></svg>
                    ) : label === 'YouTube' ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="6.5" width="18" height="11" rx="3.2" /><path d="M11 9.8l3.2 1.9-3.2 1.9z" fill="currentColor" stroke="none" /></svg>
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d={path} /></svg>
                    )}
                  </a>
                  <span className="social-tip">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sản phẩm */}
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 14, color: '#211c38', marginBottom: 16 }}>{t.ftProduct}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <a className="link-underline" href="/#features" onClick={(e) => { e.preventDefault(); goSection('features'); }} style={{ cursor: 'pointer', fontSize: 14, color: '#6b6680', textDecoration: 'none' }}>{t.ftFeatures}</a>
              <a className="link-underline" href="/pricing" onClick={(e) => { e.preventDefault(); go('pricing'); }} style={{ cursor: 'pointer', fontSize: 14, color: '#6b6680', textDecoration: 'none' }}>{t.ftPricing}</a>
              <a className="link-underline" onClick={() => go('login')} style={{ cursor: 'pointer', fontSize: 14, color: '#6b6680' }}>{t.ftDemo}</a>
              <a className="link-underline" onClick={() => go('register')} style={{ cursor: 'pointer', fontSize: 14, color: '#6b6680' }}>{t.ftTry}</a>
            </div>
          </div>

          {/* Tài nguyên */}
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 14, color: '#211c38', marginBottom: 16 }}>{t.ftResources}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <span className="link-underline" style={{ cursor: 'pointer', fontSize: 14, color: '#6b6680' }}>{t.ftBlog}</span>
              <span className="link-underline" style={{ cursor: 'pointer', fontSize: 14, color: '#6b6680' }}>{t.ftGuide}</span>
              <span className="link-underline" style={{ cursor: 'pointer', fontSize: 14, color: '#6b6680' }}>{t.ftDocs}</span>
            </div>
          </div>

          {/* Công ty */}
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 14, color: '#211c38', marginBottom: 16 }}>{t.ftCompany}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <span className="link-underline" style={{ cursor: 'pointer', fontSize: 14, color: '#6b6680' }}>{t.ftAbout}</span>
              <a className="link-underline" href={`mailto:${CONTACT_EMAIL}`} style={{ cursor: 'pointer', fontSize: 14, color: '#6b6680', textDecoration: 'none' }}>{t.ftContact}</a>
              <span className="link-underline" style={{ cursor: 'pointer', fontSize: 14, color: '#6b6680' }}>{t.ftCareers}</span>
            </div>
          </div>

          {/* Đăng ký nhận tin */}
          <div style={{ gridColumn: isMobile ? '1 / -1' : undefined }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 14, color: '#211c38', marginBottom: 10 }}>{t.ftNews}</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: '#6b6680', marginBottom: 14, maxWidth: 280 }}>{t.ftNewsSub}</div>
            {nlState === 'done' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#e8f8ee', border: '1px solid #bfe8cd', borderRadius: 12, padding: '12px 14px', width: '100%', maxWidth: isMobile ? '100%' : 300, fontSize: 13.5, fontWeight: 600, color: '#15803d' }}>
                {t.ftNewsDone}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fff', border: `1px solid ${nlState === 'invalid' ? '#f3aabf' : '#e6e2f2'}`, borderRadius: 12, padding: '5px 5px 5px 14px', width: '100%', maxWidth: isMobile ? '100%' : 300, boxShadow: '0 10px 24px -18px rgba(80,40,140,.5)' }}>
                  <input
                    type="email"
                    value={nlEmail}
                    onChange={(e) => { setNlEmail(e.target.value); if (nlState === 'invalid') setNlState('idle'); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') subscribeNews(); }}
                    placeholder={t.ftEmailPh}
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#2b2740', minWidth: 0 }}
                  />
                  <button className="btn-grad" onClick={subscribeNews} style={{ border: 'none', borderRadius: 9, padding: '10px 16px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer', whiteSpace: 'nowrap' }}>{t.ftSubscribe}</button>
                </div>
                {nlState === 'invalid' && (
                  <div style={{ fontSize: 12.5, color: '#d6336c', marginTop: 8 }}>{t.ftNewsInvalid}</div>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ height: 1, background: '#ece7f6', margin: '44px 0 22px' }} />

        {/* Dải "Built with" nhỏ — tách riêng khỏi section nền tảng tích hợp phía trên. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: '#8a85a0' }}>{t.builtWith}</span>
          {builtWith.map((tech, i) => (
            <span key={tech} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 600, color: '#6b6680' }}>
              {i > 0 && <span aria-hidden style={{ color: '#c9c2dd' }}>·</span>}
              {tech}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'space-between', gap: isMobile ? 18 : 16, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row', textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 12 : 18, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
            <button className="btn-soft" onClick={toggleLang} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #e6e2f2', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#4b4660', cursor: 'pointer' }}>
              <Globe size={15} color="#8b5cf6" strokeWidth={1.8} />
              {t.langLabel}
            </button>
            <span style={{ fontSize: 13, color: '#8a85a0' }}>{t.ftRights}</span>
          </div>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span className="link-underline" style={{ cursor: 'pointer', fontSize: 13, color: '#8a85a0' }}>{t.ftTerms}</span>
            <span className="link-underline" style={{ cursor: 'pointer', fontSize: 13, color: '#8a85a0' }}>{t.ftPrivacy}</span>
            <span className="link-underline" style={{ cursor: 'pointer', fontSize: 13, color: '#8a85a0' }}>{t.ftCookie}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
