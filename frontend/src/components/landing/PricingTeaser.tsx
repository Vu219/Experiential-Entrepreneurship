import { ArrowRight, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { BRAND_GLOW } from '../../theme';
import { usePublicPlans } from '../../hooks/usePublicPlans';
import StatNumber from '../motion/StatNumber';
import { Reveal, RevealGroup, RevealItem } from '../motion/Reveal';

// Pricing teaser ở Landing — card rút gọn (tên + giá + 2–3 dòng nổi bật) đọc từ
// API public /plans/public (bảng Plan trong DB, một nguồn với trang /pricing);
// admin sửa gói là landing đổi theo. Nút xem chi tiết → /pricing.
export default function PricingTeaser() {
  const { t, lang, go, brandGradient } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const { plans } = usePublicPlans(lang);

  // Desktop: ≤3 gói giữ kích cỡ card như cũ (3 cột), ≥4 gói chuyển 4 cột (tối đa 4 card/hàng);
  // tablet 2, mobile 1. Flex-wrap + justify center thay grid 1fr: hàng cuối thiếu card tự
  // căn giữa, bề rộng card cố định theo cột (không bị giãn to khi ít gói).
  const cols = isMobile ? 1 : isTablet ? 2 : plans.length <= 3 ? 3 : 4;
  const gap = 20;
  const cardWidth = `calc((100% - ${(cols - 1) * gap}px) / ${cols})`;

  return (
    <section id="pricing" className="scroll-anchor cv-auto" style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '10px 18px 56px' : '10px 28px 80px' }}>
      <Reveal>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 36px' }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 30 : 38, letterSpacing: '-.02em', margin: 0, color: '#171327' }}>{t.prTitle}</h2>
          <p style={{ fontSize: 17, color: '#5b5670', margin: '12px 0 0' }}>{t.prSub}</p>
        </div>
      </Reveal>
      <RevealGroup style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap, alignItems: 'stretch', maxWidth: isMobile ? 520 : undefined, margin: '0 auto' }}>
        {plans.map((p) => {
          const featured = !!p.featured;
          return (
            <RevealItem key={p.id} style={{ display: 'flex', flex: '0 0 auto', width: cardWidth }}>
              <div
                className="lift-card"
                style={{
                  position: 'relative',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 20,
                  padding: 24,
                  ...(featured
                    ? {
                        border: '2px solid transparent',
                        background: `linear-gradient(#fff,#fff) padding-box, ${brandGradient} border-box`,
                        boxShadow: `0 30px 60px -26px ${BRAND_GLOW}, 0 12px 24px -18px ${BRAND_GLOW}`,
                      }
                    : {
                        border: '1px solid #efeaf8',
                        background: '#fff',
                        boxShadow: '0 22px 44px -34px rgba(80,40,140,.5)',
                      }),
                }}
              >
                {featured && (
                  <span style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: brandGradient, color: '#fff', borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: `0 10px 22px -10px ${BRAND_GLOW}` }}>
                    ★ {t.prPopular}
                  </span>
                )}
                <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 18, color: '#211c38' }}>{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '12px 0 2px' }}>
                  <StatNumber
                    value={p.priceValue}
                    suffix="đ"
                    locales="vi-VN"
                    style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 30, letterSpacing: '-.02em', color: featured ? '#2563eb' : '#171327' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#8a85a0' }}>{p.cadence}</span>
                </div>
                <div style={{ height: 1, background: '#f0ecf8', margin: '14px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                  {p.teaserFeatures.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                      <span style={{ flex: 'none', width: 18, height: 18, borderRadius: '50%', background: featured ? brandGradient : '#f3edff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                        <Check size={11} strokeWidth={3} color={featured ? '#fff' : '#7c3aed'} />
                      </span>
                      <span style={{ fontSize: 13.5, lineHeight: 1.5, color: '#4b4660' }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </RevealItem>
          );
        })}
      </RevealGroup>
      <Reveal delay={0.15}>
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <button
            className="btn-outline"
            onClick={() => go('pricing')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1.5px solid #d9cef5', borderRadius: 14, padding: '13px 26px', fontWeight: 700, fontSize: 15, color: '#7c3aed', background: '#fff', cursor: 'pointer' }}
          >
            {t.ptViewAll}
            <ArrowRight size={17} strokeWidth={2.4} />
          </button>
          <div style={{ fontSize: 12.5, color: '#8a85a0', marginTop: 16 }}>{t.prNote}</div>
        </div>
      </Reveal>
    </section>
  );
}
