import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CircleCheck, CircleX, Clock, FlaskConical } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import PageContainer from '../../components/PageContainer';
import { Card } from '../../components/ui';
import { useToast } from '../../components/toast/ToastProvider';
import { applyMockOutcome, type MockOutcome } from '../../api/payments';
import type { ApiError } from '../../api/apiClient';

/**
 * Cổng thanh toán GIẢ LẬP — chỗ thay cho trang payOS ở môi trường dev
 * ({@code PAYMENT_GATEWAY=mock}). Backend khoá ba lớp, production luôn trả 403.
 *
 * <p>Ba nút chỉ đặt trạng thái link phía cổng giả lập rồi đi qua ĐÚNG
 * {@code applyGatewayResult(...)} mà webhook thật dùng — không có nhánh xử lý riêng cho mock,
 * nếu không thì thứ được test ở dev sẽ khác thứ chạy thật.</p>
 *
 * <p>Sau khi bấm, điều hướng sang {@code /billing/return} y như payOS thật làm, để đường đối
 * soát cũng được chạy thử luôn.</p>
 */
export default function BillingMock() {
  const { t } = useApp();
  const { paymentId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState<MockOutcome | null>(null);

  const run = async (outcome: MockOutcome) => {
    setBusy(outcome);
    try {
      await applyMockOutcome(paymentId, outcome);
      navigate('/billing/return', { replace: true });
    } catch (e) {
      toast.error((e as ApiError).message || t.blErrGeneric);
      setBusy(null);
    }
  };

  const options: { outcome: MockOutcome; label: string; icon: typeof CircleCheck; color: string; bg: string }[] = [
    { outcome: 'success', label: t.blMockSuccess, icon: CircleCheck, color: '#16a34a', bg: '#e8f8ee' },
    { outcome: 'failed', label: t.blMockFailed, icon: CircleX, color: '#dc2626', bg: '#fde8e8' },
    { outcome: 'timeout', label: t.blMockTimeout, icon: Clock, color: '#c2410c', bg: '#ffedd5' },
  ];

  return (
    <PageContainer>
      <Card style={{ maxWidth: 560, margin: '0 auto', padding: '32px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden style={{ width: 44, height: 44, borderRadius: 14, background: '#f1e9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <FlaskConical size={21} color="#7c3aed" strokeWidth={1.8} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20, color: '#1b1730' }}>
              {t.blMockTitle}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.55, color: '#6b6680' }}>{t.blMockSub}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
          {options.map((o) => (
            <button
              key={o.outcome}
              disabled={busy !== null}
              onClick={() => void run(o.outcome)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '14px 16px', borderRadius: 14, cursor: busy ? 'progress' : 'pointer',
                background: '#fff', border: '1px solid #eae6f4', textAlign: 'left',
                opacity: busy && busy !== o.outcome ? 0.55 : 1,
              }}
            >
              <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, background: o.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <o.icon size={17} color={o.color} strokeWidth={1.9} />
              </span>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: '#1b1730' }}>
                {busy === o.outcome ? t.blLoading : o.label}
              </span>
            </button>
          ))}
        </div>

        <p style={{ margin: '18px 0 0', fontSize: 12, color: '#a39bbf', wordBreak: 'break-all' }}>#{paymentId}</p>
      </Card>
    </PageContainer>
  );
}
