import { Fragment, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../toast/ToastProvider';
import { DataTable } from '../AdminListPage';
import Avatar from '../Avatar';
import StatusBadge from '../StatusBadge';
import RowActionsMenu from '../RowActionsMenu';
import { formatVND } from '../../../api/admin';
import { formatDateTimeVN, formatDateVN } from '../../../utils/format';
import { paymentStatusMeta, type RevenueTransaction } from '../../../api/revenue';
import { C } from '../../../styles/colors';

const td: CSSProperties = { padding: '12px 16px', fontSize: 13.5, color: C.ink750 };
const tdMuted: CSSProperties = { ...td, color: C.textMuted, fontSize: 13 };

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(-2).join('').toUpperCase();

export type TxnSortField = 'date' | 'amount';
export interface TxnSort { field: TxnSortField; asc: boolean; }

/**
 * Bảng "Giao dịch gần đây". Sắp xếp và phân trang đều SERVER-SIDE — bảng chỉ phát tín hiệu
 * lên trang, không tự sắp mảng đang có (nếu sắp tại chỗ thì chỉ đúng trong phạm vi 1 trang).
 */
export default function TransactionsTable({
  rows,
  sort,
  onSortChange,
}: {
  rows: RevenueTransaction[];
  sort: TxnSort;
  onSortChange: (next: TxnSort) => void;
}) {
  const { t, lang, brandGradient } = useApp();
  const toast = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleSort = (field: TxnSortField) =>
    onSortChange({ field, asc: sort.field === field ? !sort.asc : false });

  const sortableHead = (field: TxnSortField, label: string) => (
    <button
      onClick={() => toggleSort(field)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none',
        padding: 0, cursor: 'pointer', font: 'inherit', color: sort.field === field ? C.primary : 'inherit',
      }}
    >
      {label}
      {sort.field === field && (sort.asc ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
    </button>
  );

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t.revCopied);
    } catch {
      toast.error(t.revCopyFailed);
    }
  };

  return (
    <DataTable
      head={[
        t.colTxn, t.colCustomer, t.colPlan,
        sortableHead('amount', t.colAmount),
        t.colStatus,
        sortableHead('date', t.colDate),
        '',
      ]}
      minWidth={860}
    >
      {rows.map((r) => {
        const open = expanded === r.id;
        return (
          <Fragment key={r.id}>
            <tr style={{ borderTop: `1px solid ${C.surfaceMuted}`, background: open ? C.bg : undefined }}>
              <td style={{ ...td, fontWeight: 700, color: C.legacyText6b5ca8, fontSize: 12.5 }}>{r.code}</td>
              <td style={td}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar url={r.userAvatarUrl} initials={initialsOf(r.userName ?? '?')} gradient={brandGradient} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: r.userName ? undefined : C.textMuted }}>{r.userName ?? t.payDeletedAccount}</div>
                    {r.userEmail && <div style={{ fontSize: 12, color: C.textFaint }}>{r.userEmail}</div>}
                  </div>
                </div>
              </td>
              <td style={tdMuted}>{lang === 'en' ? r.planNameEn : r.planNameVi}</td>
              <td style={{ ...td, fontWeight: 600 }}>
                {formatVND(r.amount)}
                {r.refundedAmount > 0 && (
                  <div style={{ fontSize: 11.5, color: C.danger }}>
                    − {formatVND(r.refundedAmount)}
                  </div>
                )}
              </td>
              <td style={td}><StatusBadge {...paymentStatusMeta(lang, r.status)} /></td>
              <td style={tdMuted}>{formatDateVN(r.date)}</td>
              <td style={{ ...td, textAlign: 'right' }}>
                <RowActionsMenu
                  ariaLabel={t.revRowActions}
                  actions={[
                    {
                      key: 'detail',
                      label: open ? t.revHideDetail : t.revViewDetail,
                      icon: <Eye size={16} />,
                      onClick: () => setExpanded(open ? null : r.id),
                    },
                    {
                      key: 'copy',
                      label: t.revCopyCode,
                      icon: <Copy size={16} />,
                      onClick: () => copyCode(r.code),
                    },
                  ]}
                />
              </td>
            </tr>

            {open && (
              <tr style={{ background: C.bg }}>
                <td colSpan={7} style={{ padding: '4px 16px 16px' }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12,
                    background: C.surface, border: `1px solid ${C.surfaceMuted}`, borderRadius: 12, padding: '14px 16px',
                  }}>
                    <DetailField label={t.revDetailOrderedAt} value={formatDateTimeVN(r.orderedAt)} />
                    <DetailField label={t.revDetailPaidAt} value={r.paidAt ? formatDateTimeVN(r.paidAt) : '—'} />
                    <DetailField label={t.revDetailRefundedAt} value={r.refundedAt ? formatDateTimeVN(r.refundedAt) : '—'} />
                    <DetailField label={t.revDetailGateway} value={r.gateway} />
                    <DetailField label={t.revDetailGatewayTxn} value={r.gatewayTxnId ?? '—'} />
                    <DetailField label={t.revDetailCurrency} value={r.currency} />
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </DataTable>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: C.textFaint, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink750, wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}
