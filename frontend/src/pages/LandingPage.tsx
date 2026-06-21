import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { GradIcon } from '../components/ui';
import AimaHero from '../components/AimaHero';
import LandingHeader from '../components/LandingHeader';
import { flowCards } from '../data';

const CONTACT_EMAIL = 'aimarketing.aima@gmail.com';

export default function LandingPage() {
  const { t, lang, go, brandGradient, toggleLang } = useApp();
  const { isMobile, isTablet, width } = useBreakpoint();
  const cards = flowCards(lang);
  const stacked = isMobile || isTablet;

  // LandingHeader (position: fixed) phải nằm NGOÀI khối .view-pop. Class view-pop
  // có animation dùng `transform`, mà ancestor có transform sẽ khiến position:fixed
  // bị neo theo phần tử đó (cuộn theo trang) thay vì theo viewport → header trôi mất.
  return (
    <>
      <LandingHeader />

      <div
        className="view-pop overflow-x-hidden"
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(1100px 600px at 80% -10%,rgba(217,70,239,.08),transparent 60%),radial-gradient(900px 600px at -5% 10%,rgba(34,211,238,.09),transparent 55%),#f9f8fd',
        }}
      >
        <section id="home" className="scroll-anchor" style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '96px 18px 44px' : '120px 28px 60px', display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.05fr .95fr', gap: stacked ? 28 : 40, alignItems: 'center' }}>
          <div className="min-w-0 max-w-full" style={{ textAlign: isMobile ? 'center' : 'left' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #ece8f7', borderRadius: 999, padding: '7px 15px', fontSize: 13, fontWeight: 600, color: '#7c3aed', boxShadow: '0 6px 18px -12px rgba(124,58,237,.5)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: brandGradient }} />
              {t.heroBadge}
            </div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: isMobile ? (width >= 640 ? 36 : 30) : 62, lineHeight: 1.06, letterSpacing: '-.02em', margin: '20px 0 0', color: '#171327', overflowWrap: 'break-word' }}>
              {t.heroT1}
              <br />
              <span className="gradtext">{t.heroT2}</span>
            </h1>
            <p style={{ fontSize: isMobile ? 16 : 18, lineHeight: 1.6, color: '#5b5670', maxWidth: 480, margin: isMobile ? '20px auto 0' : '22px 0 0', padding: isMobile ? '0 6px' : 0 }}>{t.heroSub}</p>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 14, marginTop: 34, flexWrap: 'wrap', alignItems: isMobile ? 'stretch' : 'center' }}>
              <button className="btn-grad" onClick={() => go('register')} style={{ border: 'none', borderRadius: 14, padding: isMobile ? '13px 20px' : '16px 30px', fontWeight: 700, fontSize: isMobile ? 14 : 16, color: '#fff', background: brandGradient, boxShadow: '0 18px 34px -14px rgba(139,92,246,.65)', cursor: 'pointer', width: isMobile ? '100%' : undefined, maxWidth: '100%' }}>{t.bookDemo}</button>
              <button className="btn-outline" onClick={() => go('login')} style={{ border: '1.5px solid #d9cef5', borderRadius: 14, padding: isMobile ? '13px 20px' : '16px 30px', fontWeight: 700, fontSize: isMobile ? 14 : 16, color: '#7c3aed', background: '#fff', cursor: 'pointer', width: isMobile ? '100%' : undefined, maxWidth: '100%' }}>{t.tryAima}</button>
            </div>
            <div style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : undefined, gap: isMobile ? 10 : 30, marginTop: isMobile ? 38 : 46, justifyContent: isMobile ? undefined : 'flex-start' }}>
              {[['3+', t.statPlatforms], ['24/7', t.statAuto], ['10×', t.statSpeed]].map(([v, l], i) => (
                <div key={i} style={{ display: 'flex', gap: isMobile ? 0 : 30, minWidth: 0 }}>
                  {i > 0 && !isMobile && <div style={{ width: 1, background: '#e7e2f2' }} />}
                  <div style={{ minWidth: 0, textAlign: isMobile ? 'center' : 'left' }}>
                    <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 24 : 30, color: '#171327' }}>{v}</div>
                    <div style={{ fontSize: isMobile ? 12 : 13, color: '#6b6680', marginTop: 2 }}>{l}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0 max-w-full" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: isMobile ? 300 : 460, aspectRatio: '1 / 1' }}>
              <AimaHero />
            </div>
          </div>
        </section>

        <section id="features" className="scroll-anchor" style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '10px 18px 50px' : '10px 28px 70px' }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 30 : 38, letterSpacing: '-.02em', margin: 0, color: '#171327' }}>{t.flowTitle}</h2>
            <p style={{ fontSize: 17, color: '#5b5670', margin: '12px 0 0' }}>{t.flowSub}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 20 }}>
            {cards.map((c, i) => (
              <div key={i} className="lift-card" style={{ background: '#fff', border: '1px solid #efeaf8', borderRadius: 20, padding: 26, boxShadow: '0 22px 44px -34px rgba(80,40,140,.5)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 13, background: 'linear-gradient(135deg,#edf9ff,#f6effc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <GradIcon path={c.icon} size={24} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 17, margin: '16px 0 6px', color: '#211c38' }}>{c.title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.55, color: '#6b6680' }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <footer id="resources" className="scroll-anchor" style={{ position: 'relative', zIndex: 1, borderTop: '1px solid #ece7f6', background: 'linear-gradient(180deg,rgba(247,246,253,0),rgba(244,243,251,.92)),radial-gradient(820px 340px at 82% 130%,rgba(124,92,255,.12),transparent 60%),radial-gradient(620px 300px at 12% 120%,rgba(34,211,238,.10),transparent 60%),#fbfafe', overflow: 'hidden' }}>
          <div style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '48px 24px 104px' : '64px 28px 30px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(2,1fr)' : '1.7fr 1fr 1fr 1fr 1.4fr', gap: isMobile ? 28 : 34, textAlign: 'left', justifyItems: 'stretch' }}>
              {/* Brand */}
              <div style={{ gridColumn: stacked ? '1 / -1' : undefined }}>
                <img src="/aima-logo.png" alt="AIMA" style={{ height: 44, width: 'auto', display: 'block' }} />
                <p style={{ fontSize: 14, lineHeight: 1.65, color: '#6b6680', maxWidth: 300, margin: '18px 0 0' }}>{t.ftTagline}</p>
                <a className="link-underline" href={`mailto:${CONTACT_EMAIL}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 14, color: '#6b6680', textDecoration: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M4 7l8 6 8-6" /></svg>
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
                  <a className="link-underline" href="#features" onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} style={{ cursor: 'pointer', fontSize: 14, color: '#6b6680', textDecoration: 'none' }}>{t.ftFeatures}</a>
                  <span className="link-underline" style={{ cursor: 'pointer', fontSize: 14, color: '#6b6680' }}>{t.ftPricing}</span>
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fff', border: '1px solid #e6e2f2', borderRadius: 12, padding: '5px 5px 5px 14px', width: '100%', maxWidth: isMobile ? '100%' : 300, boxShadow: '0 10px 24px -18px rgba(80,40,140,.5)' }}>
                  <input placeholder={t.ftEmailPh} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#2b2740', minWidth: 0 }} />
                  <button className="btn-grad" style={{ border: 'none', borderRadius: 9, padding: '10px 16px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer', whiteSpace: 'nowrap' }}>{t.ftSubscribe}</button>
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: '#ece7f6', margin: '44px 0 22px' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'space-between', gap: isMobile ? 18 : 16, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row', textAlign: isMobile ? 'center' : 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 12 : 18, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
                <button className="btn-soft" onClick={toggleLang} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #e6e2f2', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#4b4660', cursor: 'pointer' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth={1.8}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" strokeLinecap="round" /></svg>
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
      </div>
    </>
  );
}
