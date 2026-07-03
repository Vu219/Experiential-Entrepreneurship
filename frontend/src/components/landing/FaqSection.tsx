import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Reveal, RevealGroup, RevealItem } from '../motion/Reveal';

// FAQ accordion — panel animate height 0 ↔ auto bằng framer-motion (thư viện tự đo
// chiều cao thật nên chuyển động mượt) kèm fade nội dung; icon xoay bằng transform.
// Dùng chung cho Landing và /pricing.
export default function FaqSection() {
  const { t } = useApp();
  const { isMobile } = useBreakpoint();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<number | null>(0);

  const faqs: [string, string][] = [
    [t.faqQ1, t.faqA1],
    [t.faqQ2, t.faqA2],
    [t.faqQ3, t.faqA3],
    [t.faqQ4, t.faqA4],
  ];

  return (
    <section id="faq" className="scroll-anchor" style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '10px 18px 56px' : '10px 28px 80px' }}>
      <Reveal>
        <div style={{ textAlign: 'center', margin: '0 auto 32px' }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 30 : 38, letterSpacing: '-.02em', margin: 0, color: '#171327' }}>{t.faqTitle}</h2>
          <p style={{ fontSize: 17, color: '#5b5670', margin: '12px 0 0' }}>{t.faqSub}</p>
        </div>
      </Reveal>
      <RevealGroup style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {faqs.map(([q, a], i) => {
          const isOpen = open === i;
          return (
            <RevealItem key={i} y={16}>
              <div style={{ background: '#fff', border: `1px solid ${isOpen ? '#ddd0f7' : '#efeaf8'}`, borderRadius: 16, boxShadow: '0 16px 32px -28px rgba(80,40,140,.5)', overflow: 'hidden', transition: 'border-color .25s ease' }}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', padding: isMobile ? '16px 18px' : '18px 22px' }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15.5, color: '#211c38', fontFamily: "'Plus Jakarta Sans'" }}>{q}</span>
                  <ChevronDown size={18} color="#7c3aed" strokeWidth={2.2} style={{ flex: 'none', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .3s ease' }} />
                </button>
                <motion.div
                  id={`faq-panel-${i}`}
                  initial={false}
                  animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { height: { duration: 0.34, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.26, ease: 'easeOut' } }
                  }
                  style={{ overflow: 'hidden' }}
                >
                  <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#5b5670', margin: 0, padding: isMobile ? '0 18px 16px' : '0 22px 20px' }}>{a}</p>
                </motion.div>
              </div>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </section>
  );
}
