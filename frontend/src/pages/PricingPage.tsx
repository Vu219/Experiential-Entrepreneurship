import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import LandingHeader from '../components/LandingHeader';
import { Reveal, RevealGroup, RevealItem } from '../components/motion/Reveal';
import PlanCard from '../components/landing/PlanCard';
import FaqSection from '../components/landing/FaqSection';
import CtaSection from '../components/landing/CtaSection';
import LandingFooter from '../components/landing/LandingFooter';
import { usePublicPlans } from '../hooks/usePublicPlans';
import type { ComparisonValue } from '../config/plans';

// Ô giá trị của bảng so sánh: boolean → ✓ / —, string → hiển thị nguyên văn.
function CompareCell({ value }: { value: ComparisonValue }) {
  if (value === true) {
    return (
      <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', background: '#f3edff', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={13} strokeWidth={3} color="#7c3aed" />
      </span>
    );
  }
  if (value === false) return <span style={{ color: '#c9c2dd', fontWeight: 600 }}>—</span>;
  return <span style={{ fontSize: 13.5, fontWeight: 600, color: '#4b4660' }}>{value}</span>;
}

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

  const cellPad = isMobile ? '12px 14px' : '14px 18px';

  // LandingHeader (position: fixed) nằm ngoài .view-pop — xem ghi chú ở LandingPage.
  return (
    <>
      <LandingHeader />

      <div className="view-pop overflow-x-hidden ambient-surface" style={{ minHeight: '100vh' }}>
        {/* Hero nhỏ */}
        <section style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '110px 18px 36px' : '150px 28px 48px' }}>
          <Reveal>
            <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 32 : 46, letterSpacing: '-.02em', margin: 0, color: '#171327' }}>{t.prTitle}</h1>
              <p style={{ fontSize: isMobile ? 15.5 : 17, color: '#5b5670', margin: '14px 0 0' }}>{t.prSub}</p>
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
            <div style={{ textAlign: 'center', fontSize: 12.5, color: '#8a85a0', marginTop: 22 }}>{t.prNote}</div>
          </Reveal>
        </section>

        {/* Bảng so sánh chi tiết — cuộn ngang trong container trên màn hẹp */}
        <section style={{ maxWidth: 1080, margin: '0 auto', padding: isMobile ? '0 18px 56px' : '0 28px 80px' }}>
          <Reveal>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 26 : 34, letterSpacing: '-.02em', margin: '0 0 28px', textAlign: 'center', color: '#171327' }}>{t.ppCompareTitle}</h2>
          </Reveal>
          <Reveal delay={0.05}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', background: '#fff', border: '1px solid #efeaf8', borderRadius: 20, boxShadow: '0 22px 44px -34px rgba(80,40,140,.5)' }}>
              <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: cellPad, textAlign: 'left', fontSize: 13, fontWeight: 700, color: '#8a85a0', borderBottom: '1px solid #f0ecf8' }}>{t.ppColFeature}</th>
                    {plans.map((p) => (
                      <th key={p.id} style={{ padding: cellPad, textAlign: 'center', borderBottom: '1px solid #f0ecf8', minWidth: 130 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15, color: p.featured ? '#6d28d9' : '#211c38' }}>
                          {p.name}
                          {p.featured && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#6d28d9', background: '#f3edff', border: '1px solid #e7d9fb', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>★ {t.prPopular}</span>}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <Fragment key={g.title}>
                      <tr>
                        <td colSpan={plans.length + 1} style={{ padding: `${isMobile ? 14 : 18}px ${isMobile ? 14 : 18}px 8px`, fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 13.5, color: '#7c3aed' }}>{g.title}</td>
                      </tr>
                      {g.rows.map((row) => (
                        <tr key={row.label} style={{ borderBottom: '1px solid #f6f3fb' }}>
                          <td style={{ padding: cellPad, fontSize: 13.5, color: '#4b4660' }}>{row.label}</td>
                          {row.values.map((v, i) => (
                            <td key={i} style={{ padding: cellPad, textAlign: 'center', background: plans[i].featured ? 'rgba(124,58,237,.035)' : undefined }}>
                              <CompareCell value={v} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </section>

        <FaqSection />
        <CtaSection />
        <LandingFooter />
      </div>
    </>
  );
}
