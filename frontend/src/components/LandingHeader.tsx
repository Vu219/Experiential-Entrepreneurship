import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { LogIn, Menu, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../auth/AuthContext";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useUiStore } from "../store/useUiStore";
import { LangButton } from "./AppShell";
import UserMenu from "./UserMenu";

// Cuộn mượt tới section trên trang Landing (ID gắn trong Landing.tsx).
const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

// Home → hero; Features → quy trình; Pricing → gói đăng ký; Resources → footer.
// `spy` = section id quyết định trạng thái active của link.
const navItems = (t: ReturnType<typeof useApp>["t"]) => [
  { label: t.nHome, id: "home", spy: "home" },
  { label: t.nFeatures, id: "features", spy: "features" },
  { label: t.nPricing, id: "pricing", spy: "pricing" },
  { label: t.nResources, id: "resources", spy: "resources" },
];

export default function LandingHeader() {
  const { t, go, brandGradient } = useApp();
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const { scrolled, setScrolled, mobileOpen, toggleMobile, closeMobile } = useUiStore();
  const [activeSection, setActiveSection] = useState("home");

  // Một listener duy nhất: cập nhật trạng thái cuộn (zustand) + section đang xem
  // (scroll-spy) để highlight link tương ứng trên header.
  useEffect(() => {
    const SPY_IDS = ["home", "features", "pricing", "resources"];
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      const pos = window.scrollY + 160; // bù cho header cố định
      let current = "home";
      for (const id of SPY_IDS) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= pos) current = id;
      }
      // Chạm đáy trang → coi như đang ở section cuối (footer/resources).
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 2) {
        current = SPY_IDS[SPY_IDS.length - 1];
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [setScrolled]);

  // Khoá cuộn body khi menu mobile mở (overflow:hidden) để nền không trôi.
  useEffect(() => {
    if (!(isMobile && mobileOpen)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isMobile, mobileOpen]);

  const items = useMemo(() => navItems(t), [t]);

  // ===== Glider: viên pill trượt tới tab đang active (hoặc đang hover) =====
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [glider, setGlider] = useState({ left: 0, top: 0, width: 0, height: 0 });

  // Pill chỉ bám theo tab đang active (đổi khi bấm → cuộn → scroll-spy cập nhật),
  // KHÔNG trượt theo hover.
  const measureGlider = useCallback(() => {
    const idx = items.findIndex((it) => it.spy === activeSection);
    const el = itemRefs.current[idx];
    if (el) setGlider({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
  }, [activeSection, items]);

  // Đo lại khi đổi tab/hover/ngôn ngữ, và khi header co lại lúc cuộn (đổi padding).
  useLayoutEffect(() => { measureGlider(); }, [measureGlider, scrolled]);
  useEffect(() => {
    window.addEventListener("resize", measureGlider);
    return () => window.removeEventListener("resize", measureGlider);
  }, [measureGlider]);

  const innerStyle: CSSProperties = {
    width: "100%",
    maxWidth: scrolled ? (isMobile ? "94%" : 1040) : 1240,
    margin: scrolled ? "14px auto 0" : "0 auto",
    padding: scrolled ? (isMobile ? "8px 14px" : "8px 20px") : isMobile ? "14px 16px" : "20px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    background: scrolled ? "rgba(255,255,255,.65)" : "transparent",
    backdropFilter: scrolled ? "blur(10px)" : "none",
    WebkitBackdropFilter: scrolled ? "blur(10px)" : "none",
    border: `1px solid ${scrolled ? "#ece8f6" : "transparent"}`,
    borderRadius: scrolled ? 999 : 0,
    boxShadow: scrolled ? "0 16px 40px -20px rgba(80,40,140,.45)" : "none",
    pointerEvents: "auto",
    transition: "all .4s ease-in-out",
  };

  const gradientBtn = (small: boolean): CSSProperties => ({
    border: "none", borderRadius: small ? 999 : 999, padding: small ? "9px 18px" : "11px 26px",
    fontWeight: 700, fontSize: small ? 13 : 14, color: "#fff", background: brandGradient,
    boxShadow: "0 12px 26px -10px rgba(139,92,246,.6)", cursor: "pointer", transition: "all .3s",
  });
  const outlineBtn: CSSProperties = {
    border: "1.5px solid #d9cef5", borderRadius: 999, padding: "10px 22px",
    fontWeight: 700, fontSize: 14, color: "#7c3aed", background: "#fff", cursor: "pointer", transition: "all .3s",
  };

  return (
    <>
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", zIndex: 100, display: "flex", justifyContent: "center", pointerEvents: "none", transition: "all .4s ease-in-out" }}>
        <header id="home-bar" style={innerStyle}>
          <a
            href="#home"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); closeMobile(); }}
            style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <img className="logo-hover" src="/aima-logo.png" alt="AIMA" style={{ height: scrolled ? 38 : 46, width: "auto", display: "block", transition: "height .4s ease-in-out" }} />
          </a>

          {!isMobile && (
            <nav onMouseLeave={() => setHovered(null)} style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
              {/* Viên pill trượt phía sau tab đang chọn */}
              <span
                aria-hidden
                style={{
                  position: "absolute", left: glider.left, top: glider.top, width: glider.width, height: glider.height,
                  borderRadius: 999, background: brandGradient, opacity: glider.width ? 1 : 0, zIndex: 0,
                  boxShadow: "0 10px 22px -12px rgba(139,92,246,.6)",
                  transition: "left .28s cubic-bezier(.4,.7,.3,1), width .28s cubic-bezier(.4,.7,.3,1), top .28s ease, height .28s ease, opacity .2s ease",
                }}
              />
              {items.map((it, i) => {
                const isActive = activeSection === it.spy;
                return (
                  <a
                    key={i}
                    ref={(el) => { itemRefs.current[i] = el; }}
                    href={`#${it.id}`}
                    onClick={(e) => { e.preventDefault(); scrollToId(it.id); }}
                    onMouseEnter={() => setHovered(i)}
                    style={{ position: "relative", zIndex: 1, padding: "9px 17px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", fontWeight: isActive ? 700 : 600, fontSize: 15, color: isActive ? "#fff" : hovered === i ? "#7c3aed" : "#4b4660", transition: "color .25s ease" }}
                  >
                    {it.label}
                  </a>
                );
              })}
            </nav>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
            {!isMobile && <LangButton />}
            {user ? (
              <UserMenu />
            ) : isMobile ? (
              <button className="btn-soft" onClick={toggleMobile} aria-label="Menu" style={{ display: "flex", padding: 8, border: "1px solid #ece8f6", borderRadius: 12, background: "#fff", cursor: "pointer", color: "#4b4660" }}>
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            ) : (
              <>
                {scrolled ? (
                  <button className="login-pill" onClick={() => go("login")} aria-label={t.signIn}>
                    <span className="sign"><LogIn size={18} strokeWidth={2.5} /></span>
                    <span className="btn-text">{t.signIn}</span>
                  </button>
                ) : (
                  <button className="btn-outline" onClick={() => go("login")} style={outlineBtn}>{t.signIn}</button>
                )}
                <button className="btn-grad" onClick={() => go("register")} style={gradientBtn(scrolled)}>{t.tryAima}</button>
              </>
            )}
          </div>
        </header>
      </div>

      {/* Backdrop tối mờ phủ toàn trang khi menu mobile mở (click để đóng) */}
      {isMobile && mobileOpen && (
        <div
          onClick={closeMobile}
          aria-hidden
          style={{ position: "fixed", inset: 0, zIndex: 98, background: "rgba(0,0,0,.4)", backdropFilter: "blur(1px)", WebkitBackdropFilter: "blur(1px)", pointerEvents: "auto" }}
        />
      )}

      {/* Panel menu mobile */}
      {isMobile && mobileOpen && (
        <div style={{ position: "fixed", top: scrolled ? 70 : 78, left: "50%", transform: "translateX(-50%)", width: "90%", maxWidth: 460, zIndex: 99, background: "#fff", border: "1px solid #ece8f6", borderRadius: 18, boxShadow: "0 28px 56px -26px rgba(80,40,140,.5)", padding: 16, pointerEvents: "auto" }}>
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {items.map((it, i) => {
              const isActive = activeSection === it.spy;
              return (
                <a
                  key={i}
                  href={`#${it.id}`}
                  onClick={(e) => { e.preventDefault(); scrollToId(it.id); closeMobile(); }}
                  style={{ padding: "11px 12px", borderRadius: 11, fontWeight: isActive ? 700 : 600, fontSize: 15, color: isActive ? "#7c3aed" : "#4b4660", background: isActive ? "#f4eefe" : "transparent", textDecoration: "none" }}
                >
                  {it.label}
                </a>
              );
            })}
          </nav>
          <div style={{ height: 1, background: "#f0ecf8", margin: "12px 0" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <LangButton />
            {!user && (
              <>
                <button className="btn-outline" onClick={() => { closeMobile(); go("login"); }} style={{ ...outlineBtn, width: "100%" }}>{t.signIn}</button>
                <button className="btn-grad" onClick={() => { closeMobile(); go("register"); }} style={{ ...gradientBtn(false), width: "100%" }}>{t.tryAima}</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
