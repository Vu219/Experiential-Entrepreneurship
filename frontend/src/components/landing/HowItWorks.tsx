import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Reveal, RevealGroup, RevealItem } from '../motion/Reveal';

// Section "Cách hoạt động" — 3 bước tuần tự, mỗi cột có số bước, reveal stagger.
export default function HowItWorks() {
  const { t, brandGradient } = useApp();
  const { isMobile, isTablet } = useBreakpoint();

  const steps: [string, string][] = [
    [t.hiwS1T, t.hiwS1D],
    [t.hiwS2T, t.hiwS2D],
    [t.hiwS3T, t.hiwS3D],
  ];

  return (
    <section id="how-it-works" className="scroll-anchor cv-auto" style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '10px 18px 50px' : '10px 28px 70px' }}>
      <Reveal>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 30 : 38, letterSpacing: '-.02em', margin: 0, color: '#171327' }}>{t.hiwTitle}</h2>
          <p style={{ fontSize: 17, color: '#5b5670', margin: '12px 0 0' }}>{t.hiwSub}</p>
        </div>
      </Reveal>
      <RevealGroup style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(3,1fr)' : 'repeat(3,1fr)', gap: 20 }}>
        {steps.map(([title, desc], i) => (
          <RevealItem key={i} style={{ display: 'flex' }}>
            <div className="lift-card" style={{ flex: 1, position: 'relative', background: '#fff', border: '1px solid #efeaf8', borderRadius: 20, padding: '30px 26px 26px', boxShadow: '0 22px 44px -34px rgba(80,40,140,.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ flex: 'none', width: 44, height: 44, borderRadius: 13, background: brandGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, boxShadow: '0 12px 24px -12px rgba(139,92,246,.6)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {/* Vạch nối giữa các bước (chỉ desktop, không có ở bước cuối) */}
                {!isMobile && i < steps.length - 1 && (
                  <span aria-hidden style={{ position: 'absolute', top: 51, left: 'calc(26px + 44px + 14px)', right: 26, height: 2, background: 'linear-gradient(90deg,#e7defa,transparent)', borderRadius: 2 }} />
                )}
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, margin: '18px 0 6px', color: '#211c38' }}>{title}</div>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: '#6b6680' }}>{desc}</div>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
