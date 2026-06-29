import Modal from '../Modal';
import { useApp } from '../../context/AppContext';

/** Dialog xác nhận hành động phá huỷ (xóa hồ sơ / xóa chiến lược). Tái dùng Modal. */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const { t } = useApp();
  return (
    <Modal title={title} subtitle={message} onClose={onClose}>
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <button
          onClick={onClose}
          className="btn-soft"
          style={{ flex: 1, border: '1px solid #ece8f6', background: '#fff', borderRadius: 11, padding: '11px 0', fontSize: 14, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}
        >
          {t.cancel}
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          style={{ flex: 1, border: 'none', background: '#d6336c', borderRadius: 11, padding: '11px 0', fontSize: 14, fontWeight: 700, color: '#fff', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
