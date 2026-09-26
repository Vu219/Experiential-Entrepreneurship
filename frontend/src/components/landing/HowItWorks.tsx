import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { EASE, Reveal, RevealGroup, RevealItem } from '../motion/Reveal';
import { useLandingContent } from '../../hooks/useLandingContent';
import { tr } from '../../api/landing';

// Section "Cách hoạt động" — các bước tuần tự (nội dung từ admin), số bước = vị trí, reveal stagger.
// Hiệu ứng (chỉ transform/opacity — không đụng layout): ô số phóng ra theo thẻ (tween ease-out, không nảy), vạch nối tự vẽ
// từ trái sang phải, vệt sáng chạy dọc vạch lặp lại (lệch nhịp theo bước), hover thẻ nghiêng ô số.
// Variant "hidden"/"show" kế thừa từ RevealGroup nên chạy đồng bộ với reveal của thẻ.
// prefers-reduced-motion → render tĩnh (vệt sáng tắt bằng CSS).


const numVariants: Variants = {
  hidden: { scale: 0.6, rotate: -10, opacity: 0 },
  show: { scale: 1, rotate: 0, opacity: 1, transition: { duration: 0.55, ease: EASE, delay: 0.15 } },
};

const lineVariants: Variants = {
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { duration: 0.7, ease: EASE, delay: 0.45 } },
};

export default function HowItWorks() {
  const { lang, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const reduced = useReducedMotion();

  const { how_it_works: content } = useLandingContent();
  const steps = content.steps;
  const cols = isMobile ? 1 : Math.min(steps.length, 3);

  const numStyle = { width: 44, height: 44, borderRadius: 13, background: brandGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17 } as const;
  const lineStyle = { position: 'absolute', top: 51, left: 'calc(26px + 44px + 14px)', right: 26, height: 2, borderRadius: 2, overflow: 'hidden', background: 'linear-gradient(90deg,#d9cbf8,rgba(231,222,250,0))', transformOrigin: 'left center' } as const;

  return (
    <section id="how-it-works" className="scroll-anchor cv-auto" style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '10px 18px 50px' : '10px 28px 70px' }}>
      <Reveal>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 30 : 38, letterSpacing: '-.02em', margin: 0, color: '#171327', textWrap: 'balance' }}>{tr(content.title, lang)}</h2>
          <p style={{ fontSize: 17, color: '#5b5670', margin: '12px 0 0' }}>{tr(content.subtitle, lang)}</p>
        </div>
      </Reveal>
      <RevealGroup style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 20 }}>
        {steps.map((step, i) => {
          const hasLine = cols > 1 && (i + 1) % cols !== 0 && i < steps.length - 1;
          const num = <span className="hiw-num" style={numStyle}>{String(i + 1).padStart(2, '0')}</span>;
          // Vệt sáng lệch nhịp theo bước → cảm giác chảy từ bước này sang bước kế tiếp.
          const flow = <span className="hiw-flow" style={{ animationDelay: `${1.2 + i * 0.8}s` }} />;
          return (
            <RevealItem key={i} style={{ display: 'flex' }}>
              <div className="lift-card hiw-card" style={{ flex: 1, position: 'relative', background: '#fff', border: '1px solid #efeaf8', borderRadius: 20, padding: '30px 26px 26px', boxShadow: '0 22px 44px -34px rgba(80,40,140,.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {reduced
                    ? <span style={{ flex: 'none' }}>{num}</span>
                    : <motion.span variants={numVariants} style={{ flex: 'none', display: 'inline-flex' }}>{num}</motion.span>}
                  {/* Vạch nối giữa các bước (chỉ khi xếp ngang, không có ở bước cuối hàng) */}
                  {hasLine && (reduced
                    ? <span aria-hidden style={lineStyle} />
                    : <motion.span aria-hidden variants={lineVariants} style={lineStyle}>{flow}</motion.span>)}
                </div>
                <div style={{ fontWeight: 700, fontSize: 17, margin: '18px 0 6px', color: '#211c38' }}>{tr(step.title, lang)}</div>
                <div style={{ fontSize: 14, lineHeight: 1.55, color: '#6b6680' }}>{tr(step.description, lang)}</div>
              </div>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </section>
  );
}
