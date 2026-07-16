import { useState, type ReactNode } from 'react';
import { Globe, Search, Menu, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';

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
  const { t, go } = useApp();
  const { isMobile } = useBreakpoint();

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
      {!isMobile && <LangButton compact />}
      <NotificationBell />
      {/* Dropdown avatar (tái dùng UserMenu của landing): Trang chủ / Hồ sơ / Cài đặt / Đăng xuất.
          Dòng phụ hiển thị GÓI THẬT của user (Free/Plus/Pro) — không hardcode. */}
      <div style={{ paddingLeft: 6, borderLeft: '1px solid #eee9f6' }}>
        <UserMenu variant="app" />
      </div>
    </header>
  );
}

const PAGE_KEYS = {
  dashboard: ['navDashboard', 'pageSubDashboard'],
  create: ['navCreate', 'pageSubCreate'],
  createWizard: ['cwTitle', 'cwSub'],
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
  adminPlans: ['navAdminPlans', 'pageSubAdminPlans'],
  adminAiProviders: ['navAdminAiProviders', 'pageSubAdminAiProviders'],
  adminAiModels: ['navAdminAiModels', 'pageSubAdminAiModels'],
  adminAiUsage: ['navAdminAiUsage', 'pageSubAdminAiUsage'],
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
