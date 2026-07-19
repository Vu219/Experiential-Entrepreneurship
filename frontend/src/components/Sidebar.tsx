import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Users, AlertTriangle, Server, FileText, Code, DollarSign, Package,
  KeyRound, Route as RouteIcon, Coins, Gauge,
  ChevronRight, ChevronLeft, X, type LucideIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../auth/AuthContext';
import { getTokenUsage, type TokenUsage } from '../api/auth';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useUiStore } from '../store/useUiStore';
import { Icon } from './ui';
import type { Route } from '../types';
import { ICON } from '../data';

interface Item {
  key: Route;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

/** Key sessionStorage: user tắt card "Nâng cấp Pro" CHỈ trong phiên hiện tại — phiên sau card hiện lại. */
const UPGRADE_CARD_HIDDEN_KEY = 'aima.upgradeCardHidden';

/** Rút gọn số token cho thanh usage: 1000 → 1K, 100000 → 100K, 1000000 → 1M. */
const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${+(n / 1_000).toFixed(1)}K`
      : n.toLocaleString('vi-VN');

export default function Sidebar({ mode = 'app', mobileMenuOpen, setMobileMenuOpen }: { mode?: 'app' | 'admin', mobileMenuOpen?: boolean, setMobileMenuOpen?: (v: boolean) => void }) {
  const { t, route, go, brandGradient } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { isMobile } = useBreakpoint();
  const { sidebarCollapsed, toggleSidebar, autoCollapse, toggleAutoCollapse, setSidebarCollapsed, profileOrigin } = useUiStore();
  const [hover, setHover] = useState(false);
  // Card "Nâng cấp Pro": chỉ user gói FREE thấy; tắt bằng sessionStorage (không dùng localStorage)
  // để phiên sau (mở lại tab/trình duyệt) card hiện lại bình thường. Xử lý hoàn toàn phía FE.
  const [upgradeHidden, setUpgradeHidden] = useState(() => sessionStorage.getItem(UPGRADE_CARD_HIDDEN_KEY) === '1');
  const dismissUpgrade = () => {
    sessionStorage.setItem(UPGRADE_CARD_HIDDEN_KEY, '1');
    setUpgradeHidden(true);
  };
  const showUpgradeCard = (user?.plan ?? 'FREE') === 'FREE' && !upgradeHidden;

  // Thanh usage token AI trong tháng (GET /users/me/token-usage). Refetch khi đổi route
  // để số liệu cập nhật sau mỗi lần tạo/định dạng/nghiên cứu; lỗi thì ẩn thanh (không chặn UI).
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getTokenUsage()
      .then((u) => { if (!cancelled) setUsage(u); })
      .catch(() => { if (!cancelled) setUsage(null); });
    return () => { cancelled = true; };
  }, [user, route]);

  const usagePct = usage && usage.limit !== null
    ? Math.min(usage.limit > 0 ? (usage.used / usage.limit) * 100 : 100, 100)
    : 0;
  const usageFill = usagePct >= 100 ? '#ef4444' : usagePct >= 80 ? '#f59e0b' : brandGradient;

  // Hồ sơ/Cài đặt là route khu "app", nhưng nếu mở từ khu Quản trị thì vẫn giữ
  // sidebar admin và highlight ở mục gốc (vd Trạng thái hệ thống / Bảng điều khiển)
  // thay vì nhảy về — dùng profileOrigin đã ghi lại lúc điều hướng.
  // Hồ sơ/Cài đặt là route khu "app"; nếu mở từ khu Quản trị thì vẫn giữ sidebar
  // admin (danh sách mục + nút quay lại) để không mất ngữ cảnh — nhưng highlight
  // chỉ nằm ở đúng tab đang mở, không giữ sáng tab trước đó.
  const onProfilePage = route === 'profile' || route === 'settings';
  const adminOrigin = onProfilePage && !!profileOrigin && profileOrigin.startsWith('admin');
  const isAdminArea = mode === 'admin' || adminOrigin;

  const collapsed = !isMobile && (autoCollapse ? !hover : sidebarCollapsed);

  const onArrow = () => {
    if (autoCollapse) {
      toggleAutoCollapse();
      setSidebarCollapsed(false);
      setHover(false);
    } else {
      toggleSidebar();
    }
  };

  // Sidebar app chia CỤM (đồng bộ style nhãn nhóm với sidebar admin — UI refactor mục 3).
  // "Token & mức dùng" không còn ở đây — đã thành tab trong Cài đặt (mục 7), lối vào là
  // widget token ở đáy sidebar + dropdown avatar.
  const appGroups: { label?: string; items: Item[] }[] = [
    {
      label: t.secMain,
      items: [
        { key: 'dashboard', label: t.navDashboard, icon: ICON.dashboard },
        { key: 'analytics', label: t.navAnalytics, icon: ICON.analytics },
        { key: 'trends', label: t.navTrends, icon: ICON.trends },
      ],
    },
    {
      label: t.secContent,
      items: [
        { key: 'create', label: t.navCreate, icon: ICON.create },
        { key: 'calendar', label: t.navCalendar, icon: ICON.calendar, badge: '3' },
        // Trung tâm hồi phục bài lỗi (FR-35..FR-39) — bổ trợ lối vào từ trang Lịch + notification.
        { key: 'failedPosts', label: t.navFailedPosts, icon: AlertTriangle },
      ],
    },
    {
      label: t.secBrand,
      items: [{ key: 'brand', label: t.navBrand, icon: ICON.brand }],
    },
  ];
  // Sidebar admin chia NHÓM (đồng bộ UI khu quản trị). Nhóm đầu (Bảng điều khiển)
  // không cần nhãn — mục Tổng quan tự đứng đầu như các admin UI thông dụng.
  const adminGroups: { label?: string; items: Item[] }[] = [
    { items: [{ key: 'admin', label: t.navAdminOverview, icon: ICON.dashboard }] },
    { label: t.admGrpContent, items: [{ key: 'adminPosts', label: t.navAdminPosts, icon: AlertTriangle }] },
    {
      label: t.admGrpBusiness,
      items: [
        { key: 'adminUsers', label: t.navAdminUsers, icon: Users },
        { key: 'adminRevenue', label: t.navAdminRevenue, icon: DollarSign },
        { key: 'adminPlans', label: t.navAdminPlans, icon: Package },
        // Token & hạn mức — usage đối chiếu hạn mức gói (đọc/gộp từ ai_usage + grant/reset).
        { key: 'adminUsage', label: t.navAdminUsage, icon: Gauge },
      ],
    },
    {
      label: t.admGrpAi,
      items: [
        { key: 'adminAiProviders', label: t.navAdminAiProviders, icon: KeyRound },
        { key: 'adminAiModels', label: t.navAdminAiModels, icon: RouteIcon },
        { key: 'adminAiUsage', label: t.navAdminAiUsage, icon: Coins },
      ],
    },
    {
      label: t.admGrpSystem,
      items: [
        { key: 'adminSystem', label: t.navAdminSystem, icon: Server },
        { key: 'adminLogs', label: t.navAdminLogs, icon: FileText },
        { key: 'adminApiVersions', label: t.navAdminApi, icon: Code },
      ],
    },
  ];
  // Hồ sơ / Cài đặt / Đăng xuất / Trang chủ đã chuyển lên dropdown avatar ở topbar (UserMenu
  // variant "app") — sidebar không còn khối mục đáy.
  const navGroups = isAdminArea ? adminGroups : appGroups;

  const itemBase = (active: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: isMobile ? 'auto' : '100%',
    flex: 'none',
    whiteSpace: 'nowrap',
    border: 'none',
    borderRadius: 12,
    padding: isMobile ? '9px 12px' : collapsed ? '11px 0' : '11px 13px',
    justifyContent: !isMobile && collapsed ? 'center' : 'flex-start',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    background: active ? brandGradient : 'transparent',
    color: active ? '#fff' : '#5b5670',
    boxShadow: active ? '0 12px 24px -14px rgba(139,92,246,.8)' : 'none',
  });

  const springConfig = { mass: 0.1, stiffness: 200, damping: 15 };

    const renderItem = (n: Item) => {
      // Wizard tạo nội dung (/create/new) vẫn highlight mục "Tạo nội dung".
      const active = route === n.key || (n.key === 'create' && route === 'createWizard');
      return (
        <motion.button
          key={n.key}
          onClick={() => {
            go(n.key);
            if (isMobile && setMobileMenuOpen) setMobileMenuOpen(false);
          }}
          title={collapsed ? n.label : undefined}
          style={itemBase(active)}
          whileHover={{
            y: isMobile ? 0 : -2,
            x: isMobile ? 0 : (collapsed ? 0 : 3),
            scale: isMobile ? 1 : 1.03,
            boxShadow: active
              ? '0 12px 24px -10px rgba(139,92,246,.95)'
              : '0 8px 16px -8px rgba(124,92,255,.25)',
            background: active ? brandGradient : '#f6f3fc',
          }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', ...springConfig }}
        >
          <Icon icon={n.icon} stroke={active ? '#fff' : '#9b94b5'} />
          {(!collapsed || isMobile) && <span style={{ flex: 1, textAlign: 'left' }}>{n.label}</span>}
          {(!collapsed || isMobile) && n.badge && <span style={{ background: brandGradient, color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>{n.badge}</span>}
        </motion.button>
      );
    };

  // Nút chuyển sang khu vực Quản trị (chỉ ở app mode + ADMIN).
  const adminPortalBtn = (
    <motion.button
      onClick={() => {
        go('admin');
        if (isMobile && setMobileMenuOpen) setMobileMenuOpen(false);
      }}
      title={collapsed ? t.navAdmin : undefined}
      style={{ ...itemBase(false), background: '#f4ecff', color: '#6d28d9', border: '1px solid #e7d9fb' }}
      whileHover={{
        y: isMobile ? 0 : -2,
        x: isMobile ? 0 : (collapsed ? 0 : 3),
        scale: isMobile ? 1 : 1.03,
        boxShadow: '0 8px 16px -8px rgba(124,92,255,.25)',
        background: '#efe4ff',
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', ...springConfig }}
    >
      <Icon icon={ICON.admin} stroke="#7c3aed" />
      {(!collapsed || isMobile) && <span style={{ flex: 1, textAlign: 'left' }}>{t.navAdmin}</span>}
      {(!collapsed || isMobile) && <Icon icon={ChevronRight} size={16} stroke="#7c3aed" />}
    </motion.button>
  );

  // Nút quay lại ứng dụng (chỉ ở admin mode).
  const backBtn = (
    <motion.button
      onClick={() => {
        go('dashboard');
        if (isMobile && setMobileMenuOpen) setMobileMenuOpen(false);
      }}
      title={collapsed ? t.backToApp : undefined}
      style={{ ...itemBase(false), background: '#f4f2fb', border: '1px solid #ece8f6' }}
      whileHover={{
        y: isMobile ? 0 : -2,
        x: isMobile ? 0 : (collapsed ? 0 : 3),
        scale: isMobile ? 1 : 1.03,
        boxShadow: '0 8px 16px -8px rgba(124,92,255,.2)',
        background: '#ece8f7',
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', ...springConfig }}
    >
      <Icon icon={ChevronLeft} stroke="#7c5cff" />
      {(!collapsed || isMobile) && <span style={{ flex: 1, textAlign: 'left' }}>{t.backToApp}</span>}
    </motion.button>
  );

  const sectionLabelStyle: CSSProperties ={ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#a59fbb', padding: '6px 12px', flex: 'none' };
  // Khi thu gọn, nhãn nhóm ẩn — thay bằng đường kẻ ngang mờ 24px căn giữa để vẫn
  // thấy cấu trúc nhóm (không hiện trước nhóm đầu tiên).
  const collapsedDivider: CSSProperties = { width: 24, height: 1, background: 'rgba(90,80,120,.18)', margin: '12px auto', flex: 'none', transition: 'opacity .2s ease' };

  // Nút thu gọn/mở rộng: vùng ăn click là HÌNH VUÔNG 40×40 trong suốt (button cha) —
  // hình tròn 30px chỉ là lớp hiển thị bên trong (pointerEvents none). Trước đây button
  // = chính hình tròn 30px: hit-test theo border-radius nên click sát rìa bị trượt.
  const floatBtn: CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    right: -20,
    width: 40,
    height: 40,
    padding: 0,
    border: 'none',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 5,
  };
  const floatBtnInner: CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: '1px solid #ece8f6',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#7c5cff',
    boxShadow: '0 6px 16px -6px rgba(124,92,255,.55)',
    pointerEvents: 'none', // mọi click trong vùng 40×40 đều tính cho button cha
  };
  const arrowTitle = autoCollapse ? t.sbPin : collapsed ? t.sbExpand : t.sbCollapse;

  // ----- Thân (desktop): cuộn dọc khi cao quá khung -----
  // Nút "Quay lại ứng dụng" nằm NGOÀI vùng cuộn (.sb-scroll có overflow hidden/auto sẽ
  // cắt mất phần trên khi hover translateY(-2px) — UI refactor mục 4); chừa paddingTop
  // cho hiệu ứng hover + shadow hiển thị đủ 4 phía.
  const desktopBody: ReactNode = (
    <>
      {/* Divider mờ + khoảng cách tách khỏi mục "Tổng quan" bên dưới; vùng cuộn chừa
          paddingTop để hover translateY(-2px) của mục đầu không bị mép cuộn cắt. */}
      {isAdminArea && (
        <div style={{ flex: 'none', padding: '4px 0 0' }}>
          {backBtn}
          <div style={{ height: 1, background: '#eee9f6', margin: '10px 4px 4px' }} aria-hidden />
        </div>
      )}
      <div className="sb-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 8 }}>
      {navGroups.map((g, gi) => (
        <nav key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 'none', marginTop: gi === 0 ? 0 : collapsed ? 0 : 12 }}>
          {!collapsed && g.label && <div style={sectionLabelStyle}>{g.label}</div>}
          {collapsed && gi > 0 && <div style={collapsedDivider} aria-hidden />}
          {g.items.map(renderItem)}
        </nav>
      ))}

      <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 'none' }}>
        {/* Mục Quản trị hệ thống ghim ở đáy, tách khỏi các cụm trên bằng divider (mục 3). */}
        {!isAdminArea && isAdmin && (
          <>
            <div style={{ height: 1, background: '#eee9f6', flex: 'none' }} />
            {adminPortalBtn}
          </>
        )}
        {/* Widget token: click nhảy thẳng vào tab "Token & mức dùng" trong Cài đặt (mục 7). */}
        {!isAdminArea && !collapsed && usage && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => go('usage')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('usage'); } }}
            title={t.navUsage}
            style={{ background: '#f8f6fd', border: '1px solid #eee9f6', borderRadius: 16, padding: '12px 14px', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: '#7d6aa3', whiteSpace: 'nowrap' }}>{t.usageTitle}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#5b5670', whiteSpace: 'nowrap' }}>
                {fmtTokens(usage.used)} / {usage.limit === null ? '∞' : fmtTokens(usage.limit)}
              </span>
            </div>
            {usage.limit !== null ? (
              <div style={{ height: 6, borderRadius: 999, background: '#ece6f8', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${usagePct}%`, borderRadius: 999, background: usageFill, transition: 'width .4s ease' }} />
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#a59fbb' }}>{t.usageUnlimited}</div>
            )}
          </div>
        )}
        {!isAdminArea && !collapsed && showUpgradeCard && (
          <div style={{ position: 'relative', background: 'linear-gradient(150deg,#f6f2ff,#fcf1fc)', border: '1px solid #efe6fb', borderRadius: 16, padding: 16 }}>
            <button
              onClick={dismissUpgrade}
              title={t.close}
              aria-label={t.close}
              style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: '#a58fd0' }}
            >
              <X size={14} strokeWidth={2.2} />
            </button>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#5b2b9e' }}>{t.upgradeTitle}</div>
            <div style={{ fontSize: 12, color: '#7d6aa3', margin: '4px 0 12px', lineHeight: 1.45 }}>{t.upgradeMsg}</div>
            <button onClick={() => go('pricing')} style={{ width: '100%', border: 'none', borderRadius: 10, padding: 9, fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.upgradeBtn}</button>
          </div>
        )}
      </div>
      </div>
    </>
  );

  // ----- Thân (mobile): xổ xuống dọc -----
  const mobileDropdown: ReactNode = (
    <nav style={{
      position: 'fixed',
      top: 62,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#fff',
      zIndex: 50,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      overflowY: 'auto'
    }}>
      {isAdminArea && backBtn}
      {navGroups.map((g, gi) => (
        <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {g.label && <div style={sectionLabelStyle}>{g.label}</div>}
          {g.items.map(renderItem)}
        </div>
      ))}
      {!isAdminArea && isAdmin && adminPortalBtn}
    </nav>
  );

  if (isMobile) {
    if (!mobileMenuOpen) return null;
    return mobileDropdown;
  }

  return (
    <aside
      onMouseEnter={autoCollapse ? () => setHover(true) : undefined}
      onMouseLeave={autoCollapse ? () => setHover(false) : undefined}
      style={{
        width: isMobile ? '100%' : collapsed ? 76 : 260,
        flex: 'none',
        background: '#fff',
        borderRight: isMobile ? 'none' : '1px solid #eee9f6',
        borderBottom: isMobile ? '1px solid #eee9f6' : 'none',
        // Padding dồn vào khối thân — header logo cần chạm mép để border-bottom
        // của nó nằm CÙNG đường ngang với border-bottom của Topbar (UI refactor mục 2).
        padding: isMobile ? '10px 12px' : 0,
        display: 'flex',
        flexDirection: isMobile ? 'row' : 'column',
        alignItems: isMobile ? 'center' : 'stretch',
        gap: isMobile ? 6 : undefined,
        overflowX: isMobile ? 'auto' : 'visible',
        overflowY: 'visible',
        position: isMobile ? 'static' : 'sticky',
        top: 0,
        height: isMobile ? 'auto' : '100vh',
        transition: 'width .2s ease, padding .2s ease',
        // sticky tự tạo stacking context với z-index auto → nửa nút thu gọn thò ra
        // ngoài aside bị Topbar (z-40) / phần tử positioned bên cột nội dung đè lên,
        // click không ăn. Nâng lên trên Topbar; aside không chồng nội dung chỗ khác.
        zIndex: isMobile ? undefined : 41,
      }}
    >
      {/* Logo: chuyển mượt giữa bố cục NGANG (mở: icon trái + chữ phải) và
          DỌC (đóng: icon trên + chữ dưới). Hai ảnh xếp chồng, crossfade opacity
          + scale nhẹ để chữ "AIMA" như trượt về đúng vị trí, không cut cứng.
          Khối header cao CỐ ĐỊNH 70px = chiều cao Topbar, căn giữa dọc, border-bottom
          trùng đường kẻ Topbar — đúng ở cả trạng thái mở rộng lẫn thu gọn (mục 2). */}
      <div style={{ height: isMobile ? 'auto' : 70, display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'center', padding: isMobile ? '0 6px 0 0' : 0, borderBottom: isMobile ? 'none' : '1px solid #eee9f6', flex: 'none' }}>
        <button
          onClick={() => go('landing')}
          title={t.nHome}
          aria-label={t.nHome}
          style={{
            position: 'relative',
            display: 'block',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            width: !isMobile && collapsed ? 52 : 156,
            height: !isMobile && collapsed ? 46 : 46,
            transition: 'width .3s cubic-bezier(.4,0,.2,1), height .3s cubic-bezier(.4,0,.2,1)',
          }}
        >
          {/* Ngang — hiển thị khi sidebar MỞ */}
          <img
            src="/aima-h.png"
            alt="AIMA"
            aria-hidden={!isMobile && collapsed}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              height: 38,
              width: 'auto',
              transform: `translate(-50%,-50%) scale(${!isMobile && collapsed ? 0.85 : 1})`,
              opacity: !isMobile && collapsed ? 0 : 1,
              transition: 'opacity .28s ease, transform .3s cubic-bezier(.4,0,.2,1)',
              pointerEvents: 'none',
            }}
          />
          {/* Dọc — hiển thị khi sidebar ĐÓNG */}
          <img
            src="/aima-v.png"
            alt="AIMA"
            aria-hidden={isMobile || !collapsed}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              height: 42,
              width: 'auto',
              transform: `translate(-50%,-50%) scale(${!isMobile && collapsed ? 1 : 0.85})`,
              opacity: !isMobile && collapsed ? 1 : 0,
              transition: 'opacity .28s ease, transform .3s cubic-bezier(.4,0,.2,1)',
              pointerEvents: 'none',
            }}
          />
        </button>
      </div>

      {/* Nút thu gọn/mở rộng (desktop) */}
      {!isMobile && (
        <button onClick={onArrow} title={arrowTitle} aria-label={arrowTitle} style={floatBtn}>
          <span style={floatBtnInner}>
            {collapsed ? <ChevronRight size={16} strokeWidth={2.2} /> : <ChevronLeft size={16} strokeWidth={2.2} />}
          </span>
        </button>
      )}

      {/* Thân sidebar tự đệm (aside padding 0 để header logo chạm mép). */}
      {!isMobile && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: collapsed ? '14px 12px 22px' : '14px 16px 22px', transition: 'padding .2s ease' }}>
          {desktopBody}
        </div>
      )}
    </aside>
  );
}
