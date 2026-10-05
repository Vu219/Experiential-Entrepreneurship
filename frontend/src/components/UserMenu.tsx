import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, CreditCard, Home, LayoutDashboard, LogOut, Settings, Shield, UserCircle } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useApp } from "../context/AppContext";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { alpha, C } from "../styles/colors";

/**
 * Chip người dùng đã đăng nhập trên header. Hover (desktop) hoặc click để mở dropdown.
 * Dùng ở 2 nơi (một component để đồng nhất giao diện):
 *  - variant "landing" (mặc định): Hồ sơ / Gói & thanh toán / Cài đặt / Bảng điều khiển / (Quản trị) / Đăng xuất.
 *  - variant "app" (topbar trong ứng dụng): Trang chủ / Hồ sơ / Gói & thanh toán / Cài đặt / Đăng xuất.
 * Cả hai: dòng phụ + badge = GÓI THẬT của user (Free/Plus/Pro — lấy từ /users/me, không hardcode).
 * Hỗ trợ: click ra ngoài đóng, Esc đóng (focus trả về nút mở), điều hướng bàn phím qua Tab.
 */
export default function UserMenu({ variant = "landing" }: { variant?: "landing" | "app" }) {
  const { user } = useAuth();
  const { t, go, logout, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = user?.fullName || user?.email.split("@")[0] || "User";
  const initial = (user?.fullName || user?.email || "?").charAt(0).toUpperCase();
  const role = user?.role ?? null;
  // Nhãn gói động theo user.plan (null coi như FREE) — thay hardcode "Gói Premium" cũ.
  const planLabel = user?.plan === "PRO" ? t.planPro : user?.plan === "PLUS" ? t.planPlus : t.planFree;
  const isApp = variant === "app";

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Esc đóng menu và trả focus về nút mở (truy cập bàn phím).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const openMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  const avatar = (size: number, font: number): CSSProperties => ({
    width: size, height: size, borderRadius: "50%", background: brandGradient,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: C.onBrand, fontWeight: 800, fontSize: font, overflow: "hidden", flex: "none",
  });

  const pick = (onPick: () => void) => () => {
    setOpen(false);
    onPick();
  };

  const showText = !(isApp && isMobile); // topbar mobile: chỉ avatar + mũi tên cho gọn

  return (
    <div ref={wrapRef} style={{ position: "relative" }} onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
      {/* Trigger chip */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "5px 9px 5px 6px",
          background: C.surfaceMuted, border: `1px solid ${C.border}`, borderRadius: 999, cursor: "pointer",
          transition: "border-color .2s, background .2s",
        }}
      >
        <span style={avatar(32, 13)}>
          {user?.avatarUrl ? <img src={user.avatarUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
        </span>
        {showText && (
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15, maxWidth: 140 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.textStrong, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</span>
            <span style={{ fontSize: 10.5, color: C.textMuted, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{planLabel}</span>
          </span>
        )}
        <ChevronDown size={15} style={{ color: C.ink350, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div
          role="menu"
          className="menu-pop"
          style={{
            position: "absolute", right: 0, top: "100%", marginTop: 8, width: 256,
            background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`,
            boxShadow: C.shadowPop, overflow: "hidden", zIndex: 120,
          }}
        >
          <div style={{ padding: "14px 16px", background: C.menuHeader, borderBottom: `1px solid ${C.surfaceMuted}`, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={avatar(44, 17)}>
              {user?.avatarUrl ? <img src={user.avatarUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.textStrong, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</p>
              <p style={{ margin: 0, fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</p>
              <span style={{ display: "inline-flex", gap: 4, marginTop: 4 }}>
                {role && (
                  <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 5, fontSize: 9, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: C.primary, background: alpha(C.primary, 0.1), border: `1px solid ${alpha(C.primary, 0.22)}` }}>{role}</span>
                )}
                <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 5, fontSize: 9, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase", color: C.info, background: alpha(C.info, 0.08), border: `1px solid ${alpha(C.info, 0.2)}` }}>{planLabel}</span>
              </span>
            </div>
          </div>

          <div style={{ padding: "6px 0" }}>
            {isApp ? (
              <>
                <MenuItem icon={<Home size={17} />} label={t.nHome} onClick={pick(() => go("landing"))} />
                <MenuItem icon={<UserCircle size={17} />} label={t.navProfile} onClick={pick(() => go("profile"))} />
                <MenuItem icon={<CreditCard size={17} />} label={t.navBilling} onClick={pick(() => go("billing"))} />
                <MenuItem icon={<Settings size={17} />} label={t.navSettings} onClick={pick(() => go("settings"))} />
              </>
            ) : (
              <>
                <MenuItem icon={<UserCircle size={17} />} label={t.navProfile} onClick={pick(() => go("profile"))} />
                <MenuItem icon={<CreditCard size={17} />} label={t.navBilling} onClick={pick(() => go("billing"))} />
                <MenuItem icon={<Settings size={17} />} label={t.navSettings} onClick={pick(() => go("settings"))} />
                <MenuItem icon={<LayoutDashboard size={17} />} label={t.navDashboard} onClick={pick(() => go("dashboard"))} />
                {role === "ADMIN" && <MenuItem icon={<Shield size={17} />} label={t.navAdmin} onClick={pick(() => go("admin"))} />}
              </>
            )}
          </div>
          {/* Đăng xuất tách riêng dưới cùng, có đường kẻ ngăn cách */}
          <div style={{ borderTop: `1px solid ${C.surfaceMuted}`, padding: "6px 0" }}>
            <MenuItem icon={<LogOut size={17} />} label={t.signOut} danger onClick={pick(logout)} />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger = false }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  // Hover bằng class CSS (.menu-item trong index.css) — màu theo token sáng/tối, không state JS.
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={danger ? "menu-item menu-item--danger" : "menu-item"}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
        border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
      }}
    >
      <span className="menu-item__icon" style={{ display: "flex" }}>{icon}</span>
      {label}
    </button>
  );
}
