import { Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BRAND_GLOW } from '../../theme';
import type { PricingPlan } from '../../config/plans';
import StatNumber from '../motion/StatNumber';

// Card gói giá đầy đủ (trang /pricing). Card Pro (featured) không còn tô tím đặc:
// nền sáng như 2 card kia + VIỀN gradient brand (2px) + glow ám brand để "bay" cao hơn.
// Badge/giá/nút/tick đều dùng dải brand → tách khỏi ambient nền theme.
interface PlanCardProps {
  plan: PricingPlan;
  stacked: boolean;
  popularLabel: string;
}

export default function PlanCard({ plan: p, stacked, popularLabel }: PlanCardProps) {
  const { go, brandGradient } = useApp();
  const featured = !!p.featured;

  // Viền gradient bằng kỹ thuật 2 lớp background (padding-box trắng + border-box gradient).
  const ringStyle = featured
    ? {
        border: '2px solid transparent',
        background: `linear-gradient(#fff,#fff) padding-box, ${brandGradient} border-box`,
        boxShadow: `0 30px 60px -26px ${BRAND_GLOW}, 0 12px 24px -18px ${BRAND_GLOW}`,
      }
    : {
        border: '1px solid #efeaf8',
        background: '#fff',
        boxShadow: '0 22px 44px -34px rgba(80,40,140,.5)',
      };

  return (
    <div
      className="lift-card"
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 20,
        padding: featured ? '34px 28px 28px' : 28,
        marginTop: featured && !stacked ? -14 : undefined,
        ...ringStyle,
      }}
    >
      {featured && (
        <span style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', color: '#fff', background: brandGradient, borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: `0 10px 22px -10px ${BRAND_GLOW}` }}>
          ★ {popularLabel}
        </span>
      )}
      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: '#211c38' }}>{p.name}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#6b6680', marginTop: 6, minHeight: stacked ? undefined : 42 }}>{p.desc}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '18px 0 4px' }}>
        <StatNumber
          value={p.priceValue}
          suffix="đ"
          locales="vi-VN"
          style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 34, letterSpacing: '-.02em', color: featured ? '#2563eb' : '#171327' }}
        />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#8a85a0' }}>{p.cadence}</span>
      </div>
      <div style={{ height: 1, background: '#f0ecf8', margin: '16px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
        {p.features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <span style={{ flex: 'none', width: 19, height: 19, borderRadius: '50%', background: featured ? brandGradient : '#f3edff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              <Check size={12} strokeWidth={3} color={featured ? '#fff' : '#7c3aed'} />
            </span>
            <span style={{ fontSize: 13.5, lineHeight: 1.5, color: '#4b4660' }}>{f}</span>
          </div>
        ))}
      </div>
      <button
        className="btn-grad"
        onClick={() => go('register')}
        style={{
          width: '100%',
          marginTop: 24,
          border: 'none',
          borderRadius: 13,
          padding: 14,
          fontWeight: 700,
          fontSize: 14.5,
          cursor: 'pointer',
          color: '#fff',
          background: brandGradient,
          boxShadow: `0 16px 30px -14px ${BRAND_GLOW}`,
        }}
      >
        {p.cta}
      </button>
    </div>
  );
}
