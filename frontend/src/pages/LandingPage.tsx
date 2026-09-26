import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { GradIcon } from '../components/ui';
import AimaHero from '../components/AimaHero';
import LandingHeader from '../components/LandingHeader';
import { EASE, Reveal, RevealGroup, RevealItem } from '../components/motion/Reveal';
import StatNumber from '../components/motion/StatNumber';
import HowItWorks from '../components/landing/HowItWorks';
import IntegrationsLoop from '../components/landing/IntegrationsLoop';
import PricingTeaser from '../components/landing/PricingTeaser';
import FaqSection from '../components/landing/FaqSection';
import CtaSection from '../components/landing/CtaSection';
import LandingFooter from '../components/landing/LandingFooter';
import LandingLink from '../components/landing/LandingLink';
import { featureIcon } from '../components/landing/landingIcons';
import { useLandingContent } from '../hooks/useLandingContent';
import { usePauseWhenOffscreen } from '../hooks/usePauseWhenOffscreen';
import { tr } from '../api/landing';

// Ô icon thẻ tính năng phóng ra khi thẻ reveal — variant kế thừa từ RevealGroup (hidden/show).
// Tween ease-out (không spring nảy — DESIGN.md).
const featIconVariants: Variants = {
  hidden: { scale: 0.6, rotate: -10, opacity: 0 },
  show: { scale: 1, rotate: 0, opacity: 1, transition: { duration: 0.55, ease: EASE, delay: 0.15 } },
};

