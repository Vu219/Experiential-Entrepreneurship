import { EyeOff, RotateCcw, X } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { C } from '../../styles/colors';

// Thanh thao tác hàng loạt — chỉ hiện khi có bài được chọn. Mỗi bài xử lý độc lập ở backend (POST /bulk):
// bài không thử lại được (vd tài khoản chưa kết nối lại) không làm hỏng các bài khác.

export default function BulkBar({
  count,
  busy,
  canDismiss,
  onRetry,
  onDismiss,
  onClear,
}: {
  count: number;
  busy: boolean;
  /** Tab "Đã bỏ qua" không có "Bỏ qua" nữa. */
  canDismiss: boolean;
  onRetry: () => void;
  onDismiss: () => void;
  onClear: () => void;
}) {
  const { t, brandGradient } = useApp();
  if (count === 0) return null;
  const btn = {
    display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 9, padding: '7px 12px',
    fontSize: 12.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
  } as const;
  return (
    <div
      role="toolbar"
      aria-label={t.fpSelected.replace('{n}', String(count))}
      style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: C.purpleSoft, borderRadius: 12, padding: '9px 12px' }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: C.primary, flex: 1 }}>{t.fpSelected.replace('{n}', String(count))}</span>
      <button onClick={onRetry} disabled={busy} className="btn-grad" style={{ ...btn, border: 'none', background: brandGradient, color: C.onBrand }}>
        <RotateCcw size={13} strokeWidth={2.2} />
        {t.fpBulkRetry}
      </button>
      {canDismiss && (
        <button onClick={onDismiss} disabled={busy} className="btn-soft" style={{ ...btn, border: `1px solid ${C.border}`, background: C.surface, color: C.ink600 }}>
          <EyeOff size={13} strokeWidth={2} />
          {t.fpBulkDismiss}
        </button>
      )}
      <button onClick={onClear} disabled={busy} aria-label={t.fpBulkClear} title={t.fpBulkClear}
        style={{ ...btn, border: 'none', background: 'transparent', color: C.textMuted, padding: '7px 8px' }}>
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  );
}
