import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, Clock, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import PageContainer from '../../components/PageContainer';
import AdminListPage, { DataTable, SearchInput, type ListState } from '../../components/admin/AdminListPage';
import Pagination from '../../components/admin/Pagination';
import StatusBadge from '../../components/admin/StatusBadge';
import PaymentDetailModal from '../../components/admin/PaymentDetailModal';
import { useToast } from '../../components/toast/ToastProvider';
import { formatVND } from '../../api/admin';
import { paymentStatusMeta, type PaymentStatus } from '../../api/revenue';
import { formatDateTimeVN } from '../../utils/format';
import {
  cancelAdminPayment,
  getAdminPayment,
  getPaymentSummary,
  listAdminPayments,
  markAdminPaymentPaid,
  type AdminPayment,
  type AdminPaymentSummary,
} from '../../api/adminPayments';
import type { ApiError } from '../../api/apiClient';

const STATUSES: PaymentStatus[] = [
  'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED',
];

/**
 * Trang "Đơn hàng & thanh toán" của khu Quản trị.
 *
 * <p>Ba thẻ số ở đầu trang là <b>hàng đợi công việc</b>, không phải số liệu trang trí: đơn cần
 * đối soát tay, đơn đang chờ trả tiền, và webhook bị từ chối trong 24h. Bấm vào thẻ đầu là lọc
 * ngay ra danh sách việc cần làm — bắt admin tự nhớ đi lọc mỗi ngày thì sớm muộn cũng có ngày
 * không ai lọc.</p>
 */
export default function AdminPayments() {
  const { t, lang } = useApp();
  const { isDesktop } = useBreakpoint();
  const toast = useToast();

  const [summary, setSummary] = useState<AdminPaymentSummary | null>(null);
  const [rows, setRows] = useState<AdminPayment[]>([]);
  const [state, setState] = useState<ListState>('loading');
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [size, setSize] = useState(20);

  const [status, setStatus] = useState<PaymentStatus | ''>('');
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
  }, [status, onlyReconcile, q, page, size]);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await getPaymentSummary());
    } catch {
      // Thẻ số hỏng không được chặn bảng — bảng mới là thứ admin cần nhất.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

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
      await Promise.all([load(), loadSummary()]);
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
    <PageContainer>
      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : '1fr', gap: 14 }}>
        <QueueCard
          icon={<CircleAlert size={18} strokeWidth={1.9} />}
          tone={{ color: '#d97706', bg: '#fdf0dc' }}
          label={t.aoQueueReconcile}
          hint={t.aoQueueReconcileHint}
          value={summary?.reconcileRequired ?? 0}
          active={onlyReconcile}
          onClick={() => resetPage(() => setOnlyReconcile((v) => !v))}
        />
        <QueueCard
          icon={<Clock size={18} strokeWidth={1.9} />}
          tone={{ color: '#0e7490', bg: '#e0f7fb' }}
          label={t.aoQueuePending}
          hint={t.aoQueuePendingHint}
          value={summary?.pending ?? 0}
          active={status === 'PENDING'}
          onClick={() => resetPage(() => setStatus((v) => (v === 'PENDING' ? '' : 'PENDING')))}
        />
        <QueueCard
          icon={<ShieldAlert size={18} strokeWidth={1.9} />}
          tone={
            (summary?.webhookRejected24h ?? 0) > 0
              ? { color: '#dc2626', bg: '#fde8e8' }
              : { color: '#16a34a', bg: '#e8f8ee' }
          }
          label={t.aoQueueWebhook}
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
            <select
              value={status}
              onChange={(e) => resetPage(() => setStatus(e.target.value as PaymentStatus | ''))}
              style={selectStyle}
            >
              <option value="">{t.aoAllStatuses}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {paymentStatusMeta(lang, s).label}
                </option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#6b6680' }}>
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
                  borderTop: '1px solid #f4f1fb', cursor: 'pointer',
                  background: selected?.id === row.id ? '#faf8ff' : undefined,
                }}
              >
                <td style={cellStyle}>{formatDateTimeVN(row.paidAt ?? row.orderedAt)}</td>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 600, color: '#1b1730' }}>{row.userFullName ?? '—'}</div>
                  <div style={{ fontSize: 12, color: '#8a85a0' }}>{row.userEmail}</div>
                </td>
                <td style={cellStyle}>{lang === 'en' ? row.planNameEn : row.planNameVi}</td>
                <td style={{ ...cellStyle, fontWeight: 700 }}>{formatVND(row.amount)}</td>
                <td style={cellStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <StatusBadge tone={meta.tone} label={meta.label} />
                    {row.reconcileRequired && (
                      <CircleAlert size={15} strokeWidth={2} color="#d97706" aria-label={t.aoQueueReconcile} />
                    )}
                  </div>
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', color: '#7c3aed', fontWeight: 700 }}>
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
    </PageContainer>
  );
}

const cellStyle = { padding: '12px 16px', fontSize: 13.5, color: '#4b4660' } as const;

const selectStyle = {
  borderRadius: 10, padding: '8px 12px', border: '1px solid #ece8f6', background: '#f4f2fb',
  fontSize: 13.5, color: '#241f3a', outline: 'none', cursor: 'pointer',
} as const;

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
        background: '#fff', border: active ? `1px solid ${tone.color}` : '1px solid #efeaf8',
        boxShadow: '0 22px 44px -34px rgba(80,40,140,.5)',
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
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#6b6680' }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, color: value > 0 ? tone.color : '#1b1730' }}>
          {value}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11.5, lineHeight: 1.5, color: '#a39bbf' }}>{hint}</p>
      </div>
    </div>
  );
}
