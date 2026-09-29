import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import PageContainer from '../../components/PageContainer';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../components/toast/ToastProvider';
import CurrentPlanCard from '../../components/billing/CurrentPlanCard';
import PendingOrderCard from '../../components/billing/PendingOrderCard';
import PlanChoiceGrid from '../../components/billing/PlanChoiceGrid';
import BillingSkeleton from '../../components/billing/BillingSkeleton';
import PaymentHistory from '../../components/billing/PaymentHistory';
import { getPublicPlans, type PlanDto } from '../../api/plans';
import {
  cancelPayment,
  getBilling,
  listPayments,
  type BillingOverview,
  type Payment,
} from '../../api/payments';
import type { ApiError } from '../../api/apiClient';

const PAGE_SIZE = 10;

/**
 * Trang "Gói & thanh toán" của user.
 *
 * <p>Gói hiển thị lấy từ {@code GET /payments/billing} (đọc bảng subscriptions — nguồn sự
 * thật), KHÔNG lấy từ nhãn {@code user.plan} trong AuthContext: nhãn đó chỉ là cache một
 * chiều nên có thể lệch với gói thật (vd gói do admin tự tạo không có nhãn enum).</p>
 *
 * <p>Chọn gói KHÔNG tạo đơn ngay: chuyển sang trang "Xem lại đơn hàng"
 * ({@code /billing/checkout}), đơn chỉ được tạo khi bấm "Thanh toán ngay" ở đó. Kết quả thanh
 * toán KHÔNG đọc từ query string lúc quay về — trang {@code /billing/return} gọi endpoint verify
 * để backend tự hỏi cổng.</p>
 */
export default function Billing() {
  const { t } = useApp();
  const { refreshUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Payment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [history, setHistory] = useState<Payment[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyLast, setHistoryLast] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadBilling = useCallback(async () => {
    const data = await getBilling();
    setBilling(data);
    return data;
  }, []);

  const loadHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const res = await listPayments({ page, size: PAGE_SIZE });
      setHistory((prev) => (page === 0 ? res.content : [...prev, ...res.content]));
      setHistoryPage(res.page);
      setHistoryLast(res.last);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [data, plansPayload] = await Promise.all([getBilling(), getPublicPlans()]);
        if (!alive) return;
        setBilling(data);
        // Bán MỌI gói đang bật và có giá — kể cả gói admin tự tạo (Q4). Free không có gì để mua.
        setPlans(plansPayload.plans.filter((p) => p.isActive && p.price > 0));
      } catch (e) {
        if (alive) toast.error((e as ApiError).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    void loadHistory(0);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuy = (plan: PlanDto) => {
    navigate(`/billing/checkout?plan=${encodeURIComponent(plan.code)}`);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const updated = await cancelPayment(cancelTarget.id);
      setCancelTarget(null);
      await loadBilling();
      void loadHistory(0);
      // Race huỷ/PAID: backend kích hoạt gói thay vì huỷ nếu tiền đã về — nói đúng việc đã xảy ra.
      if (updated.status === 'PAID') {
        toast.success(t.blReturnPaid);
        void refreshUser();
      }
    } catch (e) {
      toast.error((e as ApiError).message || t.blErrGeneric);
    } finally {
      setCancelling(false);
    }
  };

  // Hết giờ đếm ngược: KHÔNG tự coi là đã huỷ. Job đóng đơn chạy mỗi phút, và nếu cổng báo
  // đã trả tiền thì đơn được kích hoạt — chỉ có backend mới biết trạng thái thật.
  const handleCountdownExpired = useCallback(() => {
    void loadBilling().catch(() => undefined);
    void loadHistory(0).catch(() => undefined);
  }, [loadBilling, loadHistory]);

  if (loading) {
    return (
      <PageContainer role="status" aria-busy="true">
        <BillingSkeleton />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {billing && <CurrentPlanCard billing={billing} />}

      {billing?.pendingPayment && (
        <PendingOrderCard
          billing={billing}
          onCancel={setCancelTarget}
          onRefresh={handleCountdownExpired}
        />
      )}

      {billing && plans.length > 0 && (
        <div>
          <h2 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 18, color: '#1b1730' }}>
            {t.blChoosePlan}
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#8a85a0' }}>{t.blChoosePlanSub}</p>
          <PlanChoiceGrid plans={plans} billing={billing} onBuy={handleBuy} />
        </div>
      )}

      <PaymentHistory
        items={history}
        loading={historyLoading}
        hasMore={!historyLast}
        onLoadMore={() => void loadHistory(historyPage + 1)}
      />

      {cancelTarget && (
        <ConfirmModal
          title={t.blCancelOrder}
          message={t.blCancelConfirm}
          confirmLabel={t.blCancelOrder}
          busy={cancelling}
          variant="warning"
          onConfirm={handleCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </PageContainer>
  );
}
