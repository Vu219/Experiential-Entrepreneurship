import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { C } from '../styles/colors';

/**
 * Dòng nhắc cạnh nút bị khoá vì giới hạn gói (đã dùng hết lượt / gói không gồm): lý do + link "Nâng cấp gói".
 * Chỉ là chặn TRƯỚC cho đỡ thao tác thừa — backend vẫn trả 2205/2206 nếu gọi thẳng API.
 */
export default function PlanLimitInline({ message }: { message: string }) {
  const { t } = useApp();
  const navigate = useNavigate();
  return (
    <span role="note" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12.5, color: C.textMuted,
      lineHeight: 1.45, minWidth: 0,
    }}>
      <Lock size={13} strokeWidth={2.2} aria-hidden style={{ flex: 'none' }} />
      <span style={{ minWidth: 0 }}>{message}</span>
      <button type="button" onClick={() => navigate('/billing')} style={{
        border: 'none', background: 'none', padding: 0, color: C.primary, fontWeight: 700, fontSize: 12.5,
        cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2,
      }}>
        {t.plgUpgrade}
      </button>
    </span>
  );
}
