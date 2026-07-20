import { useApp } from '../../../context/AppContext';
import Modal from '../../Modal';
import StatusBadge from '../StatusBadge';
import { DetailRow } from '../AdminListPage';
import { actionLabel } from './activityLabels';
import type { ActivityLog } from '../../../api/admin';

const pre: React.CSSProperties = {
  margin: 0, background: '#1f1b2e', color: '#c9c2e8', borderRadius: 10, padding: '12px 14px',
  fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  maxHeight: 320, overflow: 'auto', fontFamily: 'ui-monospace,Menlo,Consolas,monospace',
};

/**
 * Metadata được backend cắt ở 4KB nên chuỗi có thể KHÔNG còn là JSON hợp lệ. Parse hỏng thì
 * hiện nguyên văn thay vì báo lỗi — nội dung đã cắt vẫn đọc được và vẫn có ích.
 */
function formatMetadata(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default function ActivityLogDetailModal({ log, onClose }: { log: ActivityLog; onClose: () => void }) {
  const { t, lang } = useApp();
  const metadata = formatMetadata(log.metadata);

  return (
    <Modal title={t.alDetailTitle} maxWidth={620} onClose={onClose}>
      <DetailRow label={t.colTime} value={log.createdAt.slice(0, 19).replace('T', ' ')} />
      <DetailRow label={t.alColUser} value={log.userFullName || log.userEmail || t.alSystemActor} />
      {log.userEmail && log.userFullName && <DetailRow label={t.colEmail} value={log.userEmail} />}
      <DetailRow label={t.alColAction} value={actionLabel(lang, log.action)} />
      <DetailRow
        label={t.alColResult}
        value={<StatusBadge tone={log.result === 'SUCCESS' ? 'success' : 'danger'}
          label={log.result === 'SUCCESS' ? t.alResultSuccess : t.alResultFailure} />}
      />
      <DetailRow label={t.alColTarget} value={log.targetType ? `${log.targetType}${log.targetId ? ` · ${log.targetId}` : ''}` : '—'} />
      <DetailRow label={t.aueIp} value={log.ip || t.aueUnknown} />
      <DetailRow label={t.alRequestId} value={log.id} />

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#a59fbb', marginBottom: 6 }}>{t.aueUa}</div>
        <pre style={pre}>{log.userAgent || t.aueUnknown}</pre>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#a59fbb', marginBottom: 6 }}>{t.alMetadata}</div>
        {metadata ? <pre style={pre}>{metadata}</pre> : <div style={{ fontSize: 12.5, color: '#a59fbb' }}>{t.logNoDetail}</div>}
      </div>
    </Modal>
  );
}
