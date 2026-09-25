import { Check, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { formatVND } from '../../api/admin';
import type { PlanDto } from '../../api/plans';
import type { BillingOverview } from '../../api/payments';

/**
 * Lưới gói bán được. Chỉ gói `isActive && price > 0` — gói Free không có gì để mua.
 *
 * <p>Nhãn nút phản ánh ĐÚNG việc backend sẽ làm (Q1): trùng gói đang còn hạn thì
 * <b>cộng dồn</b> thêm một chu kỳ, gói cao hơn thì <b>thay thế</b>, gói thấp hơn khi gói hiện
 * tại còn hạn thì backend CHẶN — nên ở đây khoá luôn nút cho khỏi bấm rồi nhận lỗi.</p>
 */
export default function PlanChoiceGrid({
  plans,
  billing,
  busyPlanId,
  onBuy,
}: {
  plans: PlanDto[];
  billing: BillingOverview;
  busyPlanId: string | null;
  onBuy: (plan: PlanDto) => void;
}) {
  const { t, lang, brandGradient } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const cols = isMobile ? 1 : isTablet ? 2 : 3;

  // "Còn hạn" là điều kiện duy nhất khiến backend chặn mua gói thấp hơn; hết hạn rồi thì
  // mua gói nào cũng được.
  const planStillValid = !!billing.planExpiresAt;
  const currentQuota = billing.monthlyTokenLimit;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 16 }}>
      {plans.map((plan) => {
        const isCurrent = plan.code === billing.planCode;
        // Cùng tiêu chí "hạ gói" với backend: so hạn mức token, null = không giới hạn = cao nhất.
        const lower =
          planStillValid &&
          !isCurrent &&
          plan.tokenQuota !== null &&
          (currentQuota === null || plan.tokenQuota < currentQuota);

        const busy = busyPlanId === plan.id;
        // Không dùng icon spinner riêng: dự án chưa có class xoay dùng chung, thêm keyframes
        // mới cho một nút là thừa — đổi nhãn nút là đủ rõ.
        const label = busy ? t.blLoading : lower ? t.blDowngradeLocked : isCurrent ? t.blRenew : t.blUpgrade;
        const disabled = lower || busy || busyPlanId !== null;

        return (
          <div
            key={plan.id}
            className={disabled ? undefined : 'lift-card'}
            style={{
              display: 'flex', flexDirection: 'column', borderRadius: 18, padding: 20,
              background: '#fff',
              border: isCurrent ? '2px solid transparent' : '1px solid #efeaf8',
              backgroundImage: isCurrent ? `linear-gradient(#fff,#fff), ${brandGradient}` : undefined,
              backgroundOrigin: isCurrent ? 'padding-box, border-box' : undefined,
              backgroundClip: isCurrent ? 'padding-box, border-box' : undefined,
              boxShadow: '0 22px 44px -34px rgba(80,40,140,.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: '#211c38' }}>
                {lang === 'en' ? plan.nameEn : plan.nameVi}
              </span>
              {isCurrent && (
                <span style={{ fontSize: 11, fontWeight: 800, color: '#6d28d9', background: '#f3edff', border: '1px solid #e7d9fb', borderRadius: 999, padding: '2px 9px' }}>
                  {t.blCurrent}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '12px 0 2px' }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 26, color: '#171327' }}>
                {formatVND(plan.price)}
              </span>
              <span style={{ fontSize: 13, color: '#8a85a0' }}>
                / {plan.billingIntervalMonths > 1 ? t.blPerCycle.replace('{n}', String(plan.billingIntervalMonths)) : t.blPerMonth}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0 18px', flex: 1 }}>
              {(lang === 'en' ? plan.teaserFeaturesEn : plan.teaserFeaturesVi).slice(0, 3).map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ flex: 'none', width: 17, height: 17, borderRadius: '50%', background: '#f3edff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    <Check size={11} strokeWidth={3} color="#7c3aed" />
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: '#4b4660' }}>{f}</span>
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
                color: disabled ? '#a39bbf' : '#fff',
                background: disabled ? '#f2f0f8' : brandGradient,
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
