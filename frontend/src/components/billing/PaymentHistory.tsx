import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card } from '../ui';
import StatusBadge from '../admin/StatusBadge';
import { formatVND } from '../../api/admin';
import { paymentStatusMeta } from '../../api/revenue';
import { formatDateTimeVN } from '../../utils/format';
import type { Payment } from '../../api/payments';

/**
 * Lịch sử giao dịch của chính user. Badge trạng thái dùng lại `paymentStatusMeta` của trang
 * doanh thu (admin) — một bảng màu/nhãn duy nhất cho cùng một enum backend.
 *
 * <p>Mốc thời gian hiển thị là {@code paidAt} nếu đã thu tiền, ngược lại {@code orderedAt}:
 * đơn chưa trả tiền không có {@code paidAt}, hiện "—" thì bảng vô dụng.</p>
 */
export default function PaymentHistory({
  items,
  loading,
  hasMore,
  onLoadMore,
}: {
  items: Payment[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  const { t, lang } = useApp();
  const { isMobile } = useBreakpoint();

  return (
    <Card>
      <h2 style={{ margin: '0 0 14px', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 18, color: '#1b1730' }}>
        {t.blHistory}
      </h2>

      {items.length === 0 && !loading ? (
        <p style={{ margin: 0, fontSize: 14, color: '#8a85a0' }}>{t.blHistoryEmpty}</p>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: isMobile ? 560 : undefined, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[t.blColDate, t.blColPlan, t.blColInvoice, t.blColAmount, t.blColStatus].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 12px', textAlign: i >= 3 ? 'right' : 'left',
                      fontSize: 12.5, fontWeight: 700, color: '#8a85a0',
                      borderBottom: '1px solid #f0ecf8', whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const meta = paymentStatusMeta(lang, p.status);
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f6f3fb' }}>
                    <td style={{ padding: '11px 12px', fontSize: 13.5, color: '#4b4660', whiteSpace: 'nowrap' }}>
                      {formatDateTimeVN(p.paidAt ?? p.orderedAt)}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 13.5, fontWeight: 600, color: '#1b1730' }}>
                      {lang === 'en' ? p.planNameEn : p.planNameVi}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 13, color: '#8a85a0', whiteSpace: 'nowrap' }}>
                      {p.invoiceNo ?? '—'}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 13.5, fontWeight: 700, color: '#1b1730', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatVND(p.amount)}
                    </td>
                    <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                      <StatusBadge tone={meta.tone} label={meta.label} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <button
          className="btn-outline"
          disabled={loading}
          onClick={onLoadMore}
          style={{
            marginTop: 14, borderRadius: 11, padding: '9px 16px', fontSize: 13.5, fontWeight: 700,
            color: '#6b6680', background: '#fff', border: '1px solid #eae6f4',
            cursor: loading ? 'progress' : 'pointer',
          }}
        >
          {loading ? t.blLoading : t.blLoadMore}
        </button>
      )}
    </Card>
  );
}
