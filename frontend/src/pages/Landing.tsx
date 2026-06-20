import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { GradIcon } from '../components/ui';
import AimaScene from '../components/AimaScene';
import { LangButton } from '../components/AppShell';
import { flowCards } from '../data';

export default function Landing() {
  const { t, lang, go, brandGradient } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const cards = flowCards(lang);
  const stacked = isMobile || isTablet;

  return (
    <div
      className="view-pop"
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(1100px 600px at 80% -10%,rgba(217,70,239,.08),transparent 60%),radial-gradient(900px 600px at -5% 10%,rgba(34,211,238,.09),transparent 55%),#f9f8fd',
      }}
    >
      <header style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '14px 16px' : '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <img src="/aima-logo.png" alt="AIMA" style={{ height: 46, width: 'auto', display: 'block' }} />
        <nav style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 34 }}>
          {!isMobile && (
            <>
              <a onClick={() => go('landing')} style={{ cursor: 'pointer', fontWeight: 600, fontSize: 15, color: '#6b21a8' }}>{t.nHome}</a>
              <span style={{ cursor: 'pointer', fontWeight: 500, fontSize: 15, color: '#4b4660' }}>{t.nFeatures}</span>
              <span style={{ cursor: 'pointer', fontWeight: 500, fontSize: 15, color: '#4b4660' }}>{t.nPricing}</span>
              <span style={{ cursor: 'pointer', fontWeight: 500, fontSize: 15, color: '#4b4660' }}>{t.nResources}</span>
            </>
          )}
          <LangButton />
          <button onClick={() => go('login')} style={{ border: 'none', borderRadius: 999, padding: '11px 26px', fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, boxShadow: '0 12px 26px -10px rgba(139,92,246,.6)', cursor: 'pointer' }}>{t.bookDemo}</button>
        </nav>
      </header>

      <section style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '24px 18px 44px' : '36px 28px 60px', display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.05fr .95fr', gap: stacked ? 28 : 40, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #ece8f7', borderRadius: 999, padding: '7px 15px', fontSize: 13, fontWeight: 600, color: '#7c3aed', boxShadow: '0 6px 18px -12px rgba(124,58,237,.5)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: brandGradient }} />
            {t.heroBadge}
          </div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: isMobile ? 38 : 62, lineHeight: 1.04, letterSpacing: '-.02em', margin: '20px 0 0', color: '#171327' }}>
            {t.heroT1}
            <br />
            <span className="gradtext">{t.heroT2}</span>
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: '#5b5670', maxWidth: 480, margin: '22px 0 0' }}>{t.heroSub}</p>
          <div style={{ display: 'flex', gap: 14, marginTop: 34, flexWrap: 'wrap' }}>
            <button onClick={() => go('register')} style={{ border: 'none', borderRadius: 14, padding: '16px 30px', fontWeight: 700, fontSize: 16, color: '#fff', background: brandGradient, boxShadow: '0 18px 34px -14px rgba(139,92,246,.65)', cursor: 'pointer' }}>{t.bookDemo}</button>
            <button onClick={() => go('login')} style={{ border: '1.5px solid #d9cef5', borderRadius: 14, padding: '16px 30px', fontWeight: 700, fontSize: 16, color: '#7c3aed', background: '#fff', cursor: 'pointer' }}>{t.tryAima}</button>
          </div>
          <div style={{ display: 'flex', gap: 30, marginTop: 46 }}>
            {[['3+', t.statPlatforms], ['24/7', t.statAuto], ['10×', t.statSpeed]].map(([v, l], i) => (
              <div key={i} style={{ display: 'flex', gap: 30 }}>
                {i > 0 && <div style={{ width: 1, background: '#e7e2f2' }} />}
                <div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 30, color: '#171327' }}>{v}</div>
                  <div style={{ fontSize: 13, color: '#6b6680', marginTop: 2 }}>{l}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 440, height: 440, maxWidth: '100%' }}>
            <AimaScene />
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '10px 18px 50px' : '10px 28px 70px' }}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 30 : 38, letterSpacing: '-.02em', margin: 0, color: '#171327' }}>{t.flowTitle}</h2>
          <p style={{ fontSize: 17, color: '#5b5670', margin: '12px 0 0' }}>{t.flowSub}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 20 }}>
          {cards.map((c, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #efeaf8', borderRadius: 20, padding: 26, boxShadow: '0 22px 44px -34px rgba(80,40,140,.5)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: 'linear-gradient(135deg,#edf9ff,#f6effc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GradIcon path={c.icon} size={24} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, margin: '16px 0 6px', color: '#211c38' }}>{c.title}</div>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: '#6b6680' }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: '1px solid #ece7f6', background: '#fbfafe' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '30px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <img src="/aima-logo.png" alt="AIMA" style={{ height: 34, width: 'auto' }} />
          <div style={{ fontSize: 13, color: '#8a85a0' }}>© 2026 AIMA · AI Marketing Automation</div>
        </div>
      </footer>
    </div>
  );
}
