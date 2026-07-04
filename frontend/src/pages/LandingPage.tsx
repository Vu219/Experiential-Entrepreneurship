import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { GradIcon } from '../components/ui';
import AimaHero from '../components/AimaHero';
import LandingHeader from '../components/LandingHeader';
import { Reveal, RevealGroup, RevealItem } from '../components/motion/Reveal';
import StatNumber from '../components/motion/StatNumber';
import HowItWorks from '../components/landing/HowItWorks';
import IntegrationsLoop from '../components/landing/IntegrationsLoop';
import SocialProof from '../components/landing/SocialProof';
import PricingTeaser from '../components/landing/PricingTeaser';
import FaqSection from '../components/landing/FaqSection';
import CtaSection from '../components/landing/CtaSection';
import LandingFooter from '../components/landing/LandingFooter';
import { flowCards } from '../data';

export default function LandingPage() {
  const { t, lang, go, brandGradient } = useApp();
  const { isMobile, isTablet, width } = useBreakpoint();
  const { hash } = useLocation();
  const cards = flowCards(lang);
  const stacked = isMobile || isTablet;

  // Điều hướng từ trang khác về "/#features"… → cuộn tới section theo hash sau mount.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  // Thống kê hero — số chạy hiệu ứng đếm khi vào viewport lần đầu (StatNumber).
  const heroStats: { value: number; suffix: string; label: string }[] = [
    { value: 3, suffix: '+', label: t.statPlatforms },
    { value: 24, suffix: '/7', label: t.statAuto },
    { value: 10, suffix: '×', label: t.statSpeed },
  ];

  // LandingHeader (position: fixed) phải nằm NGOÀI khối .view-pop. Class view-pop
  // có animation dùng `transform`, mà ancestor có transform sẽ khiến position:fixed
  // bị neo theo phần tử đó (cuộn theo trang) thay vì theo viewport → header trôi mất.
  return (
    <>
      <LandingHeader />

      <div className="view-pop overflow-x-hidden ambient-surface" style={{ minHeight: '100vh' }}>
        {/* 1. Hero — reveal stagger nhẹ cho badge/tiêu đề/nút */}
        <section id="home" className="scroll-anchor" style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '96px 18px 44px' : '120px 28px 60px', display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.05fr .95fr', gap: stacked ? 28 : 40, alignItems: 'center' }}>
          <RevealGroup className="min-w-0 max-w-full" style={{ textAlign: isMobile ? 'center' : 'left' }}>
            <RevealItem y={16}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #ece8f7', borderRadius: 999, padding: '7px 15px', fontSize: 13, fontWeight: 600, color: '#7c3aed', boxShadow: '0 6px 18px -12px rgba(124,58,237,.5)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: brandGradient }} />
                {t.heroBadge}
              </div>
            </RevealItem>
            <RevealItem y={20}>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: isMobile ? (width >= 640 ? 36 : 30) : 62, lineHeight: 1.06, letterSpacing: '-.02em', margin: '20px 0 0', color: '#171327', overflowWrap: 'break-word' }}>
                {t.heroT1}
                <br />
                <span className="gradtext">{t.heroT2}</span>
              </h1>
            </RevealItem>
            <RevealItem y={20}>
              <p style={{ fontSize: isMobile ? 16 : 18, lineHeight: 1.6, color: '#5b5670', maxWidth: 480, margin: isMobile ? '20px auto 0' : '22px 0 0', padding: isMobile ? '0 6px' : 0 }}>{t.heroSub}</p>
            </RevealItem>
            <RevealItem y={20}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 14, marginTop: 34, flexWrap: 'wrap', alignItems: isMobile ? 'stretch' : 'center' }}>
                <button className="btn-grad" onClick={() => go('register')} style={{ border: 'none', borderRadius: 14, padding: isMobile ? '13px 20px' : '16px 30px', fontWeight: 700, fontSize: isMobile ? 14 : 16, color: '#fff', background: brandGradient, boxShadow: '0 18px 34px -14px rgba(139,92,246,.65)', cursor: 'pointer', width: isMobile ? '100%' : undefined, maxWidth: '100%' }}>{t.bookDemo}</button>
                <button className="btn-outline" onClick={() => go('login')} style={{ border: '1.5px solid #d9cef5', borderRadius: 14, padding: isMobile ? '13px 20px' : '16px 30px', fontWeight: 700, fontSize: isMobile ? 14 : 16, color: '#7c3aed', background: '#fff', cursor: 'pointer', width: isMobile ? '100%' : undefined, maxWidth: '100%' }}>{t.tryAima}</button>
              </div>
            </RevealItem>
            {/* 2. Thống kê — count-up khi vào viewport lần đầu */}
            <RevealItem y={20}>
              <div style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : undefined, gap: isMobile ? 10 : 30, marginTop: isMobile ? 38 : 46, justifyContent: isMobile ? undefined : 'flex-start' }}>
                {heroStats.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: isMobile ? 0 : 30, minWidth: 0 }}>
                    {i > 0 && !isMobile && <div style={{ width: 1, background: '#e7e2f2' }} />}
                    <div style={{ minWidth: 0, textAlign: isMobile ? 'center' : 'left' }}>
                      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 24 : 30, color: '#171327' }}>
                        <StatNumber value={s.value} suffix={s.suffix} />
                      </div>
                      <div style={{ fontSize: isMobile ? 12 : 13, color: '#6b6680', marginTop: 2 }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </RevealItem>
          </RevealGroup>
          <div className="min-w-0 max-w-full" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: isMobile ? 300 : 460, aspectRatio: '1 / 1' }}>
              <AimaHero />
            </div>
          </div>
        </section>

        {/* 3. "Một quy trình trọn vẹn" — 6 thẻ, stagger */}
        <section id="features" className="scroll-anchor cv-auto" style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '10px 18px 50px' : '10px 28px 70px' }}>
          <Reveal>
            <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
              <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 30 : 38, letterSpacing: '-.02em', margin: 0, color: '#171327' }}>{t.flowTitle}</h2>
              <p style={{ fontSize: 17, color: '#5b5670', margin: '12px 0 0' }}>{t.flowSub}</p>
            </div>
          </Reveal>
          <RevealGroup style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 20 }}>
            {cards.map((c, i) => (
              <RevealItem key={i} style={{ display: 'flex' }}>
                <div className="lift-card" style={{ flex: 1, background: '#fff', border: '1px solid #efeaf8', borderRadius: 20, padding: 26, boxShadow: '0 22px 44px -34px rgba(80,40,140,.5)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 13, background: 'linear-gradient(135deg,#edf9ff,#f6effc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GradIcon icon={c.icon} size={24} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 17, margin: '16px 0 6px', color: '#211c38' }}>{c.title}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: '#6b6680' }}>{c.desc}</div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* 4. Cách hoạt động — 3 bước */}
        <HowItWorks />

        {/* 5. Nền tảng tích hợp — LogoLoop */}
        <IntegrationsLoop />

        {/* 6. Social proof — badge tin cậy + placeholder testimonial */}
        <SocialProof />

        {/* 7. Pricing teaser — chi tiết ở trang /pricing */}
        <PricingTeaser />

        {/* 8. FAQ nhanh */}
        <FaqSection />

        {/* 9. CTA cuối trang */}
        <CtaSection />

        {/* 10. Footer */}
        <LandingFooter />
      </div>
    </>
  );
}
