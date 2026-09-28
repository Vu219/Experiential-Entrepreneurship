import { useState } from 'react';
import { CircleAlert, FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Modal from '../Modal';
import StatusBadge from './StatusBadge';
import { formatVND } from '../../api/admin';
import { paymentStatusMeta } from '../../api/revenue';
import { formatDateTimeVN } from '../../utils/format';
import type { AdminPayment } from '../../api/adminPayments';

/**
 * Chi tiết một đơn + hai thao tác tay (huỷ · đánh dấu đã trả tiền) — hiển thị dạng POPUP
 * căn giữa (dùng chung {@code Modal} như chi tiết nhật ký hoạt động), không đẩy xuống cuối trang.
 *
 * <p><b>Lý do là bắt buộc</b>: nút xác nhận bị khoá tới khi ô lý do có nội dung. Backend cũng
 * chặn bằng {@code @NotBlank} — khoá ở UI chỉ để người dùng biết ngay, không phải lớp bảo vệ
 * duy nhất.</p>
 *
 * <p>{@code rawPayload} hiển thị nguyên văn trong khối cuộn: khi có tranh chấp thật, đây là
 * bằng chứng duy nhất về việc cổng đã gửi gì. Nó chỉ tồn tại ở endpoint chi tiết của admin.</p>
 */
export default function PaymentDetailModal({
  payment,
  busy,
  onClose,
  onCancel,
  onMarkPaid,
}: {
  payment: AdminPayment;
  busy: boolean;
  onClose: () => void;
  onCancel: (reason: string) => void;
  onMarkPaid: (reason: string) => void;
}) {
  const { t, lang } = useApp();
  const [reason, setReason] = useState('');
  const meta = paymentStatusMeta(lang, payment.status);
  const canAct = reason.trim().length > 0 && !busy;

  const canCancel = payment.status === 'PENDING';
  const canMarkPaid = !['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(payment.status);

  return (
    <Modal title={payment.invoiceNo ?? t.aoOrder} maxWidth={640} onClose={onClose}>
      {payment.reconcileRequired && (
        <div
          style={{
            display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 14,
            padding: '11px 13px', borderRadius: 12, background: '#fdf0dc', border: '1px solid #f6dfae',
          }}
        >
          <CircleAlert size={16} strokeWidth={1.9} color="#b45309" style={{ flex: 'none', marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: '#7c4a08' }}>{t.aoReconcileHint}</p>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <StatusBadge tone={meta.tone} label={meta.label} />
        <span style={{ fontSize: 17, fontWeight: 800, color: '#1b1730' }}>{formatVND(payment.amount)}</span>
      </div>

      <Row label={t.aoBuyer} value={payment.userEmail ? `${payment.userFullName ?? '—'} · ${payment.userEmail}` : t.payDeletedAccount} />
      <Row label={t.blColPlan} value={lang === 'en' ? payment.planNameEn : payment.planNameVi} />
      <Row label={t.aoGateway} value={payment.gateway} />
      <Row label={t.aoOrderCode} value={payment.gatewayTxnId ?? '—'} mono />
      <Row label={t.aoLinkId} value={payment.gatewayLinkId ?? '—'} mono />
      <Row label={t.aoOrderedAt} value={formatDateTimeVN(payment.orderedAt)} />
      <Row label={t.aoPaidAt} value={payment.paidAt ? formatDateTimeVN(payment.paidAt) : '—'} />
      <Row label={t.aoExpiresAt} value={payment.expiresAt ? formatDateTimeVN(payment.expiresAt) : '—'} />
      <Row
        label={t.aoServicePeriod}
        value={
          payment.periodStart
            ? `${formatDateTimeVN(payment.periodStart)} → ${formatDateTimeVN(payment.periodEnd)}`
            : '—'
        }
      />
      {payment.failedReason && <Row label={t.aoFailedReason} value={payment.failedReason} />}
      {payment.note && <Row label={t.aoNote} value={payment.note} />}
      {(payment.expiryGraceCount ?? 0) > 0 && (
        <Row label={t.aoGraceCount} value={String(payment.expiryGraceCount)} />
      )}

      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
          <FileText size={15} strokeWidth={1.9} color="#a39bbf" />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#6b6680' }}>{t.aoRawPayload}</span>
        </div>
        <pre
          style={{
            margin: 0, maxHeight: 220, overflow: 'auto', padding: '11px 12px', borderRadius: 10,
            background: '#f7f6fd', border: '1px solid #ece8f6', fontSize: 11.5, lineHeight: 1.6,
            color: '#4b4660', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}
        >
          {payment.rawPayload ?? t.aoNoPayload}
        </pre>
      </div>

      {(canCancel || canMarkPaid) && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20,
            paddingTop: 16, borderTop: '1px solid #f0edf7',
          }}
        >
          <label style={{ fontSize: 12.5, fontWeight: 700, color: '#6b6680' }}>
            {t.aoReasonLabel}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={t.aoReasonPh}
              style={{
                width: '100%', marginTop: 6, borderRadius: 10, padding: '9px 11px',
                border: '1px solid #ece8f6', background: '#faf9fd', fontSize: 13,
                fontFamily: 'inherit', color: '#241f3a', resize: 'vertical', outline: 'none',
              }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {canMarkPaid && (
              <button
                disabled={!canAct}
                onClick={() => onMarkPaid(reason.trim())}
                style={actionStyle(canAct, '#16a34a')}
              >
                {busy ? t.aoWorking : t.aoMarkPaid}
              </button>
            )}
            {canCancel && (
              <button
                disabled={!canAct}
                onClick={() => onCancel(reason.trim())}
                style={actionStyle(canAct, '#d6336c')}
              >
                {busy ? t.aoWorking : t.aoCancelOrder}
              </button>
            )}
          </div>
          {!canAct && !busy && (
            <p style={{ margin: 0, fontSize: 12, color: '#a39bbf' }}>{t.aoReasonRequired}</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function actionStyle(enabled: boolean, color: string) {
  return {
    flex: 1, borderRadius: 11, padding: '10px 0', fontSize: 13.5, fontWeight: 700,
    border: 'none', cursor: enabled ? 'pointer' : 'not-allowed',
    color: enabled ? '#fff' : '#a39bbf',
    background: enabled ? color : '#f2f0f8',
  } as const;
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid #f6f3fb' }}>
      <span style={{ flex: '0 0 40%', fontSize: 12.5, color: '#8a85a0' }}>{label}</span>
      <span
        style={{
          flex: 1, fontSize: 13, fontWeight: 600, color: '#1b1730', wordBreak: 'break-word',
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}
