import { useState } from 'react';
import { CircleAlert, Clock, ExternalLink, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui';
import { formatVND } from '../../api/admin';
import type { BillingOverview, Payment } from '../../api/payments';
import { formatCountdown, useServerCountdown } from './useServerCountdown';

/**
 * Đơn đang chờ thanh toán — tối đa MỘT trên mỗi user (ràng buộc partial unique ở DB).
 *
 * <p>Hai cái bẫy phía giao diện, đều đã xử lý ở đây:</p>
 * <ol>
 *   <li><b>Đếm ngược theo giờ SERVER</b> ({@code billing.serverTime}), không theo đồng hồ máy.</li>
 *   <li><b>Về 0 KHÔNG có nghĩa là đơn đã huỷ.</b> Job đóng đơn chạy mỗi phút nên luôn có độ
 *       trễ, và nếu cổng báo đã trả tiền thì đơn được KÍCH HOẠT chứ không đóng. Hết giờ thì
 *       gọi lại API lấy trạng thái thật, không tự kết luận.</li>
 * </ol>
 */
export default function PendingOrderCard({
  billing,
  onCancel,
  onRefresh,
}: {
  billing: BillingOverview;
  onCancel: (payment: Payment) => void;
  onRefresh: () => void;
}) {
  const { t, lang } = useApp();
  const payment = billing.pendingPayment!;
  const [expired, setExpired] = useState(false);

  const remaining = useServerCountdown(payment.expiresAt, billing.serverTime, () => {
    setExpired(true);
    onRefresh();
  });

  const planName = lang === 'en' ? payment.planNameEn : payment.planNameVi;
  // checkoutUrl rỗng = lần tạo link không kết luận được, đơn đang chờ đối soát. Không có gì
  // để bấm vào trả tiền, nên nút phải KHOÁ kèm lời giải thích — để nút sống chỉ tổ dẫn user
  // tới một trang trắng.
  const payable = !!payment.checkoutUrl;

  return (
    <Card style={{ borderColor: '#f6dfae', background: 'linear-gradient(180deg,#fffdf7,#fff)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span aria-hidden style={{ width: 40, height: 40, borderRadius: 12, background: '#fdf0dc', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <Clock size={19} color="#d97706" strokeWidth={1.9} />
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1b1730' }}>{t.blPendingTitle}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13.5, color: '#6b6680' }}>
              {planName} · {formatVND(payment.amount)}
              {payment.invoiceNo ? ` · ${payment.invoiceNo}` : ''}
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#8a85a0' }}>{t.blPendingLeft}</p>
          <p
            style={{
              margin: '1px 0 0', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800,
              fontSize: 22, letterSpacing: '-.01em',
              color: remaining !== null && remaining < 60_000 ? '#dc2626' : '#1b1730',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCountdown(remaining)}
          </p>
        </div>
      </div>

      {!payable && <Hint text={t.blNoLinkHint} />}
      {payable && expired && <Hint text={t.blExpiredHint} />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
        <a
          className={payable ? 'btn-grad' : undefined}
          href={payment.checkoutUrl ?? undefined}
          aria-disabled={!payable}
          onClick={(e) => {
            if (!payable) e.preventDefault();
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 12,
            padding: '11px 18px', fontSize: 14, fontWeight: 700, textDecoration: 'none',
            color: payable ? '#fff' : '#a39bbf',
            background: payable ? 'var(--brand)' : '#f2f0f8',
            border: payable ? 'none' : '1px solid #eae6f4',
            cursor: payable ? 'pointer' : 'not-allowed',
            pointerEvents: payable ? undefined : 'none',
          }}
        >
          <ExternalLink size={16} strokeWidth={1.9} />
          {t.blContinuePay}
        </a>

        <button
          className="btn-outline"
          onClick={() => onCancel(payment)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 12,
            padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            color: '#6b6680', background: '#fff', border: '1px solid #eae6f4',
          }}
        >
          <X size={16} strokeWidth={1.9} />
          {t.blCancelOrder}
        </button>
      </div>
    </Card>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 14,
        padding: '11px 13px', borderRadius: 12, background: '#fdf0dc', border: '1px solid #f6dfae',
      }}
    >
      <CircleAlert size={16} strokeWidth={1.9} color="#b45309" style={{ flex: 'none', marginTop: 1 }} />
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: '#7c4a08' }}>{text}</p>
    </div>
  );
}
