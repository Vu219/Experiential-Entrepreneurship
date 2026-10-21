import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import LandingHeader from '../components/LandingHeader';
import { Reveal, RevealGroup, RevealItem } from '../components/motion/Reveal';
import PlanCard from '../components/landing/PlanCard';
import FaqSection from '../components/landing/FaqSection';
import CtaSection from '../components/landing/CtaSection';
import LandingFooter from '../components/landing/LandingFooter';
import { usePublicPlans } from '../hooks/usePublicPlans';
import ComparisonTable from '../components/plans/ComparisonTable';
import { C } from '../styles/colors';

export default function PricingPage() {
  const { t, lang } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;
  // Gói + bảng so sánh từ API public (DB) — fallback hardcode khi API lỗi.
  const { plans, groups } = usePublicPlans(lang);

  // Desktop: ≤3 gói giữ kích cỡ card như cũ (3 cột), ≥4 gói chuyển 4 cột (tối đa 4 card/hàng);
  // tablet 2, mobile 1. Flex-wrap + justify center thay grid 1fr: hàng cuối thiếu card tự
  // căn giữa, bề rộng card cố định theo cột (không giãn khi ít gói).
  const cols = isMobile ? 1 : isTablet ? 2 : plans.length <= 3 ? 3 : 4;
  const gap = 22;
  const cardWidth = `calc((100% - ${(cols - 1) * gap}px) / ${cols})`;


  // LandingHeader (position: fixed) nằm ngoài .view-pop — xem ghi chú ở LandingPage.
  return (
    <>
      <LandingHeader />

      <div className="view-pop overflow-x-hidden ambient-surface" style={{ minHeight: '100vh' }}>
        {/* Hero nhỏ */}
        <section style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '110px 18px 36px' : '150px 28px 48px' }}>
          <Reveal>
            <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 32 : 46, letterSpacing: '-.02em', margin: 0, color: C.ink900 }}>{t.prTitle}</h1>
              <p style={{ fontSize: isMobile ? 15.5 : 17, color: C.ink550, margin: '14px 0 0' }}>{t.prSub}</p>
            </div>
          </Reveal>
        </section>

        {/* 3 gói đầy đủ */}
        <section style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '0 18px 56px' : '0 28px 80px' }}>
          <RevealGroup style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap, alignItems: 'stretch', maxWidth: isMobile ? 520 : undefined, margin: '0 auto' }}>
            {plans.map((p) => (
              <RevealItem key={p.id} style={{ display: 'flex', flex: '0 0 auto', width: cardWidth }}>
                <PlanCard plan={p} stacked={stacked} popularLabel={t.prPopular} />
              </RevealItem>
            ))}
          </RevealGroup>
          <Reveal delay={0.1}>
            <div style={{ textAlign: 'center', fontSize: 12.5, color: C.textMuted, marginTop: 22 }}>{t.prNote}</div>
          </Reveal>
        </section>

        {/* Bảng so sánh chi tiết — cuộn ngang trong container trên màn hẹp */}
        <section style={{ maxWidth: 1080, margin: '0 auto', padding: isMobile ? '0 18px 56px' : '0 28px 80px' }}>
          <Reveal>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 26 : 34, letterSpacing: '-.02em', margin: '0 0 28px', textAlign: 'center', color: C.ink900 }}>{t.ppCompareTitle}</h2>
          </Reveal>
          <Reveal delay={0.05}>
            {/* Cùng component với tab "Xem trước" của admin — một cách render, không lệch cột. */}
            <ComparisonTable plans={plans} groups={groups} />
          </Reveal>
        </section>

        <FaqSection />
        <CtaSection />
        <LandingFooter />
      </div>
    </>
  );
}
