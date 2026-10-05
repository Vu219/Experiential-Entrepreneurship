import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCheck } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { Icon } from "./ui";
import { ICON } from "../data";
import { ROUTE_BY_TYPE, TYPE_META } from "./notificationMeta";
import { formatRelativeTime } from "../utils/format";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "../api/notifications";
import { C } from "../styles/colors";

const PAGE_SIZE = 8;
const POLL_MS = 60_000;

/** Chuông thông báo trên Topbar: badge số chưa đọc + dropdown danh sách (FR-75..FR-78, FR-38). */
export default function NotificationBell() {
  const { t, go } = useApp();
  const { isMobile } = useBreakpoint();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(0);
  const [last, setLast] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refreshUnread = useCallback(() => {
    getUnreadCount().then(setUnread).catch(() => undefined); // best-effort — badge cũ vẫn dùng được
  }, []);

  // Badge chưa đọc: nạp khi mount + poll mỗi phút.
  useEffect(() => {
    refreshUnread();
    const timer = setInterval(refreshUnread, POLL_MS);
    return () => clearInterval(timer);
  }, [refreshUnread]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const loadPage = useCallback(async (pageNo: number, replace: boolean) => {
    setLoading(true);
    setError(false);
    try {
      const result = await listNotifications({ page: pageNo, size: PAGE_SIZE });
      setItems((prev) => (replace ? result.content : [...prev, ...result.content]));
      setPage(result.page);
      setLast(result.last);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      loadPage(0, true);
      refreshUnread();
    }
  };

  const onItemClick = (n: AppNotification) => {
    if (!n.readAt) {
      // Optimistic: đánh dấu đã đọc ngay, lỗi thì poll sau tự chỉnh lại.
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
      markNotificationRead(n.id).catch(() => undefined);
    }
    setOpen(false);
    go(ROUTE_BY_TYPE[n.type] ?? "dashboard");
  };

  const onMarkAll = () => {
    setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })));
    setUnread(0);
    markAllNotificationsRead().catch(() => undefined);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.ntfTitle}
        style={{
          position: "relative", width: isMobile ? 38 : 42, height: isMobile ? 38 : 42, borderRadius: 11,
          background: C.surfaceMuted, border: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}
      >
        <Icon icon={ICON.bell} size={19} stroke={C.ink550} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, padding: "0 4px",
              borderRadius: 999, background: "#ec4899", color: "#fff", fontSize: 10.5, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.surface}`,
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="menu-pop"
          style={{
            position: "absolute", right: isMobile ? -52 : 0, top: "100%", marginTop: 8,
            width: "min(370px, calc(100vw - 28px))",
            background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`,
            boxShadow: C.shadowPop, overflow: "hidden", zIndex: 120,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${C.surfaceMuted}`, background: C.menuHeader }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.textStrong }}>{t.ntfTitle}</span>
            {unread > 0 && (
              <button
                onClick={onMarkAll}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: C.primary, padding: 0 }}
              >
                <CheckCheck size={14} />
                {t.ntfMarkAll}
              </button>
            )}
          </div>

          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {error && (
              <div style={{ padding: "26px 16px", textAlign: "center", fontSize: 13, color: C.textMuted }}>
                {t.ntfErr}{" "}
                <button onClick={() => loadPage(0, true)} style={{ background: "none", border: "none", color: C.primary, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  {t.ntfRetry}
                </button>
              </div>
            )}
            {!error && items.length === 0 && !loading && (
              <div style={{ padding: "30px 16px", textAlign: "center", fontSize: 13, color: C.textMuted }}>{t.ntfEmpty}</div>
            )}
            {items.map((n) => (
              <NotificationRow key={n.id} notification={n} onClick={() => onItemClick(n)} />
            ))}
            {loading && (
              <div style={{ padding: "14px 16px", textAlign: "center", fontSize: 12.5, color: C.ink350 }}>…</div>
            )}
            {!loading && !error && !last && (
              <button
                onClick={() => loadPage(page + 1, false)}
                style={{ width: "100%", padding: "11px 16px", background: C.surfaceSubtle, border: "none", borderTop: `1px solid ${C.surfaceMuted}`, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: C.primary }}
              >
                {t.ntfMore}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ notification, onClick }: { notification: AppNotification; onClick: () => void }) {
  const { t } = useApp();
  const meta = TYPE_META[notification.type] ?? TYPE_META.NEW_INSIGHT;
  const TypeIcon = meta.icon;
  const unread = !notification.readAt;

  return (
    <button
      role="menuitem"
      onClick={onClick}
      // Nền chưa đọc + hover bằng class CSS (.ntf-row trong index.css), không state JS.
      className={unread ? "ntf-row ntf-row--unread" : "ntf-row"}
      style={{
        width: "100%", display: "flex", gap: 12, padding: "12px 16px", textAlign: "left",
        border: "none", borderBottom: `1px solid ${C.surfaceMuted}`, cursor: "pointer",
      }}
    >
      <span style={{ width: 34, height: 34, flex: "none", borderRadius: 10, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <TypeIcon size={17} color={meta.color} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: unread ? 800 : 600, color: C.textStrong, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {notification.title}
          </span>
          {unread && <span style={{ width: 7, height: 7, flex: "none", borderRadius: "50%", background: "#ec4899" }} />}
        </span>
        {notification.message && (
          <span
            style={{
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              fontSize: 12, color: C.textSecondary, lineHeight: 1.45, marginTop: 2,
            }}
          >
            {notification.message}
          </span>
        )}
        <span style={{ display: "block", fontSize: 11, color: C.ink350, marginTop: 4 }}>
          {formatRelativeTime(notification.createdAt, t)}
        </span>
      </span>
    </button>
  );
}
