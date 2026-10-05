import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, Clock, ShieldAlert } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import AdminListPage, { DataTable, SearchInput, type ListState } from '../AdminListPage';
import Pagination from '../Pagination';
import StatusBadge from '../StatusBadge';
import FilterMenu from '../FilterMenu';
import PaymentDetailModal from '../PaymentDetailModal';
import { useToast } from '../../toast/ToastProvider';
import { formatVND } from '../../../api/admin';
import { paymentStatusMeta, type PaymentStatus } from '../../../api/revenue';
import { formatDateTimeVN } from '../../../utils/format';
import {
  cancelAdminPayment,
  getAdminPayment,
  listAdminPayments,
  markAdminPaymentPaid,
  type AdminPayment,
  type AdminPaymentSummary,
} from '../../../api/adminPayments';
import type { ApiError } from '../../../api/apiClient';
import { C } from '../../../styles/colors';

const STATUSES: PaymentStatus[] = [
  'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED',
];

/**
 * Tab "Đơn hàng" của trang "Doanh thu & Đơn hàng" (trước là trang riêng /admin/payments — cùng
 * nguồn sổ cái `payments`: một dòng = một đơn = một lần thanh toán, nên gộp chung một trang).
 * Danh sách VÀ ba thẻ số đều lọc theo KỲ của bộ lọc thời gian dùng chung (theo ngày đặt đơn;
 * webhook theo thời điểm bị từ chối) — số trên thẻ khớp đúng danh sách khi bấm lọc.
 *
 * <p>Ba thẻ số ở đầu trang là <b>hàng đợi công việc</b>, không phải số liệu trang trí: đơn cần
 * đối soát tay, đơn đang chờ trả tiền, và webhook bị từ chối trong kỳ. Bấm vào thẻ đầu là lọc
 * ngay ra danh sách việc cần làm — bắt admin tự nhớ đi lọc mỗi ngày thì sớm muộn cũng có ngày
 * không ai lọc.</p>
 */
