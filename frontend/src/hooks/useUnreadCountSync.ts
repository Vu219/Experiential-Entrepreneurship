import { useEffect, useState } from 'react';
import { getUnreadCount } from '../api/notifications';
import { useRealtimeStore } from '../store/useRealtimeStore';

export const RECONNECTING_HINT_MS = 10_000;
export const FALLBACK_POLL_AFTER_MS = 30_000;
const FALLBACK_POLL_MS = 60_000;

const refresh = () => {
  getUnreadCount()
    .then((count) => useRealtimeStore.getState().setUnreadCount(count))
    .catch(() => undefined); // best-effort — badge cũ vẫn dùng được
};

/**
 * Badge chưa đọc lấy từ luồng realtime (`ready` / `notification.*`). Luồng không mở > 10s → `reconnecting=true`
 * (chấm xám trên chuông); > 30s → quay lại poll `GET /notifications/unread-count` mỗi 60s như trước; nối lại được
 * thì ngừng poll.
 */
export function useUnreadCountSync(): { unread: number; reconnecting: boolean } {
  const status = useRealtimeStore((s) => s.status);
  const since = useRealtimeStore((s) => s.statusSince);
  const unread = useRealtimeStore((s) => s.unreadCount);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (useRealtimeStore.getState().unreadCount === null) refresh();
  }, []);

  useEffect(() => {
    if (status === 'open') return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, [status]);

  const down = status === 'open' ? 0 : Math.max(0, now - since);
  const polling = status !== 'open' && down >= FALLBACK_POLL_AFTER_MS;

  useEffect(() => {
    if (!polling) return;
    refresh();
    const timer = window.setInterval(refresh, FALLBACK_POLL_MS);
    return () => window.clearInterval(timer);
  }, [polling]);

  return { unread: unread ?? 0, reconnecting: status !== 'open' && down >= RECONNECTING_HINT_MS };
}
