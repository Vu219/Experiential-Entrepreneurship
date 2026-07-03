import { useState, type ReactNode } from 'react';
import { Globe, Search, Home, Menu, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../auth/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Icon } from './ui';
import { ICON } from '../data';
import Sidebar from './Sidebar';

/** Globe / language switch button (shared between landing, auth and topbar). */
export function LangButton({ compact = false }: { compact?: boolean }) {
  const { t, toggleLang } = useApp();
  return (
    <button
      className="btn-soft"
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
      <Globe size={16} color="#8b5cf6" strokeWidth={1.7} />
      {t.langLabel}
    </button>
  );
}

function Topbar({ mobileMenuOpen, setMobileMenuOpen }: { mobileMenuOpen?: boolean, setMobileMenuOpen?: (v: boolean) => void }) {
  const { t, brandGradient, profile, go } = useApp();
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const initials = (profile.name || 'A U').trim().split(/\s+/).map((w) => w[0]).slice(-2).join('').toUpperCase();
  const avatarUrl = user?.avatarUrl ?? null;

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
        zIndex: 40,
      }}
    >
      {isMobile && (
        <button
          onClick={() => setMobileMenuOpen?.(!mobileMenuOpen)}
          style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          {mobileMenuOpen ? <X size={24} color="#4b4660" /> : <Menu size={24} color="#4b4660" />}
        </button>
      )}

      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => go('landing')}>
          <img src="/aima-h.png" alt="AIMA" style={{ height: 24, width: 'auto' }} />
        </div>
      )}

      {!isMobile && <PageHeading />}
      {!isMobile && (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f4f2fb', border: '1px solid #ece8f6', borderRadius: 12, padding: '9px 14px', width: 'min(340px,100%)' }}>
            <Search size={17} color="#a39bbf" strokeWidth={1.8} />
            <input placeholder={t.searchPh} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#241f3a' }} />
          </div>
        </div>
      )}
      {isMobile && <div style={{ flex: 1 }} />}
      {!isMobile && (
        <button
          onClick={() => go('landing')}
          title={t.nHome}
          aria-label={t.nHome}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f4f2fb', border: '1px solid #ece8f6', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontWeight: 600, color: '#4b4660', cursor: 'pointer' }}
        >
          <Home size={16} color="#8b5cf6" strokeWidth={1.8} />
          {t.nHome}
        </button>
      )}
      {!isMobile && <LangButton compact />}
      <button style={{ position: 'relative', width: isMobile ? 38 : 42, height: isMobile ? 38 : 42, borderRadius: 11, background: '#f4f2fb', border: '1px solid #ece8f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon icon={ICON.bell} size={19} stroke="#5b5670" />
        <span style={{ position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: '50%', background: '#ec4899', border: '2px solid #f4f2fb' }} />
      </button>
      <div onClick={() => go('profile')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', paddingLeft: 6, borderLeft: '1px solid #eee9f6' }}>
        <div style={{ width: isMobile ? 36 : 40, height: isMobile ? 36 : 40, borderRadius: '50%', background: brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, overflow: 'hidden' }}>
          {avatarUrl ? <img src={avatarUrl} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
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
  admin: ['navAdminOverview', 'pageSubAdmin'],
  adminUsers: ['navAdminUsers', 'pageSubAdminUsers'],
  adminPosts: ['navAdminPosts', 'pageSubAdminPosts'],
  adminSystem: ['navAdminSystem', 'pageSubAdminSystem'],
  adminLogs: ['navAdminLogs', 'pageSubAdminLogs'],
  adminApiVersions: ['navAdminApi', 'pageSubAdminApi'],
  adminRevenue: ['navAdminRevenue', 'pageSubAdminRevenue'],
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

export default function AppShell({ children, variant = 'app' }: { children: ReactNode; variant?: 'app' | 'admin' }) {
  const { isMobile } = useBreakpoint();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="ambient-surface" style={{ minHeight: '100vh', display: 'flex', flexDirection: isMobile ? 'column' : 'row', position: 'relative' }}>
      <Sidebar mode={variant} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Topbar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
        <main style={{ flex: 1, padding: isMobile ? '18px 14px' : 28, overflow: 'auto' }}>
          {isMobile && <div style={{ marginBottom: 16 }}><PageHeading /></div>}
          {children}
        </main>
      </div>
    </div>
  );
}
