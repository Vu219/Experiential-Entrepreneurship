import type { CSSProperties } from 'react';

/**
 * Dropdown lọc dùng chung cho các sub-tab trang Xu hướng.
 * `options` = danh sách value hiển thị; option đầu thường là "Tất cả ...".
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  fullWidth = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  /** Mobile: chiếm full hàng, label trái — select giãn hết phần còn lại. */
  fullWidth?: boolean;
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #ece8f6', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', ...(fullWidth ? { width: '100%' } : {}) }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#8a85a0', whiteSpace: 'nowrap' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: '#2b2543', cursor: 'pointer', ...(fullWidth ? { flex: 1, minWidth: 0 } : { maxWidth: 170 }) }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** Badge pill nhỏ (độ phù hợp / trạng thái ý tưởng / trạng thái phiên). */
export function Pill({ text, color, bg, style }: { text: string; color: string; bg: string; style?: CSSProperties }) {
  return (
    <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color, background: bg, borderRadius: 999, padding: '4px 11px', whiteSpace: 'nowrap', ...style }}>
      {text}
    </span>
  );
}