export default function OrdersTab({
  from,
  to,
  status,
  onStatusChange,
  summary,
  onSummaryStale,
}: {
  /** Kỳ đang xem, YYYY-MM-DD, `to` bao gồm cả ngày đó. */
  from: string;
  to: string;
  /** Trạng thái nằm trên URL (trang dùng chung cho export). */
  status: PaymentStatus | '';
  onStatusChange: (status: PaymentStatus | '') => void;
  /** 3 badge hàng đợi — trang giữ để hiện số trên nhãn tab. */
  summary: AdminPaymentSummary | null;
  /** Gọi sau thao tác ghi để trang nạp lại badge. */
  onSummaryStale: () => void;
}) {
  const { t, lang } = useApp();
  const { isDesktop } = useBreakpoint();
  const toast = useToast();

  const [rows, setRows] = useState<AdminPayment[]>([]);
  const [state, setState] = useState<ListState>('loading');
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [size, setSize] = useState(20);

  const [onlyReconcile, setOnlyReconcile] = useState(false);
  const [q, setQ] = useState('');

  const [selected, setSelected] = useState<AdminPayment | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await listAdminPayments(
        {
          status: status || undefined,
          reconcileRequired: onlyReconcile ? true : undefined,
          q: q.trim() || undefined,
          from,
          to,
        },
        page,
        size
      );
      setRows(res.content);
      setPageCount(Math.max(1, res.totalPages));
      setState(res.content.length === 0 ? 'empty' : 'ready');
    } catch {
      setState('error');
    }
  }, [status, onlyReconcile, q, page, size, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  // Đổi kỳ ở thanh lọc chung → kết quả khác hẳn, quay về trang đầu.
  useEffect(() => {
    setPage(0);
  }, [from, to]);

  const openDetail = async (row: AdminPayment) => {
    try {
      // Nạp lại từ endpoint chi tiết: rawPayload CHỈ có ở đó, danh sách luôn trả null.
      setSelected(await getAdminPayment(row.id));
    } catch (e) {
      toast.error((e as ApiError).message);
    }
  };

  const runAction = async (action: (id: string, reason: string) => Promise<AdminPayment>, reason: string) => {
    if (!selected) return;
    setActing(true);
    try {
      const updated = await action(selected.id, reason);
      setSelected(await getAdminPayment(updated.id));
      await load();
      onSummaryStale();
      toast.success(t.aoDone);
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setActing(false);
    }
  };

  const resetPage = (fn: () => void) => {
    setPage(0);
    fn();
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : '1fr', gap: 14 }}>
        <QueueCard
          icon={<CircleAlert size={18} strokeWidth={1.9} />}
          tone={{ color: C.warning, bg: C.warningSoft }}
          label={t.aoQueueReconcile}
          hint={t.aoQueueReconcileHint}
          value={summary?.reconcileRequired ?? 0}
          active={onlyReconcile}
          onClick={() => resetPage(() => setOnlyReconcile((v) => !v))}
        />
        <QueueCard
          icon={<Clock size={18} strokeWidth={1.9} />}
          tone={{ color: C.info, bg: C.infoSoft }}
          label={t.aoQueuePending}
          hint={t.aoQueuePendingHint}
          value={summary?.pending ?? 0}
          active={status === 'PENDING'}
          onClick={() => resetPage(() => onStatusChange(status === 'PENDING' ? '' : 'PENDING'))}
        />
        <QueueCard
          icon={<ShieldAlert size={18} strokeWidth={1.9} />}
          tone={
            (summary?.webhookRejected24h ?? 0) > 0
              ? { color: C.danger, bg: C.dangerSoft }
              : { color: C.success, bg: C.successSoft }
          }
          label={`${t.aoQueueWebhook} · ${ddmm(from)} – ${ddmm(to)}`}
          hint={t.aoQueueWebhookHint}
          value={summary?.webhookRejected24h ?? 0}
        />
      </div>

      <AdminListPage
        state={state}
        onRetry={load}
        emptyLabel={t.listEmpty}
        toolbar={
          <>
            <SearchInput value={q} onChange={(v) => resetPage(() => setQ(v))} placeholder={t.aoSearchPh} />
            <FilterMenu
              label={t.revStatusFilter}
              allLabel={t.aoAllStatuses}
              clearLabel={t.revStatusClear}
              value={status}
              options={STATUSES.map((s) => [s, paymentStatusMeta(lang, s).label])}
              onChange={(v) => resetPage(() => onStatusChange(v as PaymentStatus | ''))}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: C.textSecondary }}>
              <input
                type="checkbox"
                checked={onlyReconcile}
                onChange={() => resetPage(() => setOnlyReconcile((v) => !v))}
              />
              {t.aoOnlyReconcile}
            </label>
          </>
        }
      >
        <DataTable
          head={[t.blColDate, t.aoBuyer, t.blColPlan, t.blColAmount, t.blColStatus, '']}
          minWidth={860}
        >
          {rows.map((row) => {
            const meta = paymentStatusMeta(lang, row.status);
            return (
              <tr
                key={row.id}
                onClick={() => void openDetail(row)}
                style={{
                  borderTop: `1px solid ${C.surfaceMuted}`, cursor: 'pointer',
                  background: selected?.id === row.id ? C.bg : undefined,
                }}
              >
                <td style={cellStyle}>{formatDateTimeVN(row.paidAt ?? row.orderedAt)}</td>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 600, color: C.textStrong }}>{row.userEmail ? (row.userFullName ?? '—') : t.payDeletedAccount}</div>
                  {row.userEmail && <div style={{ fontSize: 12, color: C.textMuted }}>{row.userEmail}</div>}
                </td>
                <td style={cellStyle}>{lang === 'en' ? row.planNameEn : row.planNameVi}</td>
                <td style={{ ...cellStyle, fontWeight: 700 }}>{formatVND(row.amount)}</td>
                <td style={cellStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <StatusBadge tone={meta.tone} label={meta.label} />
                    {row.reconcileRequired && (
                      <CircleAlert size={15} strokeWidth={2} color={C.warning} aria-label={t.aoQueueReconcile} />
                    )}
                  </div>
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', color: C.primary, fontWeight: 700 }}>
                  {t.detail}
                </td>
              </tr>
            );
          })}
        </DataTable>

        <div style={{ padding: '12px 16px' }}>
          <Pagination
            page={page}
            pageCount={pageCount}
            onChange={setPage}
            pageSize={size}
            onPageSizeChange={(s) => resetPage(() => setSize(s))}
          />
        </div>
      </AdminListPage>

      {selected && (
        <PaymentDetailModal
          payment={selected}
          busy={acting}
          onClose={() => setSelected(null)}
          onCancel={(reason) => void runAction(cancelAdminPayment, reason)}
          onMarkPaid={(reason) => void runAction(markAdminPaymentPaid, reason)}
        />
      )}
    </>
  );
}

const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

const cellStyle = { padding: '12px 16px', fontSize: 13.5, color: C.ink650 } as const;

function QueueCard({
  icon,
  tone,
  label,
  hint,
  value,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  tone: { color: string; bg: string };
  label: string;
  hint: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={clickable ? 'lift-card' : undefined}
      style={{
        display: 'flex', gap: 12, alignItems: 'flex-start', padding: 16, borderRadius: 16,
        background: C.surface, border: active ? `1px solid ${tone.color}` : `1px solid ${C.border}`,
        boxShadow: `0 22px 44px -34px ${C.legacyShadowrgba8040140_5_}`,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 38, height: 38, borderRadius: 12, background: tone.bg, color: tone.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: C.textSecondary }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, color: value > 0 ? tone.color : C.textStrong }}>
          {value}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11.5, lineHeight: 1.5, color: C.ink350 }}>{hint}</p>
      </div>
    </div>
  );
}
