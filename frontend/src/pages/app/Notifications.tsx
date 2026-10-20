import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, Settings2, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import PageContainer from '../../components/PageContainer';
import ConfirmModal from '../../components/ConfirmModal';
import { Card } from '../../components/ui';
import { NotificationRow, NotificationSkeletonRow } from '../../components/NotificationBell';
import { openNotificationTarget } from '../../components/notificationMeta';
import { useToast } from '../../components/toast/ToastProvider';
import { useNotificationFeed } from '../../hooks/useNotificationFeed';
import { useUnreadCountSync } from '../../hooks/useUnreadCountSync';
import { NOTIFICATION_CATEGORIES, type AppNotification, type NotificationCategory } from '../../api/notifications';
import { notificationText } from '../../notifications/text';
import { notificationTarget } from '../../notifications/links';
import { C, alpha } from '../../styles/colors';

const PAGE_SIZE = 20;

/**
 * Trang "Xem tất cả" thông báo (D9): lọc tất cả / chưa đọc, chip theo nhóm, cuộn tải thêm, đánh dấu tất cả,
 * xoá từng thông báo, xoá đã đọc. Danh sách cập nhật trực tiếp qua realtime (useNotificationFeed).
 */
export default function Notifications() {
  const { t, lang, go } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { unread } = useUnreadCountSync();
  const [status, setStatus] = useState<'all' | 'unread'>('all');
  const [category, setCategory] = useState<NotificationCategory | undefined>(undefined);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const feed = useNotificationFeed({ pageSize: PAGE_SIZE, status, category, enabled: true });
  const sentinel = useRef<HTMLDivElement>(null);
  const dict = t as unknown as Record<string, string>;
  const isAdmin = user?.role === 'ADMIN';

  const categories = useMemo(
    () => NOTIFICATION_CATEGORIES.filter((c) => c !== 'ADMIN' || isAdmin),
    [isAdmin],
  );

  // Cuộn tới đáy → tải trang kế tiếp.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || feed.last) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) feed.loadMore();
    }, { rootMargin: '240px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [feed.last, feed.loadMore]);

  const onOpen = (n: AppNotification) => {
    feed.markRead(n);
    openNotificationTarget(notificationTarget(n), go, navigate);
  };

  const onDelete = async (n: AppNotification) => {
    try {
      await feed.remove(n);
      toast.success(t.ntfDeleted);
    } catch {
      toast.error(t.ntfActionErr);
      feed.reload();
    }
  };

  const onMarkAll = async () => {
    try {
      await feed.markAll();
    } catch {
      toast.error(t.ntfActionErr);
      feed.reload();
    }
  };

  const onClearRead = async () => {
    setBusy(true);
    try {
      const n = await feed.removeRead();
      toast.success(t.ntfReadCleared.replace('{n}', String(n)));
    } catch {
      toast.error(t.ntfActionErr);
      feed.reload();
    } finally {
      setBusy(false);
      setConfirmClear(false);
    }
  };

  const chip = (active: boolean): CSSProperties => ({
    padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
    border: `1px solid ${active ? alpha(C.primary, 0.35) : C.border}`,
    background: active ? alpha(C.primary, 0.1) : C.surface,
    color: active ? C.primary : C.textSecondary,
  });
  const action: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
    border: `1px solid ${C.border}`, background: C.surface, color: C.textStrong, fontSize: 12.5, fontWeight: 700,
  };

  return (
    <PageContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div role="tablist" aria-label={t.ntfPageTitle} style={{ display: 'flex', gap: 6 }}>
            {(['all', 'unread'] as const).map((s) => (
              <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)} style={chip(status === s)}>
                {s === 'all' ? t.ntfFilterAll : `${t.ntfFilterUnread}${unread > 0 ? ` (${unread > 99 ? '99+' : unread})` : ''}`}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn-outline" onClick={onMarkAll} disabled={unread === 0} style={{ ...action, opacity: unread === 0 ? 0.55 : 1 }}>
              <CheckCheck size={15} /> {t.ntfMarkAll}
            </button>
            <button className="btn-outline" onClick={() => setConfirmClear(true)} style={action}>
              <Trash2 size={15} /> {t.ntfDeleteRead}
            </button>
            <button className="btn-outline" onClick={() => go('settings', '?tab=notifications')} style={action}>
              <Settings2 size={15} /> {t.ntfOpenSettings}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          <button onClick={() => setCategory(undefined)} style={chip(!category)}>{t.ntfCatAll}</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)} style={chip(category === c)} aria-pressed={category === c}>
              {dict[`ntfCat_${c}`]}
            </button>
          ))}
        </div>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {feed.error && feed.items.length === 0 && (
            <div style={{ padding: '36px 16px', textAlign: 'center', fontSize: 13.5, color: C.textMuted }}>
              {t.ntfErr}{' '}
              <button onClick={feed.reload} style={{ background: 'none', border: 'none', color: C.primary, fontWeight: 700, cursor: 'pointer' }}>
                {t.ntfRetry}
              </button>
            </div>
          )}
          {!feed.error && feed.loaded && feed.items.length === 0 && !feed.loading && (
            <div style={{ padding: '44px 16px', textAlign: 'center', fontSize: 13.5, color: C.textMuted }}>
              {status === 'unread' ? t.ntfEmptyUnread : t.ntfEmpty}
            </div>
          )}
          {feed.loading && feed.items.length === 0 && (
            <div role="status" aria-busy="true" aria-label={t.listLoading}>
              <NotificationSkeletonRow titleWidth="60%" bodyWidth="85%" />
              <NotificationSkeletonRow titleWidth="40%" bodyWidth="70%" />
              <NotificationSkeletonRow titleWidth="50%" bodyWidth="90%" />
              <NotificationSkeletonRow titleWidth="65%" bodyWidth="75%" />
              <NotificationSkeletonRow titleWidth="45%" bodyWidth="80%" />
              <NotificationSkeletonRow titleWidth="55%" bodyWidth="65%" />
            </div>
          )}
          <div role="list">
            {feed.items.map((n) => (
              <div key={n.id} role="listitem" style={{ display: 'flex', alignItems: 'stretch' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <NotificationRow notification={n} text={notificationText(n, dict, lang)} onClick={() => onOpen(n)} />
                </div>
                <button
                  onClick={() => onDelete(n)}
                  aria-label={t.ntfDelete}
                  title={t.ntfDelete}
                  className="ntf-row"
                  style={{ flex: 'none', width: 46, border: 'none', borderBottom: `1px solid ${C.surfaceMuted}`, cursor: 'pointer', color: C.ink350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          {feed.loading && feed.items.length > 0 && (
            <NotificationSkeletonRow titleWidth="50%" bodyWidth="75%" />
          )}
          {!feed.loading && feed.loaded && feed.last && feed.items.length > PAGE_SIZE / 2 && (
            <div style={{ padding: '14px', textAlign: 'center', fontSize: 12, color: C.ink350 }}>{t.ntfEnd}</div>
          )}
          <div ref={sentinel} aria-hidden style={{ height: 1 }} />
        </Card>
      </div>

      {confirmClear && (
        <ConfirmModal
          title={t.ntfDeleteRead}
          message={t.ntfDeleteRead + '?'}
          confirmLabel={t.ntfDeleteRead}
          onConfirm={onClearRead}
          onClose={() => setConfirmClear(false)}
          busy={busy}
        />
      )}
    </PageContainer>
  );
}
