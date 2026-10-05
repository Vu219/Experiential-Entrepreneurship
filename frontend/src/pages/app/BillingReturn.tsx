import { useCallback, useEffect, useState } from 'react';
import { CircleCheck, CircleX, Clock, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import PageContainer from '../../components/PageContainer';
import { Card, Loader } from '../../components/ui';
import {
  forgetPendingPayment,
  getBilling,
  readPendingPayment,
  verifyPayment,
  type Payment,
} from '../../api/payments';
import type { ApiError } from '../../api/apiClient';
import { C } from '../../styles/colors';

/**
 * Trang cổng thanh toán đưa TRÌNH DUYỆT quay về ({@code /billing/return}).
 *
 * <p><b>Query string mà payOS gắn vào URL này KHÔNG có chữ ký</b> (`code`, `status`, `cancel`,
 * `orderCode`…). Trang tuyệt đối không đọc nó để kết luận bất cứ điều gì — nó chỉ gọi
 * {@code POST /payments/{id}/verify} và để backend tự hỏi cổng qua đúng code path mà webhook
 * dùng. Ai sửa URL trên thanh địa chỉ cũng không đổi được kết quả.</p>
 *
 * <p>Đây cũng là đường DUY NHẤT kiểm chứng được ở localhost — webhook thật không tới được máy
 * dev.</p>
 */
export default function BillingReturn() {
  const { t, go } = useApp();
  const { refreshUser } = useAuth();

  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // paymentId do trang Billing nhớ lại lúc tạo đơn. Mất (đổi tab/chặn storage) thì lùi về
      // đọc đơn PENDING hiện tại — vẫn không đụng tới query string.
      let paymentId = readPendingPayment();
      if (!paymentId) {
        paymentId = (await getBilling()).pendingPayment?.id ?? null;
      }
      if (!paymentId) {
        setError(t.blReturnNoOrder);
        return;
      }
      const result = await verifyPayment(paymentId);
      setPayment(result);
      if (result.status !== 'PENDING') {
        forgetPendingPayment();
      }
      if (result.status === 'PAID') {
        // Nhãn gói trên topbar/menu đọc từ /users/me — làm mới để hiện gói mới ngay.
        void refreshUser();
      }
    } catch (e) {
      setError((e as ApiError).message || t.blErrGeneric);
    } finally {
      setLoading(false);
    }
  }, [refreshUser, t.blErrGeneric, t.blReturnNoOrder]);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const view = resolveView(payment, error, t);

  return (
    <PageContainer>
      <Card style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '36px 28px' }}>
        {loading ? (
          <>
            <Loader />
            <p style={{ margin: '14px 0 0', fontSize: 14, color: C.textSecondary }}>{t.blVerifying}</p>
          </>
        ) : (
          <>
            <span
              aria-hidden
              style={{
                width: 60, height: 60, borderRadius: '50%', background: view.bg,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <view.icon size={28} color={view.color} strokeWidth={1.9} />
            </span>
            <h1 style={{ margin: '16px 0 0', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 22, color: C.textStrong }}>
              {view.title}
            </h1>
            <p style={{ margin: '8px auto 0', fontSize: 14, lineHeight: 1.6, color: C.textSecondary, maxWidth: 420 }}>
              {view.message}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 22 }}>
              {view.canRecheck && (
                <button
                  className="btn-outline"
                  onClick={() => void run()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 12,
                    padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    color: C.textSecondary, background: C.surface, border: `1px solid ${C.border}`,
                  }}
                >
                  <RotateCcw size={16} strokeWidth={1.9} />
                  {t.blRecheck}
                </button>
              )}
              <button
                className="btn-grad"
                onClick={() => go('billing')}
                style={{
                  borderRadius: 12, padding: '11px 18px', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', color: C.onBrand, background: 'var(--brand)', border: 'none',
                }}
              >
                {t.blBackToBilling}
              </button>
            </div>
          </>
        )}
      </Card>
    </PageContainer>
  );
}

type Dict = ReturnType<typeof useApp>['t'];

/** Một trạng thái đơn → một màn hình. Không suy đoán gì từ URL. */
function resolveView(payment: Payment | null, error: string | null, t: Dict) {
  if (error) {
    return { icon: CircleX, color: C.danger, bg: C.dangerSoft, title: t.blErrGeneric, message: error, canRecheck: true };
  }
  switch (payment?.status) {
    case 'PAID':
      return { icon: CircleCheck, color: C.success, bg: C.successSoft, title: t.blReturnPaid, message: t.blReturnPaidSub, canRecheck: false };
    case 'FAILED':
      return { icon: CircleX, color: C.danger, bg: C.dangerSoft, title: t.blReturnFailed, message: t.blReturnFailedSub, canRecheck: false };
    case 'CANCELLED':
      return { icon: CircleX, color: C.gray, bg: C.graySoft, title: t.blReturnCancelled, message: t.blReturnFailedSub, canRecheck: false };
    case 'EXPIRED':
      return { icon: Clock, color: C.orange, bg: C.orangeSoft, title: t.blReturnExpired, message: t.blReturnFailedSub, canRecheck: false };
    default:
      // PENDING (hoặc chưa đọc được đơn): tiền có thể đang trên đường — cho user kiểm tra lại,
      // KHÔNG nói là thất bại.
      return { icon: Clock, color: C.warning, bg: C.warningSoft, title: t.blReturnPending, message: t.blReturnPendingSub, canRecheck: true };
  }
}
