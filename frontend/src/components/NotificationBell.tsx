import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCheck, CheckCircle2, Lightbulb, PlugZap, ShieldAlert, XCircle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { Icon } from "./ui";
import { ICON } from "../data";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationType,
} from "../api/notifications";
import type { Route } from "../types";

const PAGE_SIZE = 8;
const POLL_MS = 60_000;

// Điều hướng theo loại thông báo (FR-75..FR-78): bài đăng → lịch, cần duyệt → nội dung,
// kết nối lại → cài đặt, insight → phân tích.
const ROUTE_BY_TYPE: Record<NotificationType, Route> = {
  POST_PUBLISHED: "calendar",
  POST_FAILED: "calendar",
  REVIEW_NEEDED: "create",
  RECONNECT_NEEDED: "settings",
  NEW_INSIGHT: "analytics",
};

const TYPE_META: Record<NotificationType, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  POST_PUBLISHED: { icon: CheckCircle2, color: "#16a34a", bg: "#eafbf1" },
  POST_FAILED: { icon: XCircle, color: "#e23d6e", bg: "#fdecf1" },
  REVIEW_NEEDED: { icon: ShieldAlert, color: "#d97706", bg: "#fdf4e5" },
  RECONNECT_NEEDED: { icon: PlugZap, color: "#ea580c", bg: "#fdefe6" },
  NEW_INSIGHT: { icon: Lightbulb, color: "#7c3aed", bg: "#f3edfd" },
};

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
          background: "#f4f2fb", border: "1px solid #ece8f6",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}
      >
        <Icon icon={ICON.bell} size={19} stroke="#5b5670" />
        {unread > 0 && (
          <span
            style={{
              position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, padding: "0 4px",
              borderRadius: 999, background: "#ec4899", color: "#fff", fontSize: 10.5, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff",
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
            background: "#fff", borderRadius: 16, border: "1px solid #ece8f6",
            boxShadow: "0 30px 60px -28px rgba(80,40,140,.5)", overflow: "hidden", zIndex: 120,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #f0ecf8", background: "linear-gradient(135deg,#edf9ff,#f6effc)" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#241f3a" }}>{t.ntfTitle}</span>
            {unread > 0 && (
              <button
                onClick={onMarkAll}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#7c3aed", padding: 0 }}
              >
                <CheckCheck size={14} />
                {t.ntfMarkAll}
              </button>
            )}
          </div>

          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {error && (
              <div style={{ padding: "26px 16px", textAlign: "center", fontSize: 13, color: "#8a85a0" }}>
                {t.ntfErr}{" "}
                <button onClick={() => loadPage(0, true)} style={{ background: "none", border: "none", color: "#7c3aed", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  {t.ntfRetry}
                </button>
              </div>
            )}
            {!error && items.length === 0 && !loading && (
              <div style={{ padding: "30px 16px", textAlign: "center", fontSize: 13, color: "#8a85a0" }}>{t.ntfEmpty}</div>
            )}
            {items.map((n) => (
              <NotificationRow key={n.id} notification={n} onClick={() => onItemClick(n)} />
            ))}
            {loading && (
              <div style={{ padding: "14px 16px", textAlign: "center", fontSize: 12.5, color: "#a39bbf" }}>…</div>
            )}
            {!loading && !error && !last && (
              <button
                onClick={() => loadPage(page + 1, false)}
                style={{ width: "100%", padding: "11px 16px", background: "#faf9fe", border: "none", borderTop: "1px solid #f0ecf8", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#7c3aed" }}
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
  const [hover, setHover] = useState(false);
  const meta = TYPE_META[notification.type] ?? TYPE_META.NEW_INSIGHT;
  const TypeIcon = meta.icon;
  const unread = !notification.readAt;

  return (
    <button
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%", display: "flex", gap: 12, padding: "12px 16px", textAlign: "left",
        border: "none", borderBottom: "1px solid #f5f2fb", cursor: "pointer",
        background: hover ? "#f7f6fd" : unread ? "#fbf9ff" : "transparent", transition: "background .15s",
      }}
    >
      <span style={{ width: 34, height: 34, flex: "none", borderRadius: 10, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <TypeIcon size={17} color={meta.color} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: unread ? 800 : 600, color: "#241f3a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {notification.title}
          </span>
          {unread && <span style={{ width: 7, height: 7, flex: "none", borderRadius: "50%", background: "#ec4899" }} />}
        </span>
        {notification.message && (
          <span
            style={{
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              fontSize: 12, color: "#6f6a86", lineHeight: 1.45, marginTop: 2,
            }}
          >
            {notification.message}
          </span>
        )}
        <span style={{ display: "block", fontSize: 11, color: "#a39bbf", marginTop: 4 }}>
          {relativeTime(notification.createdAt, t)}
        </span>
      </span>
    </button>
  );
}

// "x phút/giờ/ngày trước" — đủ dùng cho danh sách thông báo, không cần thư viện.
function relativeTime(iso: string, t: { ntfNow: string; ntfMinAgo: string; ntfHourAgo: string; ntfDayAgo: string }): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t.ntfNow;
  if (minutes < 60) return t.ntfMinAgo.replace("{n}", String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.ntfHourAgo.replace("{n}", String(hours));
  const days = Math.floor(hours / 24);
  return t.ntfDayAgo.replace("{n}", String(days));
}
