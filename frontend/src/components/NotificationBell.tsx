import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCheck } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useUiStore } from "../store/useUiStore";
import { Icon } from "./ui";
import { ICON } from "../data";
import { openNotificationTarget, TYPE_META } from "./notificationMeta";
import { formatRelativeTime } from "../utils/format";
import type { AppNotification } from "../api/notifications";
import { notificationText } from "../notifications/text";
import { notificationTarget } from "../notifications/links";
import { useNotificationFeed } from "../hooks/useNotificationFeed";
import { useUnreadCountSync } from "../hooks/useUnreadCountSync";
import { useRealtimeEvent } from "../realtime/events";
import { C } from "../styles/colors";

const PAGE_SIZE = 8;
const RING_MS = 900;

/**
 * Chuông thông báo trên Topbar: badge chưa đọc (realtime, poll dự phòng khi mất kết nối) + dropdown danh sách cập nhật
 * trực tiếp (FR-75..FR-79). "Xem tất cả" → trang /notifications (D9).
 */
export default function NotificationBell() {
  const { t, lang, go } = useApp();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  // Trạng thái mở nằm ở useUiStore để ô tìm kiếm toàn cục ("Mở thông báo") mở được chuông từ bên ngoài.
  const open = useUiStore((s) => s.notificationsOpen);
  const setOpen = useUiStore((s) => s.setNotificationsOpen);
  const { unread, reconnecting } = useUnreadCountSync();
  const feed = useNotificationFeed({ pageSize: PAGE_SIZE, enabled: open });
  const [ringing, setRinging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dict = t as unknown as Record<string, string>;

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [setOpen]);

  // Rời khu vực (unmount topbar, vd đăng xuất) → không để dropdown mở sẵn cho lần sau.
  useEffect(() => () => setOpen(false), [setOpen]);

  // Thông báo mới: rung nhẹ chuông (CSS tắt hiệu ứng khi prefers-reduced-motion).
  useRealtimeEvent("notification.created", () => {
    setRinging(true);
    window.setTimeout(() => setRinging(false), RING_MS);
  });

  const toggle = () => setOpen(!open);

  const onItemClick = (n: AppNotification) => {
    feed.markRead(n);
    setOpen(false);
    openNotificationTarget(notificationTarget(n), go, navigate);
  };

  const onMarkAll = () => {
    feed.markAll().catch(() => undefined);
  };

  const onViewAll = () => {
    setOpen(false);
    navigate("/notifications");
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={reconnecting ? `${t.ntfTitle} — ${t.ntfReconnecting}` : t.ntfTitle}
        title={reconnecting ? t.ntfReconnecting : undefined}
        className={ringing ? "ntf-bell ntf-bell--ring" : "ntf-bell"}
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
        {reconnecting && (
          <span
            aria-hidden
            style={{
              position: "absolute", bottom: -3, right: -3, width: 10, height: 10, borderRadius: "50%",
              background: C.ink350, border: `2px solid ${C.surface}`,
            }}
          />
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

          {reconnecting && (
            <div style={{ padding: "7px 16px", fontSize: 11.5, color: C.textMuted, background: C.surfaceSubtle, borderBottom: `1px solid ${C.surfaceMuted}` }}>
              {t.ntfReconnecting}
            </div>
          )}

          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {feed.error && (
              <div style={{ padding: "26px 16px", textAlign: "center", fontSize: 13, color: C.textMuted }}>
                {t.ntfErr}{" "}
                <button onClick={feed.reload} style={{ background: "none", border: "none", color: C.primary, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  {t.ntfRetry}
                </button>
              </div>
            )}
            {!feed.error && feed.items.length === 0 && !feed.loading && (
              <div style={{ padding: "30px 16px", textAlign: "center", fontSize: 13, color: C.textMuted }}>{t.ntfEmpty}</div>
            )}
            {feed.loading && feed.items.length === 0 && (
              <div role="status" aria-busy="true" aria-label={t.listLoading}>
                <NotificationSkeletonRow titleWidth="65%" bodyWidth="85%" />
                <NotificationSkeletonRow titleWidth="45%" bodyWidth="75%" />
                <NotificationSkeletonRow titleWidth="55%" bodyWidth="90%" />
                <NotificationSkeletonRow titleWidth="50%" bodyWidth="65%" />
              </div>
            )}
            {feed.items.map((n) => (
              <NotificationRow key={n.id} notification={n} text={notificationText(n, dict, lang)} onClick={() => onItemClick(n)} />
            ))}
            {feed.loading && feed.items.length > 0 && (
              <NotificationSkeletonRow titleWidth="50%" bodyWidth="75%" />
            )}
            {!feed.loading && !feed.error && !feed.last && (
              <button
                onClick={feed.loadMore}
                style={{ width: "100%", padding: "11px 16px", background: C.surfaceSubtle, border: "none", borderTop: `1px solid ${C.surfaceMuted}`, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: C.primary }}
              >
                {t.ntfMore}
              </button>
            )}
          </div>

          <button
            onClick={onViewAll}
            className="link-underline"
            style={{ width: "100%", padding: "11px 16px", background: C.surface, border: "none", borderTop: `1px solid ${C.surfaceMuted}`, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: C.primary }}
          >
            {t.ntfViewAll}
          </button>
        </div>
      )}
    </div>
  );
}

export function NotificationRow({
  notification,
  text,
  onClick,
}: {
  notification: AppNotification;
  text: { title: string; body: string };
  onClick: () => void;
}) {
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
            {text.title}
          </span>
          {unread && <span style={{ width: 7, height: 7, flex: "none", borderRadius: "50%", background: "#ec4899" }} />}
        </span>
        {text.body && (
          <span
            style={{
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              fontSize: 12, color: C.textSecondary, lineHeight: 1.45, marginTop: 2,
            }}
          >
            {text.body}
          </span>
        )}
        <span style={{ display: "block", fontSize: 11, color: C.ink350, marginTop: 4 }}>
          {formatRelativeTime(notification.createdAt, t)}
        </span>
      </span>
    </button>
  );
}

export function NotificationSkeletonRow({
  titleWidth = '55%',
  bodyWidth = '85%',
}: {
  titleWidth?: string;
  bodyWidth?: string;
} = {}) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: '100%',
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        borderBottom: `1px solid ${C.surfaceMuted}`,
        boxSizing: 'border-box',
      }}
    >
      <div className="sk" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10 }} />
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
        <div className="sk" style={{ width: titleWidth, height: 13, borderRadius: 6 }} />
        <div className="sk" style={{ width: bodyWidth, height: 11, borderRadius: 5, marginTop: 2 }} />
        <div className="sk" style={{ width: '28%', height: 10, borderRadius: 5, marginTop: 3 }} />
      </div>
    </div>
  );
}
