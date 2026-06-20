import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
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
  const { t, route, go, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();

  const items: Item[] = [
    { key: 'dashboard', label: t.navDashboard, icon: ICON.dashboard },
    { key: 'create', label: t.navCreate, icon: ICON.create },
    { key: 'calendar', label: t.navCalendar, icon: ICON.calendar, badge: '3' },
    { key: 'analytics', label: t.navAnalytics, icon: ICON.analytics },
    { key: 'trends', label: t.navTrends, icon: ICON.trends },
    { key: 'brand', label: t.navBrand, icon: ICON.brand },
    { key: 'profile', label: t.navProfile, icon: ICON.profile },
    { key: 'settings', label: t.navSettings, icon: ICON.settings },
    { key: 'admin', label: t.navAdmin, icon: ICON.admin },
  ];

  return (
    <aside
      style={{
        width: isMobile ? '100%' : 260,
        flex: 'none',
        background: '#fff',
        borderRight: isMobile ? 'none' : '1px solid #eee9f6',
        borderBottom: isMobile ? '1px solid #eee9f6' : 'none',
        padding: isMobile ? '10px 12px' : '22px 16px',
        display: 'flex',
        flexDirection: isMobile ? 'row' : 'column',
        alignItems: isMobile ? 'center' : 'stretch',
        gap: isMobile ? 6 : undefined,
        overflowX: isMobile ? 'auto' : 'visible',
        position: isMobile ? 'static' : 'sticky',
        top: 0,
        height: isMobile ? 'auto' : '100vh',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isMobile ? '0 6px 0 0' : '4px 8px 18px', flex: 'none' }}>
        <img src="/aima-logo.png" alt="AIMA" style={{ height: 38, width: 'auto' }} />
      </div>

      {!isMobile && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#a59fbb', padding: '6px 12px' }}>{t.secMain}</div>}

      <nav style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? 6 : 3, flex: 'none' }}>
        {items.map((n) => {
          const active = route === n.key;
          return (
            <button
              key={n.key}
              onClick={() => go(n.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: isMobile ? 'auto' : '100%',
                whiteSpace: 'nowrap',
                border: 'none',
                borderRadius: 12,
                padding: isMobile ? '9px 12px' : '11px 13px',
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
              {active ? <Icon path={n.icon} stroke="#fff" /> : <Icon path={n.icon} stroke="#9b94b5" />}
              <span style={{ flex: 1, textAlign: 'left' }}>{n.label}</span>
              {n.badge && <span style={{ background: brandGradient, color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>{n.badge}</span>}
            </button>
          );
        })}
      </nav>

      {!isMobile && (
        <div style={{ marginTop: 'auto', background: 'linear-gradient(150deg,#f6f2ff,#fcf1fc)', border: '1px solid #efe6fb', borderRadius: 16, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#5b2b9e' }}>{t.upgradeTitle}</div>
          <div style={{ fontSize: 12, color: '#7d6aa3', margin: '4px 0 12px', lineHeight: 1.45 }}>{t.upgradeMsg}</div>
          <button style={{ width: '100%', border: 'none', borderRadius: 10, padding: 9, fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.upgradeBtn}</button>
        </div>
      )}
    </aside>
  );
}
