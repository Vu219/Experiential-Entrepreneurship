import type { ReactNode } from 'react';
import { CircleAlert, Info, ShieldCheck } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Card } from '../../ui';
import { formatVND } from '../../../api/admin';
import { formatDateVN } from '../../../utils/format';
import { TONE_COLORS } from '../../../statusTokens';
import type { CheckoutQuote } from '../../../api/payments';

/**
 * Khối "Tóm tắt đơn hàng" + nút "Thanh toán ngay".
 *
 * <p>Mọi con số lấy nguyên văn từ báo giá của backend — FE KHÔNG tự tính lại. Các dòng luôn cộng
 * khớp: tạm tính − khấu trừ − làm tròn = tổng. Dòng khấu trừ kèm công thức để user hiểu vì sao
 * tổng là con số đó (user chốt 26/9: hiển thị công thức minh bạch, tách riêng dòng làm tròn).</p>
 */
export default function OrderSummaryCard({
  quote,
  canPay,
  paying,
  onPay,
}: {
  quote: CheckoutQuote;
  canPay: boolean;
  paying: boolean;
  onPay: () => void;
}) {
  const { t, lang, brandGradient } = useApp();
  const planName = lang === 'en' ? quote.planNameEn : quote.planNameVi;
  const currentName = (lang === 'en' ? quote.currentPlanNameEn : quote.currentPlanNameVi) ?? '';
  const cycle = quote.billingIntervalMonths > 1
    ? t.blPerCycle.replace('{n}', String(quote.billingIntervalMonths))
    : t.blPerMonth;
  const hasCredit = quote.prorationCredit !== null && quote.prorationRemainingDays !== null;

  const hint = (() => {
    if (quote.orderType === 'UPGRADE') return t.coHintUpgrade.replace('{plan}', currentName);
    if (quote.orderType === 'RENEW') {
      return t.coHintRenew.replace('{plan}', currentName).replace('{date}', formatDateVN(quote.currentPlanExpiresAt));
    }
    return quote.currentPlanCode ? t.coHintReplaceGranted.replace('{plan}', currentName) : t.coHintNew;
  })();

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8a85a0' }}>
        {t.coSummary}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Row label={t.coSubtotal} sub={planName} value={formatVND(quote.subtotal)} />
        {hasCredit && (
          <Row
            label={t.coCredit.replace('{plan}', currentName).replace('{days}', String(quote.prorationRemainingDays))}
            sub={t.coCreditFormula
              .replace('{price}', formatVND(quote.oldListPrice ?? 0))
              .replace('{days}', String(quote.prorationRemainingDays))
              .replace('{cycle}', String(quote.prorationCycleDays))}
            value={`−${formatVND(quote.prorationCredit ?? 0)}`}
            accent
          />
        )}
        {quote.roundingAmount > 0 && (
          <Row label={t.coRounding} sub={t.coRoundingHint} value={`−${formatVND(quote.roundingAmount)}`} accent />
        )}
        <Row label={t.coTax} value={formatVND(0)} />
        <Row label={t.coCycle} value={cycle} />
        {quote.purchasable && quote.newExpiresAt && (
          <Row label={t.coNewExpiry} value={formatDateVN(quote.newExpiresAt)} />
        )}
      </div>

      <div style={{ height: 1, background: '#f0ecf8' }} />

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#1b1730' }}>{t.coTotal}</span>
        <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 28, color: '#171327' }}>
          {/* Đơn bị chặn có thể ra tổng ≤ 0 — không hiện một "số tiền" không bao giờ bị thu. */}
          {quote.purchasable ? formatVND(quote.total) : '—'}
        </span>
      </div>

      {quote.purchasable ? (
        <Note icon={<Info size={15} strokeWidth={2} />} tone="info">{hint}</Note>
      ) : (
        <Note icon={<CircleAlert size={15} strokeWidth={2} />} tone="warning">
          <strong style={{ display: 'block', marginBottom: 2 }}>{t.coBlockedTitle}</strong>
          {quote.blockedMessage}
          {quote.currentPlanExpiresAt && (
            <> {t.coBlockedExpiry.replace('{date}', formatDateVN(quote.currentPlanExpiresAt))}</>
          )}
        </Note>
      )}

      <button
        type="button"
        className={canPay ? 'btn-grad' : undefined}
        disabled={!canPay}
        onClick={onPay}
        style={{
          width: '100%', border: 'none', borderRadius: 13, padding: 14,
          fontWeight: 700, fontSize: 15, cursor: canPay ? 'pointer' : 'not-allowed',
          color: canPay ? '#fff' : '#a39bbf', background: canPay ? brandGradient : '#f2f0f8',
        }}
      >
        {paying ? t.coPaying : t.coPayNow}
      </button>

      <p style={{ margin: 0, display: 'flex', gap: 7, fontSize: 12.5, lineHeight: 1.5, color: '#8a85a0' }}>
        <ShieldCheck size={15} strokeWidth={1.8} style={{ flex: 'none', marginTop: 1 }} />
        {t.coServerNote}
      </p>
    </Card>
  );
}

function Row({ label, sub, value, accent }: { label: string; sub?: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, color: '#4b4660' }}>{label}</div>
        {sub && <div style={{ marginTop: 2, fontSize: 12.5, color: '#8a85a0' }}>{sub}</div>}
      </div>
      <span style={{ flex: 'none', fontSize: 14, fontWeight: 700, color: accent ? TONE_COLORS.success.color : '#1b1730' }}>{value}</span>
    </div>
  );
}

function Note({ icon, tone, children }: { icon: ReactNode; tone: 'info' | 'warning'; children: ReactNode }) {
  const palette = TONE_COLORS[tone === 'info' ? 'purple' : 'warning'];
  return (
    <div style={{ display: 'flex', gap: 9, padding: '11px 13px', borderRadius: 12, background: palette.bg, color: palette.color, fontSize: 13, lineHeight: 1.55 }}>
      <span style={{ flex: 'none', marginTop: 2 }}>{icon}</span>
      <span>{children}</span>
    </div>
  );
}
