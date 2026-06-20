import type { ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Icon } from './ui';
import { ICON } from '../data';
import Sidebar from './Sidebar';

/** Globe / language switch button (shared between landing, auth and topbar). */
export function LangButton({ compact = false }: { compact?: boolean }) {
  const { t, toggleLang } = useApp();
  return (
    <button
      onClick={toggleLang}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: compact ? '#f4f2fb' : '#fff',
        border: '1px solid #ece8f6',
        borderRadius: compact ? 10 : 999,
        padding: compact ? '9px 12px' : '8px 14px',
        fontSize: compact ? 13 : 14,
        fontWeight: 600,
        color: '#4b4660',
        cursor: 'pointer',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth={1.7}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" strokeLinecap="round" />
      </svg>
      {t.langLabel}
    </button>
  );
}

function Topbar() {
  const { t, brandGradient, profile, go } = useApp();
  const { isMobile } = useBreakpoint();
  const initials = (profile.name || 'A U').trim().split(/\s+/).map((w) => w[0]).slice(-2).join('').toUpperCase();

  return (
    <header
      style={{
        height: isMobile ? 62 : 70,
        flex: 'none',
        background: 'rgba(255,255,255,.86)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #eee9f6',
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 8 : 18,
        padding: isMobile ? '0 14px' : '0 28px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <PageHeading />
      {!isMobile && (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f4f2fb', border: '1px solid #ece8f6', borderRadius: 12, padding: '9px 14px', width: 'min(340px,100%)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a39bbf" strokeWidth={1.8}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" /></svg>
            <input placeholder={t.searchPh} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#241f3a' }} />
          </div>
        </div>
      )}
      {isMobile && <div style={{ flex: 1 }} />}
      <LangButton compact />
      <button style={{ position: 'relative', width: 42, height: 42, borderRadius: 11, background: '#f4f2fb', border: '1px solid #ece8f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon path={ICON.bell} size={19} stroke="#5b5670" />
        <span style={{ position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: '50%', background: '#ec4899', border: '2px solid #f4f2fb' }} />
      </button>
      <div onClick={() => go('profile')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', paddingLeft: 6, borderLeft: '1px solid #eee9f6' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15 }}>{initials}</div>
        {!isMobile && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#211c38' }}>{profile.name}</div>
            <div style={{ fontSize: 11.5, color: '#8a85a0' }}>{t.userPlan}</div>
          </div>
        )}
      </div>
    </header>
  );
}

const PAGE_KEYS = {
  dashboard: ['navDashboard', 'pageSubDashboard'],
  create: ['navCreate', 'pageSubCreate'],
  calendar: ['navCalendar', 'pageSubCalendar'],
  analytics: ['navAnalytics', 'pageSubAnalytics'],
  trends: ['navTrends', 'pageSubTrends'],
  brand: ['navBrand', 'pageSubBrand'],
  profile: ['navProfile', 'pageSubProfile'],
  settings: ['navSettings', 'pageSubSettings'],
  admin: ['navAdmin', 'pageSubAdmin'],
} as const;

function PageHeading() {
  const { t, route } = useApp();
  const keys = PAGE_KEYS[route as keyof typeof PAGE_KEYS];
  if (!keys) return null;
  return (
    <div>
      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 19, color: '#211c38' }}>{t[keys[0]]}</div>
      <div style={{ fontSize: 12.5, color: '#8a85a0' }}>{t[keys[1]]}</div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { isMobile } = useBreakpoint();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: isMobile ? 'column' : 'row', background: '#f7f6fd' }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <main style={{ flex: 1, padding: isMobile ? '18px 14px' : 28, overflow: 'auto' }}>{children}</main>
      </div>
    </div>
  );
}
