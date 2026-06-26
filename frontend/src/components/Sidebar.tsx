import { useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useAuth } from '../auth/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useUiStore } from '../store/useUiStore';
import { Icon } from './ui';
import type { Route } from '../types';
import { ICON } from '../data';

interface Item {
  key: Route;
  label: string;
  icon: string;
  badge?: string;
}

export default function Sidebar({ mode = 'app' }: { mode?: 'app' | 'admin' }) {
  const { t, route, go, brandGradient, logout } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { isMobile } = useBreakpoint();
  const { sidebarCollapsed, toggleSidebar, autoCollapse, toggleAutoCollapse, setSidebarCollapsed, profileOrigin } = useUiStore();
  const [hover, setHover] = useState(false);

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

  const mainItems: Item[] = [
    { key: 'dashboard', label: t.navDashboard, icon: ICON.dashboard },
    { key: 'create', label: t.navCreate, icon: ICON.create },
    { key: 'calendar', label: t.navCalendar, icon: ICON.calendar, badge: '3' },
    { key: 'analytics', label: t.navAnalytics, icon: ICON.analytics },
    { key: 'trends', label: t.navTrends, icon: ICON.trends },
    { key: 'brand', label: t.navBrand, icon: ICON.brand },
  ];
  const adminItems: Item[] = [
    { key: 'admin', label: t.navAdminOverview, icon: ICON.dashboard },
    { key: 'adminUsers', label: t.navAdminUsers, icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.87' },
    { key: 'adminPosts', label: t.navAdminPosts, icon: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z' },
    { key: 'adminSystem', label: t.navAdminSystem, icon: 'M4 5h16v6H4zM4 13h16v6H4zM8 8h.01M8 16h.01' },
    { key: 'adminLogs', label: t.navAdminLogs, icon: 'M5 3h11l4 4v14H5zM9 8h6M9 12h6M9 16h4' },
    { key: 'adminApiVersions', label: t.navAdminApi, icon: 'M16 18l6-6-6-6M8 6l-6 6 6 6' },
    { key: 'adminRevenue', label: t.navAdminRevenue, icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  ];
  const bottomItems: Item[] = [
    { key: 'profile', label: t.navProfile, icon: ICON.profile },
    { key: 'settings', label: t.navSettings, icon: ICON.settings },
  ];

  const navItems = isAdminArea ? adminItems : mainItems;
  const sectionLabel = isAdminArea ? t.secAdmin : t.secMain;

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
    const active = route === n.key;
    return (
      <motion.button
        key={n.key}
        onClick={() => go(n.key)}
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
        <Icon path={n.icon} stroke={active ? '#fff' : '#9b94b5'} />
        {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{n.label}</span>}
        {!collapsed && n.badge && <span style={{ background: brandGradient, color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>{n.badge}</span>}
      </motion.button>
    );
  };

  // Nút chuyển sang khu vực Quản trị (chỉ ở app mode + ADMIN).
  const adminPortalBtn = (
    <motion.button
      onClick={() => go('admin')}
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
      <Icon path={ICON.admin} stroke="#7c3aed" />
      {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{t.navAdmin}</span>}
      {!collapsed && <Icon path="M9 6l6 6-6 6" size={16} stroke="#7c3aed" />}
    </motion.button>
  );

  // Nút quay lại ứng dụng (chỉ ở admin mode).
  const backBtn = (
    <motion.button
      onClick={() => go('dashboard')}
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
      <Icon path="M15 6l-6 6 6 6" stroke="#7c5cff" />
      {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{t.backToApp}</span>}
    </motion.button>
  );

  const logoutBtn = (
    <motion.button
      onClick={logout}
      title={collapsed ? t.signOut : undefined}
      style={{ ...itemBase(false), color: '#d6336c' }}
      whileHover={{
        y: isMobile ? 0 : -2,
        x: isMobile ? 0 : (collapsed ? 0 : 3),
        scale: isMobile ? 1 : 1.03,
        boxShadow: '0 8px 16px -8px rgba(226,92,132,.2)',
        background: '#fff5f7',
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', ...springConfig }}
    >
      <Icon path={ICON.logout} stroke="#e25c84" />
      {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{t.signOut}</span>}
    </motion.button>
  );

  const sectionLabelStyle: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#a59fbb', padding: '6px 12px', flex: 'none' };

  const floatBtn: CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    right: -15,
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: '1px solid #ece8f6',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#7c5cff',
    boxShadow: '0 6px 16px -6px rgba(124,92,255,.55)',
    zIndex: 5,
  };
  const arrowTitle = autoCollapse ? t.sbPin : collapsed ? t.sbExpand : t.sbCollapse;

  // ----- Thân (desktop): cuộn dọc khi cao quá khung -----
  const desktopBody: ReactNode = (
    <div className="sb-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {isAdminArea && <div style={{ marginBottom: 8 }}>{backBtn}</div>}
      {!collapsed && <div style={sectionLabelStyle}>{sectionLabel}</div>}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 'none' }}>
        {navItems.map(renderItem)}
      </nav>

      {!isAdminArea && isAdmin && <div style={{ marginTop: 14 }}>{adminPortalBtn}</div>}

      <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 'none' }}>
        {!isAdminArea && !collapsed && (
          <div style={{ background: 'linear-gradient(150deg,#f6f2ff,#fcf1fc)', border: '1px solid #efe6fb', borderRadius: 16, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#5b2b9e' }}>{t.upgradeTitle}</div>
            <div style={{ fontSize: 12, color: '#7d6aa3', margin: '4px 0 12px', lineHeight: 1.45 }}>{t.upgradeMsg}</div>
            <button style={{ width: '100%', border: 'none', borderRadius: 10, padding: 9, fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.upgradeBtn}</button>
          </div>
        )}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {bottomItems.map(renderItem)}
          {logoutBtn}
        </nav>
      </div>
    </div>
  );

  // ----- Thân (mobile): một hàng cuộn ngang -----
  const mobileRow: ReactNode = (
    <nav style={{ display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center', flex: 'none' }}>
      {isAdminArea && backBtn}
      {navItems.map(renderItem)}
      {!isAdminArea && isAdmin && adminPortalBtn}
      {bottomItems.map(renderItem)}
      {logoutBtn}
    </nav>
  );

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
        padding: isMobile ? '10px 12px' : collapsed ? '22px 12px' : '22px 16px',
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
      }}
    >
      {/* Logo: chuyển mượt giữa bố cục NGANG (mở: icon trái + chữ phải) và
          DỌC (đóng: icon trên + chữ dưới). Hai ảnh xếp chồng, crossfade opacity
          + scale nhẹ để chữ "AIMA" như trượt về đúng vị trí, không cut cứng. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'center', padding: isMobile ? '0 6px 0 0' : collapsed ? '4px 0 16px' : '4px 4px 16px', flex: 'none' }}>
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
          </svg>
        </button>
      )}

      {isMobile ? mobileRow : desktopBody}
    </aside>
  );
}
