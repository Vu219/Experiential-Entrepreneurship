import { Check, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { formatVND } from '../../api/admin';
import type { PlanDto } from '../../api/plans';
import type { BillingOverview } from '../../api/payments';
import { C } from '../../styles/colors';

/**
 * Lưới gói bán được. Chỉ gói `isActive && price > 0` — gói Free không có gì để mua.
 *
 * <p>Nhãn nút phản ánh ĐÚNG việc backend sẽ làm (Q1): trùng gói đang còn hạn thì
 * <b>cộng dồn</b> thêm một chu kỳ, gói ĐẮT HƠN thì <b>nâng cấp</b> (khấu trừ phần còn lại), gói
 * không đắt hơn khi gói hiện tại còn hạn thì backend CHẶN — nên ở đây khoá luôn nút. Bấm nút chỉ
 * mở trang "Xem lại đơn hàng"; con số và mọi quyết định chặn cuối cùng do backend báo giá.</p>
 */
export default function PlanChoiceGrid({
  plans,
  billing,
  onBuy,
}: {
  plans: PlanDto[];
  billing: BillingOverview;
  onBuy: (plan: PlanDto) => void;
}) {
  const { t, lang, brandGradient } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const cols = isMobile ? 1 : isTablet ? 2 : 3;

  // "Còn hạn" là điều kiện duy nhất khiến backend chặn đổi sang gói không đắt hơn; hết hạn rồi
  // thì mua gói nào cũng được.
  const planStillValid = !!billing.planExpiresAt;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 16 }}>
      {plans.map((plan) => {
        const isCurrent = plan.code === billing.planCode;
        // Cùng tiêu chí với backend (user chốt 26/9): đổi gói khi còn hạn chỉ được lên gói ĐẮT
        // HƠN. `billing.price` là giá hiện tại của gói — backend so với giá niêm yết lúc mua,
        // nên đây chỉ là gợi ý sớm; trang xem lại mới là nơi báo chặn chính xác.
        const lower = planStillValid && !isCurrent && plan.price <= billing.price;

        const label = lower ? t.blDowngradeLocked : isCurrent ? t.blRenew : t.blUpgrade;
        const disabled = lower;

        return (
          <div
            key={plan.id}
            className={disabled ? undefined : 'lift-card'}
            style={{
              display: 'flex', flexDirection: 'column', borderRadius: 18, padding: 20,
              background: C.surface,
              border: isCurrent ? '2px solid transparent' : `1px solid ${C.border}`,
              backgroundImage: isCurrent ? `linear-gradient(${C.surface},${C.surface}), ${brandGradient}` : undefined,
              backgroundOrigin: isCurrent ? 'padding-box, border-box' : undefined,
              backgroundClip: isCurrent ? 'padding-box, border-box' : undefined,
              boxShadow: `0 22px 44px -34px ${C.legacyShadowrgba8040140_5_}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: C.textStrong }}>
                {lang === 'en' ? plan.nameEn : plan.nameVi}
              </span>
              {isCurrent && (
                <span style={{ fontSize: 11, fontWeight: 800, color: C.primaryStrong, background: C.primarySoft, border: `1px solid ${C.accentLine}`, borderRadius: 999, padding: '2px 9px' }}>
                  {t.blCurrent}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '12px 0 2px' }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 26, color: C.ink900 }}>
                {formatVND(plan.price)}
              </span>
              <span style={{ fontSize: 13, color: C.textMuted }}>
                / {plan.billingIntervalMonths > 1 ? t.blPerCycle.replace('{n}', String(plan.billingIntervalMonths)) : t.blPerMonth}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0 18px', flex: 1 }}>
              {(lang === 'en' ? plan.teaserFeaturesEn : plan.teaserFeaturesVi).slice(0, 3).map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ flex: 'none', width: 17, height: 17, borderRadius: '50%', background: C.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    <Check size={11} strokeWidth={3} color={C.primary} />
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: C.ink650 }}>{f}</span>
                </div>
              ))}
            </div>

            <button
              className={disabled ? undefined : 'btn-grad'}
              disabled={disabled}
              onClick={() => onBuy(plan)}
              title={lower ? t.blDowngradeLocked : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', border: 'none', borderRadius: 12, padding: '12px 14px',
                fontWeight: 700, fontSize: 14,
                cursor: disabled ? 'not-allowed' : 'pointer',
                color: disabled ? C.ink350 : C.onBrand,
                background: disabled ? C.surfaceMuted : brandGradient,
              }}
            >
              {lower && <Lock size={14} strokeWidth={2} />}
              {label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
