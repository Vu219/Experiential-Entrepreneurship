import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { unsubscribeEmail } from '../api/notificationPreferences';
import type { ApiError } from '../api/apiClient';
import { TONE_COLORS } from '../statusTokens';
import { C } from '../styles/colors';

// /unsubscribe?token=… — trang công khai mở từ link trong email lỗi đăng bài (failed-posts đợt 2 — C). Không cần
// đăng nhập: token có chữ ký + hạn dùng; backend tắt email lỗi đăng bài rồi trang hiện xác nhận đơn giản.
export default function UnsubscribePage() {
  const { t } = useApp();
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const [state, setState] = useState<'working' | 'done' | 'error'>(token ? 'working' : 'error');
  const [error, setError] = useState<string | null>(token ? null : t.unsubMissing);
  const sent = useRef(false); // StrictMode chạy effect 2 lần ở dev — chỉ gửi một lần

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    unsubscribeEmail(token)
      .then(() => setState('done'))
      .catch((e) => { setError((e as ApiError).message); setState('error'); });
  }, [token]);

  const tone = state === 'done' ? TONE_COLORS.success : state === 'error' ? TONE_COLORS.danger : TONE_COLORS.info;
  const Icon = state === 'done' ? CheckCircle2 : state === 'error' ? XCircle : Loader2;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: C.bg }}>
      <div style={{ width: '100%', maxWidth: 460, background: C.surface, borderRadius: 18, padding: 28, boxShadow: `0 40px 80px -30px ${C.legacyShadowrgba6030110_55_}`, textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tone.bg }}>
          <Icon size={26} color={tone.color} className={state === 'working' ? 'icon-spin' : undefined} aria-hidden />
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: C.textStrong, margin: '0 0 8px' }}>{t.unsubTitle}</h1>
        <p role="status" style={{ fontSize: 14, color: C.ink750, lineHeight: 1.6, margin: 0 }}>
          {state === 'working' ? t.unsubWorking : state === 'done' ? t.unsubDone : t.unsubError}
        </p>
        {state === 'done' && <p style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6, margin: '8px 0 0' }}>{t.unsubDoneSub}</p>}
        {state === 'error' && error && <p style={{ fontSize: 12.5, color: C.rose, lineHeight: 1.6, margin: '8px 0 0' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
          <Link to="/settings?tab=notifications" style={{ fontSize: 13, fontWeight: 700, color: C.primary, textDecoration: 'none' }}>{t.unsubOpenSettings}</Link>
          <span aria-hidden style={{ color: C.textFaint }}>·</span>
          <Link to="/" style={{ fontSize: 13, fontWeight: 700, color: C.ink600, textDecoration: 'none' }}>{t.unsubHome}</Link>
        </div>
      </div>
    </main>
  );
}
