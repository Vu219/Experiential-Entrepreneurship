import { Fragment, type ReactNode } from 'react';
import { CalendarClock, Coins, Infinity as InfinityIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card } from '../ui';
import StatusBadge from '../admin/StatusBadge';
import { formatVND } from '../../api/admin';
import { formatDateVN } from '../../utils/format';
import type { BillingOverview } from '../../api/payments';

/**
 * Gói đang dùng — đọc từ `subscriptions` (nguồn sự thật), KHÔNG từ nhãn `user.plan`.
 *
 * <p>`planExpiresAt = null` nghĩa là gói KHÔNG hết hạn (Free hoặc admin cấp), không phải
 * "đã hết hạn" — hiển thị sai chỗ này là làm user hoảng vô cớ.</p>
 */
export default function CurrentPlanCard({ billing }: { billing: BillingOverview }) {
  const { t, lang, brandGradient } = useApp();
  const { isDesktop } = useBreakpoint();
  const planName = lang === 'en' ? billing.planNameEn : billing.planNameVi;

  const sourceMeta = {
    FREE: { tone: 'neutral' as const, label: t.blSourceFree },
    PAYMENT: { tone: 'success' as const, label: t.blSourcePayment },
    ADMIN: { tone: 'info' as const, label: t.blSourceAdmin },
  }[billing.planSource];

  const cycleLabel =
    billing.billingIntervalMonths && billing.billingIntervalMonths > 1
      ? t.blPerCycle.replace('{n}', String(billing.billingIntervalMonths))
      : t.blPerMonth;

  const facts = [
    <Fact
      key="expires"
      icon={<CalendarClock size={16} strokeWidth={1.8} />}
      label={t.blExpiresOn}
      value={billing.planExpiresAt ? formatDateVN(billing.planExpiresAt) : t.blNoExpiry}
      muted={!billing.planExpiresAt}
    />,
    <Fact
      key="reset"
      icon={<CalendarClock size={16} strokeWidth={1.8} />}
      label={t.blQuotaReset}
      value={formatDateVN(billing.currentPeriodEnd)}
    />,
    <Fact
      key="limit"
      icon={<InfinityIcon size={16} strokeWidth={1.8} />}
      label={t.blTokenLimit}
      value={
        billing.monthlyTokenLimit === null
          ? t.blUnlimited
          : billing.monthlyTokenLimit.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')
      }
    />,
    billing.planStartedAt && (
      <Fact
        key="started"
        icon={<CalendarClock size={16} strokeWidth={1.8} />}
        label={t.blStartedOn}
        value={formatDateVN(billing.planStartedAt)}
      />
    ),
  ];

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <span
        aria-hidden
        style={{
          width: 44, height: 44, borderRadius: 14, background: brandGradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
        }}
      >
        <Coins size={21} color="#fff" strokeWidth={1.8} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8a85a0' }}>
          {t.blCurrentPlan}
        </p>
        <p style={{ margin: '2px 0 0', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, color: '#1b1730' }}>
          {planName}
        </p>
      </div>
    </div>
  );

  // Badge nguồn gói (kèm giá nếu có) luôn nằm sát mép phải card.
  const badge = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
      {billing.price > 0 && (
        <span style={{ fontSize: 14, fontWeight: 700, color: '#4b4660' }}>
          {formatVND(billing.price)} <span style={{ fontWeight: 500, color: '#8a85a0' }}>/ {cycleLabel}</span>
        </span>
      )}
      <StatusBadge tone={sourceMeta.tone} label={sourceMeta.label} />
    </div>
  );

  // Desktop: một hàng duy nhất, các cột dàn đều hết chiều ngang card, ngăn bởi đường kẻ dọc mờ.
  if (isDesktop) {
    const columns = [header, ...facts, badge].filter(Boolean);
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px 24px' }}>
          {columns.map((col, i) => (
            <Fragment key={i}>
              {i > 0 && <span aria-hidden style={{ width: 1, alignSelf: 'stretch', background: '#ece8f6' }} />}
              {col}
            </Fragment>
          ))}
        </div>
      </Card>
    );
  }

  // Tablet/mobile: tên gói + badge ở hàng trên, các mục thông tin xuống lưới 2 cột.
  return (
    <Card>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        {header}
        {badge}
      </div>

      <div style={{ height: 1, background: '#f0ecf8', margin: '18px 0' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        {facts}
      </div>
    </Card>
  );
}

function Fact({ icon, label, value, muted = false }: { icon: ReactNode; label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span aria-hidden style={{ color: '#a39bbf', display: 'flex', marginTop: 2 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: '#8a85a0' }}>{label}</p>
        <p style={{ margin: '1px 0 0', fontSize: 14.5, fontWeight: 700, color: muted ? '#6b6680' : '#1b1730' }}>{value}</p>
      </div>
    </div>
  );
}
