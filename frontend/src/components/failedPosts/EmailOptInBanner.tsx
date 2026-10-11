import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useToast } from '../toast/ToastProvider.tsx';
import { TONE_COLORS } from '../../statusTokens.ts';
import { alpha, C } from '../../styles/colors';
import type { ApiError } from '../../api/apiClient.ts';
import { updateEmailPublishErrors, type NotificationPreferences } from '../../api/notificationPreferences.ts';

// Hỏi MỘT lần (failed-posts đợt 2 — C): chỉ hiện khi máy chủ gửi được email, người dùng chưa trả lời và đang có bài
// cần xử lý. Trả lời (bật / không) đều được lưu → không hỏi lại; đổi ý ở Cài đặt → Thông báo.

const INFO = TONE_COLORS.info;

export default function EmailOptInBanner({ onAnswered }: { onAnswered: (prefs: NotificationPreferences) => void }) {
  const { t, brandGradient } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const answer = async (enable: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const prefs = await updateEmailPublishErrors(enable);
      toast.success(enable ? t.fpEmailPromptOn : t.fpEmailPromptOff);
      onAnswered(prefs);
    } catch (e) {
      toast.error((e as ApiError).message);
      setBusy(false);
    }
  };

  return (
    <div
      role="region"
      aria-label={t.fpEmailPromptTitle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: INFO.bg,
        border: `1px solid ${alpha(INFO.color, 0.2)}`, borderRadius: 12, padding: '11px 14px',
      }}
    >
      <Mail size={18} color={INFO.color} strokeWidth={2} aria-hidden style={{ flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: C.ink750, lineHeight: 1.5 }}>
        <strong>{t.fpEmailPromptTitle}</strong>
        <div style={{ color: C.textSecondary, fontSize: 12.5, marginTop: 2 }}>{t.fpEmailPromptBody}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => answer(false)}
          disabled={busy}
          className="btn-soft"
          style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, color: C.ink600, cursor: busy ? 'wait' : 'pointer' }}
        >
          {t.fpEmailPromptNo}
        </button>
        <button
          type="button"
          onClick={() => answer(true)}
          disabled={busy}
          className="btn-grad"
          style={{ border: 'none', background: brandGradient, borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, color: C.onBrand, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}
        >
          {t.fpEmailPromptYes}
        </button>
      </div>
    </div>
  );
}
