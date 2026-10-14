import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from './toast/ToastProvider';
import { useRealtimeEvent } from '../realtime/events';
import { markNotificationRead, type AppNotification, type NotificationCategory } from '../api/notifications';
import { notificationText } from '../notifications/text';
import { notificationTarget } from '../notifications/links';
import { createToastGate } from '../notifications/toastGate';
import { openNotificationTarget } from './notificationMeta';

const SUMMARY_DELAY_MS = 10_000;

const VARIANT_BY_CATEGORY: Record<NotificationCategory, 'success' | 'error' | 'warning' | 'info'> = {
  PUBLISH_ISSUES: 'error',
  ACCOUNTS: 'warning',
  PUBLISHING: 'success',
  AI_CONTENT: 'info',
  BILLING: 'info',
  REMINDERS: 'info',
  ADMIN: 'warning',
};

/**
 * Toast cho thông báo realtime (`notification.created`): chỉ khi cài đặt nhóm bật toast (`event.toast`) VÀ tab đang
 * hiển thị (badge/danh sách vẫn cập nhật ở mọi tab). Tối đa 3 toast / 10s, nhiều hơn gộp thành
 * "Bạn có N thông báo mới". Nút "Xem" đánh dấu đã đọc rồi mở đúng đối tượng. Gắn một lần ở AppShell.
 */
export default function NotificationToaster() {
  const { t, lang, go } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const gate = useRef(createToastGate());
  const summaryTimer = useRef<number | null>(null);
  const dict = t as unknown as Record<string, string>;

  useEffect(() => () => {
    if (summaryTimer.current !== null) window.clearTimeout(summaryTimer.current);
  }, []);

  const open = (n: AppNotification) => {
    if (!n.readAt) markNotificationRead(n.id).catch(() => undefined);
    openNotificationTarget(notificationTarget(n), go, navigate);
  };

  useRealtimeEvent('notification.created', (event) => {
    if (!event.toast || document.visibilityState !== 'visible') return;
    const n = event.notification;
    if (gate.current.offer()) {
      const text = notificationText(n, dict, lang);
      const variant = VARIANT_BY_CATEGORY[n.category ?? 'AI_CONTENT'] ?? 'info';
      toast[variant](text.body || text.title, {
        title: text.title,
        duration: 7000,
        action: { label: t.ntfView, onClick: () => open(n) },
      });
      return;
    }
    if (summaryTimer.current !== null) return;
    summaryTimer.current = window.setTimeout(() => {
      summaryTimer.current = null;
      const count = gate.current.takeSuppressed();
      if (count > 0) {
        toast.info(t.ntfNewMany.replace('{n}', String(count)), {
          title: t.ntfNewManyTitle,
          action: { label: t.ntfViewAll, onClick: () => navigate('/notifications') },
        });
      }
    }, SUMMARY_DELAY_MS);
  });

  return null;
}
