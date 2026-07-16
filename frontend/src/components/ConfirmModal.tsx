import type { ReactNode } from 'react';
import Modal from './Modal';
import { useApp } from '../context/AppContext';

/**
 * Dialog xác nhận hành động nhạy cảm (xóa hồ sơ / xóa chiến lược / khoá-xoá user...).
 * Tái dùng Modal. `variant` đổi màu nút xác nhận; `children` chèn nội dung phụ
 * (vd danh sách user bị ảnh hưởng) giữa message và hàng nút.
 * (Chuyển từ components/brand/ConfirmDialog thành component dùng chung toàn app —
 * file cũ re-export để import sẵn có không phải sửa.)
 */
export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
  variant = 'danger',
  children,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  variant?: 'danger' | 'warning';
  children?: ReactNode;
}) {
  const { t } = useApp();
  const confirmBg = variant === 'warning' ? '#d97706' : '#d6336c';
  return (
    <Modal title={title} subtitle={message} onClose={onClose}>
      {children}
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
          style={{ flex: 1, border: 'none', background: confirmBg, borderRadius: 11, padding: '11px 0', fontSize: 14, fontWeight: 700, color: '#fff', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
