import type { CSSProperties } from 'react';
import { useApp } from '../context/AppContext';
import { strengthLevel } from '../utils/password';

const LABEL_KEY = { weak: 'pwWeak', fair: 'pwFair', strong: 'pwStrong' } as const;

// Thanh đo độ mạnh mật khẩu — realtime, dùng chung cho mọi form đặt/đổi mật khẩu.
export default function PasswordStrengthBar({ password, style }: { password: string; style?: CSSProperties }) {
  const { t } = useApp();
  const { level, color, pct } = strengthLevel(password);
  return (
    <div style={{ margin: '9px 0 2px', ...style }}>
      <div style={{ height: 6, borderRadius: 4, background: '#eceaf4', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: password ? `${pct}%` : 0, background: color, transition: 'width .25s, background .25s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 5 }}>
        <span style={{ fontSize: 11.5, color: '#8a85a0' }}>{t.pwHint}</span>
        {password && <span style={{ fontSize: 11.5, fontWeight: 700, color }}>{t[LABEL_KEY[level]]}</span>}
      </div>
    </div>
  );
}