export default function LandingPage() {
  const { lang, brandGradient } = useApp();
  const { isMobile, isTablet, width } = useBreakpoint();
  const { hash } = useLocation();
  const { hero, features } = useLandingContent();
  const stacked = isMobile || isTablet;
  const reduced = useReducedMotion();

  // Hero: animation lặp (chấm badge, chữ gradient) dừng khi cuộn đi; hình minh hoạ nghiêng 3D
  // theo chuột (chỉ desktop, gộp theo rAF, ghi thẳng transform qua ref — không re-render).
  const heroRef = usePauseWhenOffscreen<HTMLElement>();
  const tiltRef = useRef<HTMLDivElement>(null);
  const tiltFrame = useRef(0);
  const tiltEnabled = !stacked && !reduced;
  const onHeroMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!tiltEnabled || tiltFrame.current) return;
    const { clientX, clientY, currentTarget } = e;
    tiltFrame.current = requestAnimationFrame(() => {
      tiltFrame.current = 0;
      const r = currentTarget.getBoundingClientRect();
      const x = (clientX - r.left) / r.width - 0.5;
      const y = (clientY - r.top) / r.height - 0.5;
      if (tiltRef.current) tiltRef.current.style.transform = `perspective(900px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg)`;
    });
  };
  const onHeroLeave = () => {
    cancelAnimationFrame(tiltFrame.current);
    tiltFrame.current = 0;
    if (tiltRef.current) tiltRef.current.style.transform = '';
  };

  // Điều hướng từ trang khác về "/#features"… → cuộn tới section theo hash sau mount.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  const ctaBase = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, padding: isMobile ? '13px 20px' : '16px 30px', fontWeight: 700, fontSize: isMobile ? 14 : 16, textDecoration: 'none', cursor: 'pointer', width: isMobile ? '100%' : undefined, maxWidth: '100%', boxSizing: 'border-box' } as const;

  // LandingHeader (position: fixed) phải nằm NGOÀI khối .view-pop. Class view-pop
  // có animation dùng `transform`, mà ancestor có transform sẽ khiến position:fixed
  // bị neo theo phần tử đó (cuộn theo trang) thay vì theo viewport → header trôi mất.
  return (
    <>
      <LandingHeader />

      <div className="view-pop overflow-x-hidden ambient-surface" style={{ minHeight: '100vh' }}>
        {/* 1. Hero — reveal stagger nhẹ cho badge/tiêu đề/nút */}
        <section ref={heroRef} id="home" className="scroll-anchor" onMouseMove={onHeroMove} onMouseLeave={onHeroLeave} style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '96px 18px 44px' : '120px 28px 60px', display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.05fr .95fr', gap: stacked ? 28 : 40, alignItems: 'center' }}>
          <RevealGroup className="min-w-0 max-w-full" style={{ textAlign: isMobile ? 'center' : 'left' }}>
            <RevealItem y={16}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #ece8f7', borderRadius: 999, padding: '7px 15px', fontSize: 13, fontWeight: 600, color: '#7c3aed', boxShadow: '0 6px 18px -12px rgba(124,58,237,.5)' }}>
                <span className="hero-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: brandGradient }} />
                {tr(hero.badge, lang)}
              </div>
            </RevealItem>
            <RevealItem y={20}>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: isMobile ? (width >= 640 ? 36 : 30) : 62, lineHeight: 1.06, letterSpacing: '-.02em', margin: '20px 0 0', color: '#171327', overflowWrap: 'break-word', textWrap: 'balance' }}>
                {tr(hero.titleLine1, lang)}
                <br />
                <span className="gradtext hero-grad">
                  {tr(hero.titleHighlight, lang)}
                </span>
              </h1>
            </RevealItem>
            <RevealItem y={20}>
              <p style={{ fontSize: isMobile ? 16 : 18, lineHeight: 1.6, color: '#5b5670', maxWidth: 480, margin: isMobile ? '20px auto 0' : '22px 0 0', padding: isMobile ? '0 6px' : 0 }}>{tr(hero.subtitle, lang)}</p>
            </RevealItem>
            <RevealItem y={20}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 14, marginTop: 34, flexWrap: 'wrap', alignItems: isMobile ? 'stretch' : 'center' }}>
                <LandingLink href={hero.primaryCta.href} className="btn-grad btn-shine" style={{ ...ctaBase, border: 'none', color: '#fff', background: brandGradient, boxShadow: '0 18px 34px -14px rgba(139,92,246,.65)' }}>{tr(hero.primaryCta.label, lang)}</LandingLink>
                <LandingLink href={hero.secondaryCta.href} className="btn-outline" style={{ ...ctaBase, border: '1.5px solid #d9cef5', color: '#7c3aed', background: '#fff' }}>{tr(hero.secondaryCta.label, lang)}</LandingLink>
              </div>
            </RevealItem>
            {/* 2. Thống kê — count-up khi vào viewport lần đầu */}
            <RevealItem y={20}>
              <div style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: isMobile ? `repeat(${hero.stats.length},1fr)` : undefined, gap: isMobile ? 10 : 30, marginTop: isMobile ? 38 : 46, justifyContent: isMobile ? undefined : 'flex-start' }}>
                {hero.stats.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: isMobile ? 0 : 30, minWidth: 0 }}>
                    {i > 0 && !isMobile && <div style={{ width: 1, background: '#e7e2f2' }} />}
                    <div style={{ minWidth: 0, textAlign: isMobile ? 'center' : 'left' }}>
                      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 24 : 30, color: '#171327' }}>
                        <StatNumber value={s.value} suffix={s.suffix} />
                      </div>
                      <div style={{ fontSize: isMobile ? 12 : 13, color: '#6b6680', marginTop: 2 }}>{tr(s.label, lang)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </RevealItem>
          </RevealGroup>
          <div className="min-w-0 max-w-full" style={{ display: 'flex', justifyContent: 'center' }}>
            <div ref={tiltRef} className="hero-tilt" style={{ width: '100%', maxWidth: isMobile ? 300 : 460, aspectRatio: '1 / 1' }}>
              <AimaHero />
            </div>
          </div>
        </section>

        {/* 3. "Một quy trình trọn vẹn" — 6 thẻ, stagger */}
        <section id="features" className="scroll-anchor cv-auto" style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '10px 18px 50px' : '10px 28px 70px' }}>
          <Reveal>
            <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
              <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 30 : 38, letterSpacing: '-.02em', margin: 0, color: '#171327', textWrap: 'balance' }}>{tr(features.title, lang)}</h2>
              <p style={{ fontSize: 17, color: '#5b5670', margin: '12px 0 0' }}>{tr(features.subtitle, lang)}</p>
            </div>
          </Reveal>
          <RevealGroup style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 20 }}>
            {features.items.map((c, i) => (
              <RevealItem key={i} style={{ display: 'flex' }}>
                <div className="lift-card feat-card" style={{ flex: 1, background: '#fff', border: '1px solid #efeaf8', borderRadius: 20, padding: 26, boxShadow: '0 22px 44px -34px rgba(80,40,140,.5)' }}>
                  {/* Hover: vạch brand chạy ra ở đỉnh + vệt sáng quét ngang (CSS .feat-*) */}
                  <span aria-hidden className="feat-bar" />
                  <span aria-hidden className="feat-sheen" />
                  <motion.div variants={reduced ? undefined : featIconVariants} style={{ display: 'inline-flex' }}>
                    <div className="feat-icon" style={{ width: 48, height: 48, borderRadius: 13, background: 'linear-gradient(135deg,#edf9ff,#f6effc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <GradIcon icon={featureIcon(c.icon)} size={24} />
                    </div>
                  </motion.div>
                  <div style={{ fontWeight: 700, fontSize: 17, margin: '16px 0 6px', color: '#211c38' }}>{tr(c.title, lang)}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: '#6b6680' }}>{tr(c.description, lang)}</div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* 4. Cách hoạt động — 3 bước */}
        <HowItWorks />

        {/* 5. Nền tảng tích hợp — LogoLoop */}
        <IntegrationsLoop />

        {/* 6. Pricing teaser — chi tiết ở trang /pricing */}
        <PricingTeaser />

        {/* 7. FAQ nhanh */}
        <FaqSection />

        {/* 8. CTA cuối trang */}
        <CtaSection />

        {/* 9. Footer */}
        <LandingFooter />
      </div>
    </>
  );
}
