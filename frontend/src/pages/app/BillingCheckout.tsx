import { useIsDark } from '../../hooks/useIsDark';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CircleAlert, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Loader } from '../../components/ui';
import { useToast } from '../../components/toast/ToastProvider';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import SelectedPlanCard from '../../components/billing/checkout/SelectedPlanCard';
import OrderSummaryCard from '../../components/billing/checkout/OrderSummaryCard';
import PaymentMethodList from '../../components/billing/checkout/PaymentMethodList';
import { PAYMENT_METHODS } from '../../config/paymentMethods';
import { getPublicPlans, type PlanDto } from '../../api/plans';
import {
  checkout,
  getBilling,
  getQuote,
  type CheckoutQuote,
  type Payment,
  type PaymentMethodCode,
} from '../../api/payments';
import type { ApiError } from '../../api/apiClient';
import { C } from '../../styles/colors';

/**
 * Trang trung gian "Xem lại đơn hàng" — `/billing/checkout?plan=<MÃ GÓI>`.
 *
 * <p>MỌI đường mua gói (trang Billing, bảng giá, landing) đều đi qua đây; đơn chỉ được tạo khi
 * bấm "Thanh toán ngay". Trang này chỉ ĐỌC báo giá — user bỏ ngang thì gói hiện tại không đổi gì.
 * Gói chỉ đổi khi tiền về (webhook/verify).</p>
 *
 * <p>URL dùng MÃ gói (không phải UUID) để landing/bảng giá dẫn thẳng tới được.</p>
 *
 * <p>Trang RIÊNG, không nằm trong AppShell (không sidebar/topbar) — kiểu trang thanh toán tập
 * trung: header gọn (logo + "Thanh toán an toàn") bằng {@link CheckoutLayout}.</p>
 */
export default function BillingCheckout() {
  const { t, lang, go } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const { isDesktop } = useBreakpoint();
  const [params] = useSearchParams();
  const planCode = (params.get('plan') ?? '').toUpperCase();

  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [pending, setPending] = useState<Payment | null>(null);
  const [method, setMethod] = useState<PaymentMethodCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paying, setPaying] = useState(false);

  const loadQuote = useCallback(async (planId: string) => {
    const [q, billing] = await Promise.all([getQuote(planId), getBilling()]);
    setQuote(q);
    setPending(billing.pendingPayment);
    // Giữ lựa chọn cũ nếu vẫn còn bật; không thì chọn phương thức đầu tiên.
    setMethod((prev) => (prev && q.paymentMethods.includes(prev) ? prev : q.paymentMethods[0] ?? null));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const payload = await getPublicPlans();
        const found = payload.plans.find((p) => p.code === planCode && p.isActive && p.price > 0);
        if (!alive) return;
        if (!found) {
          setNotFound(true);
          return;
        }
        setPlan(found);
        await loadQuote(found.id);
      } catch (e) {
        if (alive) toast.error((e as ApiError).message || t.blErrGeneric);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planCode]);

  const backToPlans = () => navigate('/billing');

  const handlePay = async () => {
    if (!plan || !quote || !method) return;
    setPaying(true);
    try {
      const order = await checkout(plan.id, method, quote.total);
      PAYMENT_METHODS[method].proceed(order);
    } catch (e) {
      const err = e as ApiError;
      toast.error(err.message || t.blErrGeneric);
      setPaying(false);
      // Báo giá đổi (PAYMENT_QUOTE_CHANGED — vd qua nửa đêm), đơn bị chặn hay đơn cũ đang đối
      // soát: nạp lại báo giá + đơn chờ để trang luôn hiện đúng con số backend sẽ thu.
      void loadQuote(plan.id).catch(() => undefined);
    }
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  const header = (
    <div>
      <button
        type="button"
        className="link-underline"
        onClick={backToPlans}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: C.primaryStrong }}
      >
        <ArrowLeft size={15} strokeWidth={2} />
        {t.coBack}
      </button>
      <h1 style={{ margin: '10px 0 0', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 26, color: C.textStrong }}>
        {t.coTitle}
      </h1>
      <p style={{ margin: '6px 0 0', fontSize: 14, color: C.textSecondary }}>{t.coSub}</p>
    </div>
  );

  if (notFound || !plan || !quote) {
    return (
      <CheckoutLayout onLogo={() => go('dashboard')} secureLabel={t.coSecure}>
        {header}
        <Card style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.textSecondary, fontSize: 14 }}>
          <CircleAlert size={18} strokeWidth={1.8} />
          {notFound ? t.coPlanNotFound : t.blErrGeneric}
        </Card>
      </CheckoutLayout>
    );
  }

  // Đơn chờ khác đơn này (khác gói hoặc khác số tiền) sẽ bị backend huỷ khi tạo đơn mới — nói trước.
  const replacesPending = quote.purchasable && !!pending
    && (pending.planCode !== quote.planCode || pending.amount !== quote.total);
  const pendingName = pending ? (lang === 'en' ? pending.planNameEn : pending.planNameVi) : '';
  const canPay = quote.purchasable && !!method && !paying;

  return (
    <CheckoutLayout onLogo={() => go('dashboard')} secureLabel={t.coSecure}>
      {header}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? 'minmax(0, 1.55fr) minmax(0, 1fr)' : 'minmax(0, 1fr)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <SelectedPlanCard plan={plan} quote={quote} onChangePlan={backToPlans} />
          <PaymentMethodList
            methods={quote.paymentMethods}
            selected={method}
            onSelect={setMethod}
            disabled={paying || !quote.purchasable}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: isDesktop ? 'sticky' : undefined, top: 24 }}>
          {replacesPending && (
            <Card style={{ padding: 16, fontSize: 13, lineHeight: 1.55, color: C.textSecondary }}>
              {t.coPendingReplace.replace('{plan}', pendingName)}
            </Card>
          )}
          <OrderSummaryCard quote={quote} canPay={canPay} paying={paying} onPay={handlePay} />
        </div>
      </div>
    </CheckoutLayout>
  );
}

/**
 * Khung trang thanh toán riêng: nền gradient nhạt (cùng tông trang Hoàn thiện hồ sơ), header
 * trắng cao 70px (bằng topbar app) chỉ có logo + nhãn "Thanh toán an toàn" — bỏ hết menu để user
 * tập trung vào đơn hàng. Nội dung căn giữa, tối đa 1180px.
 */
function CheckoutLayout({ onLogo, secureLabel, children }: {
  onLogo: () => void;
  secureLabel: string;
  children: ReactNode;
}) {
  const { isMobile } = useBreakpoint();
  const padX = isMobile ? 16 : 32;
  const isDark = useIsDark();
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.10),transparent 55%),radial-gradient(900px 700px at 90% 90%,rgba(217,70,239,.09),transparent 55%),linear-gradient(160deg,${C.bg},${C.surfaceMuted} 55%,${C.surfaceMuted})`,
      }}
    >
      <header style={{ height: 70, background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1180, height: '100%', margin: '0 auto', padding: `0 ${padX}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" onClick={onLogo} aria-label="AIMA" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}>
            <img className="logo-hover" src={isDark ? "/aima-h-dark.png" : "/aima-logo.png"} alt="AIMA" style={{ height: 46, width: 'auto', display: 'block' }} />
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: C.textSecondary }}>
            <Lock size={15} strokeWidth={2} color={C.success} />
            {secureLabel}
          </span>
        </div>
      </header>
      <main className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', padding: `28px ${padX}px 48px`, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {children}
      </main>
    </div>
  );
}
