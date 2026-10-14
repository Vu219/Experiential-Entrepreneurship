import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteNotification,
  deleteReadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationCategory,
} from '../api/notifications';
import { useRealtimeEvent } from '../realtime/events';
import { useRealtimeStore } from '../store/useRealtimeStore';

interface Options {
  pageSize: number;
  status?: 'all' | 'unread';
  category?: NotificationCategory;
  /** false = chưa tải (vd dropdown chuông đang đóng) — vẫn nghe realtime nếu đã tải trước đó. */
  enabled: boolean;
}

/**
 * Danh sách thông báo phân trang + cập nhật trực tiếp (dùng chung cho chuông và trang /notifications):
 * `notification.created` chèn đầu danh sách, `.read`/`.deleted` đồng bộ giữa các tab, `ready{resync}` tải lại.
 * Thao tác (đọc / đọc tất cả / xoá) lạc quan; badge chưa đọc ở useRealtimeStore (server gửi lại số chính xác qua SSE).
 */
export function useNotificationFeed({ pageSize, status = 'all', category, enabled }: Options) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(0);
  const [last, setLast] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const requestSeq = useRef(0);
  const resyncSeq = useRealtimeStore((s) => s.resyncSeq);

  const loadPage = useCallback(async (pageNo: number, replace: boolean) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(false);
    try {
      const result = await listNotifications({ page: pageNo, size: pageSize, status, category });
      if (seq !== requestSeq.current) return; // bộ lọc đã đổi trong lúc chờ
      setItems((prev) => {
        if (replace) return result.content;
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...result.content.filter((n) => !seen.has(n.id))];
      });
      setPage(result.page);
      setLast(result.last);
      setLoaded(true);
    } catch {
      if (seq === requestSeq.current) setError(true);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [pageSize, status, category]);

  const reload = useCallback(() => loadPage(0, true), [loadPage]);
  const loadMore = useCallback(() => {
    if (!loading && !last) loadPage(page + 1, false);
  }, [loading, last, page, loadPage]);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  // Nối lại mà không phát bù được → danh sách có thể thiếu: tải lại trang đầu nếu đang hiển thị.
  const resyncRef = useRef({ loaded, reload });
  resyncRef.current = { loaded, reload };
  useEffect(() => {
    if (resyncSeq > 0 && resyncRef.current.loaded) resyncRef.current.reload();
  }, [resyncSeq]);

  useRealtimeEvent('notification.created', ({ notification }) => {
    if (!loaded) return;
    if (category && notification.category !== category) return;
    setItems((prev) => (prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev]));
  });

  useRealtimeEvent('notification.read', ({ ids, all }) => {
    if (!loaded) return;
    const readAt = new Date().toISOString();
    const hit = (n: AppNotification) => all || (ids ?? []).includes(n.id);
    setItems((prev) => (status === 'unread'
      ? prev.filter((n) => !hit(n))
      : prev.map((n) => (hit(n) && !n.readAt ? { ...n, readAt } : n))));
  });

  useRealtimeEvent('notification.deleted', ({ ids, read }) => {
    if (!loaded) return;
    setItems((prev) => prev.filter((n) => !(ids ?? []).includes(n.id) && !(read && n.readAt)));
  });

  const decrementUnread = (by: number) => {
    const store = useRealtimeStore.getState();
    if (store.unreadCount !== null) store.setUnreadCount(store.unreadCount - by);
  };

  const markRead = useCallback((n: AppNotification) => {
    if (n.readAt) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    decrementUnread(1);
    markNotificationRead(n.id).catch(() => undefined); // lỗi: badge tự chỉnh ở lần đồng bộ sau
  }, []);

  const markAll = useCallback(() => {
    const readAt = new Date().toISOString();
    setItems((prev) => (status === 'unread' ? [] : prev.map((x) => (x.readAt ? x : { ...x, readAt }))));
    useRealtimeStore.getState().setUnreadCount(0);
    return markAllNotificationsRead();
  }, [status]);

  const remove = useCallback(async (n: AppNotification) => {
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    if (!n.readAt) decrementUnread(1);
    await deleteNotification(n.id);
  }, []);

  const removeRead = useCallback(async () => {
    setItems((prev) => prev.filter((x) => !x.readAt));
    return deleteReadNotifications();
  }, []);

  return { items, loading, error, last, loaded, reload, loadMore, markRead, markAll, remove, removeRead };
}
