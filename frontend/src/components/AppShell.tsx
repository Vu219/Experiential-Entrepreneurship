import { useState, type ReactNode } from 'react';
import { Globe, Search, Menu, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUiStore } from '../store/useUiStore';
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
  // Ô tìm kiếm co giãn theo trạng thái sidebar: sidebar MỞ → gọn lại (440px) vì hàng
  // ngang còn ít chỗ; sidebar thu gọn (hoặc chế độ auto-collapse) → nở ra hấp thụ
  // phần chiều rộng dôi (600px). transition max-width lo phần chuyển mượt.
  const { sidebarCollapsed, autoCollapse } = useUiStore();
  const sidebarOpen = !sidebarCollapsed && !autoCollapse;

  return (
    <header
      style={{
        height: isMobile ? 62 : 70,
        flex: 'none',
        background: 'rgba(255,255,255,.86)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #eee9f6',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* 3 khối độc lập khi sidebar đóng/mở: [tiêu đề] bám sát sidebar (khối duy nhất
          dịch theo sidebar) · [ô tìm kiếm] flex:1 hấp thụ toàn bộ chiều rộng dôi ra
          (max 600px) · [cụm phải] neo cố định mép phải, không dịch chuyển. */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 8 : 18,
          padding: '0 var(--page-pad-x)',
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
        <div style={{ flex: 1, minWidth: 140, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f4f2fb', border: '1px solid #ece8f6', borderRadius: 12, padding: '9px 14px', flex: 1, maxWidth: sidebarOpen ? 440 : 600, transition: 'max-width .2s ease' }}>
            <Search size={17} color="#a39bbf" strokeWidth={1.8} />
            <input placeholder={t.searchPh} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#241f3a', minWidth: 0 }} />
          </div>
        </div>
      )}
      {isMobile && <div style={{ flex: 1 }} />}
      {/* Cụm phải: flex none + bám mép phải — bất biến khi sidebar đổi trạng thái. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 18, flex: 'none', marginLeft: 'auto' }}>
        {!isMobile && <LangButton compact />}
        <NotificationBell />
        {/* Dropdown avatar (tái dùng UserMenu của landing): Trang chủ / Hồ sơ / Cài đặt / Đăng xuất.
            Dòng phụ hiển thị GÓI THẬT của user (Free/Plus/Pro) — không hardcode. */}
        <div style={{ paddingLeft: 6, borderLeft: '1px solid #eee9f6' }}>
          <UserMenu variant="app" />
        </div>
      </div>
      </div>
    </header>
  );
}

const PAGE_KEYS = {
  dashboard: ['navDashboard', 'pageSubDashboard'],
  create: ['navCreate', 'pageSubCreate'],
  createWizard: ['cwTitle', 'cwSub'],
  calendar: ['navCalendar', 'pageSubCalendar'],
  failedPosts: ['navFailedPosts', 'fpSub'],
  analytics: ['navAnalytics', 'pageSubAnalytics'],
  trends: ['navTrends', 'pageSubTrends'],
  brand: ['navBrand', 'pageSubBrand'],
  profile: ['navProfile', 'pageSubProfile'],
  settings: ['navSettings', 'pageSubSettings'],
  // /settings/usage — tab trong Cài đặt nên heading dùng chung với Cài đặt.
  usage: ['navSettings', 'pageSubSettings'],
  admin: ['navAdminOverview', 'pageSubAdmin'],
  adminUsers: ['navAdminUsers', 'pageSubAdminUsers'],
  adminPosts: ['navAdminPosts', 'pageSubAdminPosts'],
  adminSystem: ['navAdminSystem', 'pageSubAdminSystem'],
  adminLogs: ['navAdminLogs', 'pageSubAdminLogs'],
  adminApiVersions: ['navAdminApi', 'pageSubAdminApi'],
  adminRevenue: ['navAdminRevenue', 'pageSubAdminRevenue'],
  adminPlans: ['navAdminPlans', 'pageSubAdminPlans'],
  adminUsage: ['navAdminUsage', 'pageSubAdminUsage'],
  adminAiProviders: ['navAdminAiProviders', 'pageSubAdminAiProviders'],
  adminAiModels: ['navAdminAiModels', 'pageSubAdminAiModels'],
  adminAiUsage: ['navAdminAiUsage', 'pageSubAdminAiUsage'],
} as const;

function PageHeading() {
  const { t, route } = useApp();
  // Heading động do trang chi tiết set (vd /admin/usage/users/:id = tên user + email)
  // — ưu tiên hơn PAGE_KEYS tĩnh theo route.
  const override = useUiStore((s) => s.pageHeading);
  const keys = PAGE_KEYS[route as keyof typeof PAGE_KEYS];
  const title = override ? override.title : keys ? t[keys[0]] : null;
  const sub = override ? override.sub : keys ? t[keys[1]] : null;
  if (!title) return null;
  // flex none + nowrap: tiêu đề bám sát sidebar, không nhảy dòng/đổi cỡ chữ khi
  // sidebar đóng/mở (khối duy nhất được phép dịch theo sidebar).
  return (
    <div style={{ flex: 'none', whiteSpace: 'nowrap', maxWidth: 380, overflow: 'hidden' }}>
      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 19, color: '#211c38', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      {sub && <div style={{ fontSize: 12.5, color: '#8a85a0', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
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
        {/* Padding vùng nội dung do .page-shell (PageContainer) đảm nhiệm — main không đệm riêng. */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          {isMobile && <div style={{ padding: 'var(--page-pad-t) var(--page-pad-x) 0' }}><PageHeading /></div>}
          {children}
        </main>
      </div>
    </div>
  );
}
