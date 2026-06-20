import { useState, type CSSProperties } from 'react';
import { useApp } from '../context/AppContext';
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

export default function Sidebar() {
  const { t, route, go, brandGradient, logout } = useApp();
  const { isMobile } = useBreakpoint();
  const { sidebarCollapsed, toggleSidebar, autoCollapse, toggleAutoCollapse, setSidebarCollapsed } = useUiStore();
  const [hover, setHover] = useState(false);

  // Desktop thu gọn: ở chế độ auto thì thu gọn trừ khi đang hover; ngược lại
  // theo trạng thái ghim thủ công (nút mũi tên). Mobile không bao giờ thu gọn.
  const collapsed = !isMobile && (autoCollapse ? !hover : sidebarCollapsed);

  // Nút mũi tên: ở chế độ auto → ghim mở cố định (tắt auto, mở hẳn);
  // ở chế độ thường → đóng/mở thủ công.
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
    { key: 'admin', label: t.navAdmin, icon: ICON.admin },
  ];
  // Hồ sơ + Cài đặt dồn xuống cụm dưới (đọc từ dưới lên: Cài đặt, Hồ sơ, Nâng cấp Pro).
  const bottomItems: Item[] = [
    { key: 'profile', label: t.navProfile, icon: ICON.profile },
    { key: 'settings', label: t.navSettings, icon: ICON.settings },
  ];

  const renderItem = (n: Item) => {
    const active = route === n.key;
    return (
      <button
        key={n.key}
        onClick={() => go(n.key)}
        title={collapsed ? n.label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: isMobile ? 'auto' : '100%',
          whiteSpace: 'nowrap',
          border: 'none',
          borderRadius: 12,
          padding: isMobile ? '9px 12px' : collapsed ? '11px 0' : '11px 13px',
          justifyContent: !isMobile && collapsed ? 'center' : 'flex-start',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background .15s',
          textAlign: 'left',
          background: active ? brandGradient : 'transparent',
          color: active ? '#fff' : '#5b5670',
          boxShadow: active ? '0 12px 24px -14px rgba(139,92,246,.8)' : 'none',
        }}
      >
        <Icon path={n.icon} stroke={active ? '#fff' : '#9b94b5'} />
        {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{n.label}</span>}
        {!collapsed && n.badge && <span style={{ background: brandGradient, color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>{n.badge}</span>}
      </button>
    );
  };

  const floatBtn: CSSProperties = {
    position: 'absolute',
    top: 78,
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
        position: isMobile ? 'static' : 'sticky',
        top: 0,
        height: isMobile ? 'auto' : '100vh',
        transition: 'width .2s ease, padding .2s ease',
      }}
    >
      {/* Hàng trên: logo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : collapsed ? 'center' : 'flex-start', gap: 10, padding: isMobile ? '0 6px 0 0' : '4px 4px 18px', flex: 'none' }}>
        <button
          onClick={() => go('landing')}
          title={t.nHome}
          aria-label={t.nHome}
          style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <img src="/aima-logo.png" alt="AIMA" style={{ height: 38, width: 'auto' }} />
        </button>
      </div>

      {/* Nút tròn nổi đè lên viền phân cách: thu gọn/mở rộng sidebar */}
      {!isMobile && (
        <button onClick={onArrow} title={arrowTitle} aria-label={arrowTitle} style={floatBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
          </svg>
        </button>
      )}

      {!isMobile && !collapsed && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#a59fbb', padding: '6px 12px' }}>{t.secMain}</div>}

      <nav style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? 6 : 3, flex: 'none' }}>
        {(isMobile ? [...mainItems, ...bottomItems] : mainItems).map(renderItem)}
      </nav>

      {/* Cụm dưới (desktop): Nâng cấp Pro → Hồ sơ → Cài đặt */}
      {!isMobile && (
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!collapsed && (
            <div style={{ background: 'linear-gradient(150deg,#f6f2ff,#fcf1fc)', border: '1px solid #efe6fb', borderRadius: 16, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#5b2b9e' }}>{t.upgradeTitle}</div>
              <div style={{ fontSize: 12, color: '#7d6aa3', margin: '4px 0 12px', lineHeight: 1.45 }}>{t.upgradeMsg}</div>
              <button style={{ width: '100%', border: 'none', borderRadius: 10, padding: 9, fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.upgradeBtn}</button>
            </div>
          )}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {bottomItems.map(renderItem)}
            <button
              onClick={logout}
              title={collapsed ? t.signOut : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                whiteSpace: 'nowrap',
                border: 'none',
                borderRadius: 12,
                padding: collapsed ? '11px 0' : '11px 13px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background .15s',
                textAlign: 'left',
                background: 'transparent',
                color: '#d6336c',
              }}
            >
              <Icon path={ICON.logout} stroke="#e25c84" />
              {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{t.signOut}</span>}
            </button>
          </nav>
        </div>
      )}
    </aside>
  );
}
