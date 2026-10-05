import { ArrowLeftRight, Check } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Card } from '../../ui';
import StatusBadge, { type Tone } from '../../admin/StatusBadge';
import { formatVND } from '../../../api/admin';
import type { PlanDto } from '../../../api/plans';
import type { CheckoutQuote, OrderType } from '../../../api/payments';
import { C } from '../../../styles/colors';

const TYPE_TONE: Record<OrderType, Tone> = { NEW: 'info', RENEW: 'success', UPGRADE: 'purple' };

/** Khối "Gói đã chọn": tên, tính năng/giới hạn, đơn giá + link quay lại bước chọn gói. */
export default function SelectedPlanCard({
  plan,
  quote,
  onChangePlan,
}: {
  plan: PlanDto;
  quote: CheckoutQuote;
  onChangePlan: () => void;
}) {
  const { t, lang } = useApp();
  const name = lang === 'en' ? plan.nameEn : plan.nameVi;
  const description = lang === 'en' ? plan.descriptionEn : plan.descriptionVi;
  const features = lang === 'en' ? plan.featuresEn : plan.featuresVi;
  const cycle = plan.billingIntervalMonths > 1
    ? t.blPerCycle.replace('{n}', String(plan.billingIntervalMonths))
    : t.blPerMonth;
  const typeLabel = { NEW: t.coTypeNew, RENEW: t.coTypeRenew, UPGRADE: t.coTypeUpgrade }[quote.orderType];

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.textMuted }}>
          {t.coSelectedPlan}
        </p>
        {/* Đơn bị chặn (vd chọn gói rẻ hơn) không phải "nâng cấp" thật — không gắn nhãn loại đơn. */}
        {quote.purchasable && <StatusBadge tone={TYPE_TONE[quote.orderType]} label={typeLabel} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
        <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, color: C.textStrong }}>{name}</span>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 13, color: C.textMuted }}>{t.coUnitPrice}</span>
          <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 22, color: C.ink900 }}>
            {formatVND(plan.price)}
          </span>
          <span style={{ fontSize: 13, color: C.textMuted }}>/ {cycle}</span>
        </span>
      </div>
      {description && (
        <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.55, color: C.textSecondary }}>{description}</p>
      )}

      {features.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px 18px', marginTop: 18 }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ flex: 'none', width: 17, height: 17, borderRadius: '50%', background: C.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                <Check size={11} strokeWidth={3} color={C.primary} />
              </span>
              <span style={{ fontSize: 13.5, lineHeight: 1.5, color: C.ink650 }}>{f}</span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn-soft"
        onClick={onChangePlan}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 20,
          border: `1px solid ${C.accentLine}`, borderRadius: 10, padding: '8px 14px',
          background: C.surfaceMuted, color: C.primaryStrong, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}
      >
        <ArrowLeftRight size={14} strokeWidth={2} />
        {t.coChangePlan}
      </button>
    </Card>
  );
}
