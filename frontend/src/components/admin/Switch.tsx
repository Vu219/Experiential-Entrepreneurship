import type { CSSProperties } from 'react';

/**
 * Toggle bật/tắt dùng chung cho các trang Quản trị (thay checkbox mặc định).
 * Chỉ là điều khiển UI thuần — caller tự quyết định gọi API/mở dialog xác nhận.
 */
export default function Switch({
  checked,
  onChange,
  disabled = false,
  title,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  const track: CSSProperties = {
    width: 38, height: 22, borderRadius: 999, padding: 2, border: 'none', flex: 'none',
    background: checked ? '#7c3aed' : '#d9d3ea',
    display: 'inline-flex', alignItems: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
    transition: 'background .15s',
  };
  const knob: CSSProperties = {
    width: 18, height: 18, borderRadius: '50%', background: '#fff',
    transform: checked ? 'translateX(16px)' : 'translateX(0)', transition: 'transform .15s',
    boxShadow: '0 1px 2px rgba(0,0,0,.25)',
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={track}
    >
      <span style={knob} />
    </button>
  );
}
