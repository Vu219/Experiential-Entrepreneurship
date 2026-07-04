import { CheckCircle2, MessageSquareQuote } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Reveal, RevealGroup, RevealItem } from '../motion/Reveal';

// Section social proof — hàng badge tin cậy (dựa trên sự thật sản phẩm) + khối
// placeholder cho testimonial/logo khách hàng sau này. KHÔNG bịa testimonial giả.
export default function SocialProof() {
  const { t } = useApp();
  const { isMobile } = useBreakpoint();

  const badges = [t.spBadgeReview, t.spBadgeToken, t.spBadgeNoCard, t.spBadgeCancel];

  return (
    <section id="trust" className="scroll-anchor cv-auto" style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '10px 18px 50px' : '10px 28px 70px' }}>
      <Reveal>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 32px' }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 30 : 38, letterSpacing: '-.02em', margin: 0, color: '#171327' }}>{t.spTitle}</h2>
          <p style={{ fontSize: 17, color: '#5b5670', margin: '12px 0 0' }}>{t.spSub}</p>
        </div>
      </Reveal>
      <RevealGroup style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
        {badges.map((b, i) => (
          <RevealItem key={i} y={14}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #efeaf8', borderRadius: 999, padding: '10px 18px', fontSize: 13.5, fontWeight: 600, color: '#4b4660', boxShadow: '0 12px 24px -20px rgba(80,40,140,.5)' }}>
              <CheckCircle2 size={16} color="#7c3aed" strokeWidth={2.2} />
              {b}
            </span>
          </RevealItem>
        ))}
      </RevealGroup>

      {/* TODO: thay bằng testimonial/logo khách hàng thật khi có — không dùng nội dung bịa. */}
      <Reveal delay={0.1}>
        <div style={{ maxWidth: 720, margin: '28px auto 0', border: '1.5px dashed #ddd3f3', borderRadius: 20, padding: isMobile ? '26px 20px' : '30px 32px', textAlign: 'center', background: 'rgba(255,255,255,.55)' }}>
          <MessageSquareQuote size={26} color="#b7a6ea" strokeWidth={1.8} style={{ display: 'inline-block' }} />
          <div style={{ fontSize: 14, color: '#8a85a0', marginTop: 10 }}>{t.spPlaceholder}</div>
        </div>
      </Reveal>
    </section>
  );
}
