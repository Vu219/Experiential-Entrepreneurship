import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useUiStore } from '../store/useUiStore';
import { Card, PlatformTag, Loader } from '../components/ui';
import { notifLabels, themeOptions } from '../data';
import { PLATFORMS, PLATFORM_BG } from '../theme';
import {
  listConnections,
  getConnectionStats,
  getAuthorizationUrl,
  validateConnection,
  refreshConnection,
  disconnectConnection,
  PLATFORM_TO_TAG,
  TAG_TO_PLATFORM,
  type PlatformConnection,
  type ConnectionStats,
  type PlatformEnum,
  type ConnectionStatus,
} from '../api/connections';

type SettingsTab = 'appearance' | 'notifications' | 'connections';

// ——— Status badge color map ———
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: '#dcfce7', color: '#16a34a' },
  CONNECTED: { bg: '#dcfce7', color: '#16a34a' },
  EXPIRED: { bg: '#ffedd5', color: '#c2410c' },
  DISCONNECTED: { bg: '#f3f4f6', color: '#6b7280' },
  ERROR: { bg: '#fee2e2', color: '#dc2626' },
  REVOKED: { bg: '#fee2e2', color: '#dc2626' },
  PENDING: { bg: '#fef3c7', color: '#d97706' },
  ON_HOLD: { bg: '#fef3c7', color: '#d97706' },
};

// ——— Filter option values ———
type StatusFilter = 'ALL' | 'ACTIVE' | 'EXPIRED' | 'ERROR' | 'DISCONNECTED';

/** Map BE ConnectionStatus → a simplified filter bucket */
const toFilterBucket = (s: ConnectionStatus): StatusFilter => {
  if (s === 'ACTIVE' || s === 'CONNECTED') return 'ACTIVE';
  if (s === 'EXPIRED' || s === 'ON_HOLD') return 'EXPIRED';
  if (s === 'ERROR' || s === 'REVOKED') return 'ERROR';
  if (s === 'DISCONNECTED') return 'DISCONNECTED';
  return 'ACTIVE';
};

export default function Settings() {
  const { t, lang, setLang, theme, setTheme, notif, toggleNotif, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const { autoCollapse, toggleAutoCollapse } = useUiStore();
  const notifs = notifLabels(lang);
  const themes = themeOptions(lang);
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-select tab from query param (OAuth callback redirect)
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState<SettingsTab>(
    tabParam === 'connections' ? 'connections' : 'appearance',
  );

  // ——— Helpers ———
  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'appearance', label: t.seTabAppearance },
    { key: 'notifications', label: t.seTabNotif },
    { key: 'connections', label: t.seTabConnect },
  ];

  const langBtn = (active: boolean): CSSProperties => ({
    flex: 1,
    border: `1.5px solid ${active ? '#8b5cf6' : '#ece8f6'}`,
    borderRadius: 11,
    padding: 11,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    background: active ? '#faf6ff' : '#fff',
    color: active ? '#7c3aed' : '#3f3a55',
  });

  const toggleStyle = (on: boolean): CSSProperties => ({
    width: 42,
    height: 24,
    borderRadius: 99,
    flex: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 3px',
    cursor: 'pointer',
    transition: 'background .15s',
    background: on ? brandGradient : '#dcd7ea',
    justifyContent: on ? 'flex-end' : 'flex-start',
  });

  const dot: CSSProperties = { width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' };

  // ——————————————————————————————————————————————
  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ——— Tab bar ——— */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1.5px solid #efeaf8' }}>
        {tabs.map((tb) => {
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              style={{
                border: 'none',
                background: 'none',
                padding: '12px 24px',
                fontSize: 14.5,
                fontWeight: active ? 700 : 500,
                color: active ? '#7c3aed' : '#8a85a0',
                cursor: 'pointer',
                position: 'relative',
                transition: 'color .15s',
              }}
            >
              {tb.label}
              {active && (
                <span style={{
                  position: 'absolute', bottom: -1.5, left: 0, right: 0, height: 3,
                  borderRadius: 3, background: brandGradient,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ——— Tab: Appearance ——— */}
      {tab === 'appearance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Language & Theme side-by-side */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: 'stretch' }}>
            {/* Language */}
            <Card style={{ flex: 1, padding: 26, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 16 }}>{t.seLang}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setLang('vi')} style={langBtn(lang === 'vi')}>🇻🇳 Tiếng Việt</button>
                <button onClick={() => setLang('en')} style={langBtn(lang === 'en')}>🇬🇧 English</button>
              </div>
            </Card>

            {/* Theme */}
            <Card style={{ flex: 1.5, padding: 26 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 4 }}>{t.seTheme}</div>
              <div style={{ fontSize: 12, color: '#8a85a0', marginBottom: 14 }}>{t.seThemeSub}</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {themes.map((th) => {
                  const active = theme === th.key;
                  return (
                    <div key={th.key} onClick={() => setTheme(th.key)} style={{ flex: 1, border: `2px solid ${active ? '#8b5cf6' : '#ece8f6'}`, borderRadius: 13, padding: 10, cursor: 'pointer', background: active ? '#faf6ff' : '#fff' }}>
                      <span style={{ display: 'block', height: 38, borderRadius: 9, background: th.grad }} />
                      <span style={{ display: 'block', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#3f3a55', marginTop: 8 }}>{th.label}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <Card style={{ padding: 26 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 16 }}>{t.seSidebar}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, color: '#3f3a55', fontWeight: 600 }}>{t.seSidebarAuto}</div>
                <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 2, lineHeight: 1.45 }}>{t.seSidebarAutoSub}</div>
              </div>
              <span onClick={toggleAutoCollapse} role="switch" aria-checked={autoCollapse} style={toggleStyle(autoCollapse)}>
                <span style={dot} />
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* ——— Tab: Notifications ——— */}
      {tab === 'notifications' && (
        <Card style={{ padding: 26 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 16 }}>{t.seNotif}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {notifs.map((label, i) => {
              const on = notif[i];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 13.5, color: '#3f3a55', flex: 1 }}>{label}</span>
                  <span onClick={() => toggleNotif(i)} style={toggleStyle(on)}>
                    <span style={dot} />
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ——— Tab: Connections ——— */}
      {tab === 'connections' && (
        <ConnectionsTab
          t={t}
          lang={lang}
          isMobile={isMobile}
          brandGradient={brandGradient}
          searchParams={searchParams}
          setSearchParams={setSearchParams}
        />
      )}
    </div>
  );
}

// ================================================================
// Connections Tab — uses real APIs from api/connections.ts
// ================================================================

interface ConnTabProps {
  t: Record<string, string>;
  lang: string;
  isMobile: boolean;
  brandGradient: string;
  searchParams: URLSearchParams;
  setSearchParams: ReturnType<typeof useSearchParams>[1];
}

function ConnectionsTab({ t, lang, isMobile, brandGradient, searchParams, setSearchParams }: ConnTabProps) {
  // ——— State ———
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [stats, setStats] = useState<ConnectionStats>({ total: 0, active: 0, expired: 0, error: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ——— Fetch data ———
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [conns, st] = await Promise.all([listConnections(), getConnectionStats()]);
      setConnections(conns);
      setStats(st);
    } catch {
      // Nếu chưa có kết nối nào, API trả list rỗng — vẫn render bình thường
      setConnections([]);
      setStats({ total: 0, active: 0, expired: 0, error: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ——— Read OAuth callback query params (one-time) ———
  useEffect(() => {
    const status = searchParams.get('status');
    const error = searchParams.get('error');
    if (status === 'success') {
      setToast({ type: 'success', msg: lang === 'en' ? 'Account connected successfully!' : 'Kết nối tài khoản thành công!' });
      // Clean URL
      setSearchParams({ tab: 'connections' }, { replace: true });
    } else if (error) {
      setToast({ type: 'error', msg: lang === 'en' ? 'Connection failed. Please try again.' : 'Kết nối thất bại. Vui lòng thử lại.' });
      setSearchParams({ tab: 'connections' }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ——— Actions ———
  const handleConnect = async (platform: PlatformEnum) => {
    const tag = PLATFORM_TO_TAG[platform];
    setConnectingPlatform(tag);
    try {
      const { authorizationUrl } = await getAuthorizationUrl(platform);
      window.location.href = authorizationUrl;
    } catch {
      setToast({ type: 'error', msg: lang === 'en' ? 'Could not start connection. Please try again.' : 'Không thể bắt đầu kết nối. Vui lòng thử lại.' });
      setConnectingPlatform(null);
    }
  };

  const handleValidate = async (id: string) => {
    setActionLoading((p) => ({ ...p, [id]: true }));
    try {
      const updated = await validateConnection(id);
      setConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setToast({ type: 'success', msg: lang === 'en' ? 'Connection verified.' : 'Đã kiểm tra kết nối.' });
    } catch {
      setToast({ type: 'error', msg: lang === 'en' ? 'Verification failed.' : 'Kiểm tra thất bại.' });
    } finally {
      setActionLoading((p) => ({ ...p, [id]: false }));
    }
  };

  const handleRefresh = async (id: string) => {
    setActionLoading((p) => ({ ...p, [id]: true }));
    try {
      const updated = await refreshConnection(id);
      setConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setToast({ type: 'success', msg: lang === 'en' ? 'Token refreshed.' : 'Đã làm mới token.' });
    } catch {
      setToast({ type: 'error', msg: lang === 'en' ? 'Refresh failed.' : 'Làm mới thất bại.' });
    } finally {
      setActionLoading((p) => ({ ...p, [id]: false }));
    }
  };

  const handleDisconnect = async (id: string) => {
    setActionLoading((p) => ({ ...p, [id]: true }));
    try {
      await disconnectConnection(id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
      // Refresh stats
      try { const st = await getConnectionStats(); setStats(st); } catch { /* ignore */ }
      setToast({ type: 'success', msg: lang === 'en' ? 'Account disconnected.' : 'Đã ngắt kết nối.' });
    } catch {
      setToast({ type: 'error', msg: lang === 'en' ? 'Disconnect failed.' : 'Ngắt kết nối thất bại.' });
    } finally {
      setActionLoading((p) => ({ ...p, [id]: false }));
    }
  };

  const handleCheckAll = async () => {
    setLoading(true);
    try {
      // Validate all connections sequentially to avoid rate limiting
      for (const conn of connections) {
        try {
          const updated = await validateConnection(conn.id);
          setConnections((prev) => prev.map((c) => (c.id === conn.id ? updated : c)));
        } catch { /* continue */ }
      }
      const st = await getConnectionStats();
      setStats(st);
      setToast({ type: 'success', msg: lang === 'en' ? 'All connections checked.' : 'Đã kiểm tra tất cả kết nối.' });
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  // ——— Filtering & Pagination ———
  const filtered = statusFilter === 'ALL'
    ? connections
    : connections.filter((c) => toFilterBucket(c.connectionStatus) === statusFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  // ——— Status label from BE enum ———
  const statusLabel = (s: ConnectionStatus): string => {
    if (s === 'ACTIVE' || s === 'CONNECTED') return t.seStatusActive;
    if (s === 'EXPIRED' || s === 'ON_HOLD') return t.seStatusExpired;
    if (s === 'DISCONNECTED') return t.seStatusDisconnected;
    if (s === 'ERROR' || s === 'REVOKED') return t.seStatusError;
    if (s === 'PENDING') return t.processing;
    return s;
  };

  // ——— Account sub-label (Page vs Account) ———
  const accountSubLabel = (c: PlatformConnection): string => {
    if (c.accountType === 'PAGE') return t.seTypePage;
    return t.seTypeAccount;
  };

  // ——— Token display ———
  const tokenInfo = (c: PlatformConnection) => {
    if (c.connectionStatus === 'DISCONNECTED' || c.connectionStatus === 'PENDING') {
      return { valid: null, label: '—', sub: '' };
    }
    if (c.tokenDaysRemaining !== null && c.tokenDaysRemaining !== undefined) {
      if (c.tokenDaysRemaining > 0) {
        const sub = t.seDaysLeft.replace('{n}', String(c.tokenDaysRemaining));
        return { valid: true, label: t.seTokenValid, sub };
      }
      const sub = t.seExpiredAgo.replace('{n}', String(Math.abs(c.tokenDaysRemaining)));
      return { valid: false, label: t.seTokenExpired, sub };
    }
    // Page tokens never expire
    if (c.tokenType === 'PAGE_TOKEN') {
      return { valid: true, label: t.seTokenValid, sub: lang === 'en' ? 'Never expires' : 'Không hết hạn' };
    }
    return { valid: null, label: '—', sub: '' };
  };

  // ——— Action type ———
  const actionType = (c: PlatformConnection): 'refresh' | 'reconnect' | 'connect' => {
    if (c.connectionStatus === 'ACTIVE' || c.connectionStatus === 'CONNECTED') return 'refresh';
    if (c.connectionStatus === 'EXPIRED' || c.connectionStatus === 'REVOKED' || c.connectionStatus === 'ERROR' || c.connectionStatus === 'ON_HOLD') return 'reconnect';
    return 'connect';
  };

  // ——— Platform display name ———
  const platformName = (p: PlatformEnum) => {
    if (p === 'FACEBOOK') return 'Facebook';
    if (p === 'INSTAGRAM') return 'Instagram';
    return 'Threads';
  };

  // ——— Format date ———
  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '—';
      return lang === 'en'
        ? dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : dt.toLocaleDateString('vi-VN');
    } catch { return '—'; }
  };

  // ——— Dropdown menu for row actions ———
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // ——— Render ———
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ——— Toast banner ——— */}
      {toast && (
        <div
          style={{
            padding: '10px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
            background: toast.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: toast.type === 'success' ? '#16a34a' : '#dc2626',
            border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            animation: 'fadeIn .25s ease-out',
          }}
        >
          <span style={{ fontSize: 16 }}>{toast.type === 'success' ? '✓' : '✕'}</span>
          <span style={{ flex: 1 }}>{toast.msg}</span>
          <button
            onClick={() => setToast(null)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', padding: 0 }}
          >×</button>
        </div>
      )}

      {/* Header section — two side-by-side cards */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: 'stretch' }}>

        {/* Left card: Kết nối tài khoản mới */}
        <Card style={{ flex: 1, padding: '18px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#211c38' }}>{t.seConnectTitle}</div>
          <div style={{ fontSize: 12, color: '#8a85a0', marginBottom: 14, marginTop: 2 }}>{t.seConnectSub}</div>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
            {PLATFORMS.map((pl) => {
              const platformEnum = TAG_TO_PLATFORM[pl.tag];
              const isConnecting = connectingPlatform === pl.tag;
              return (
                <div key={pl.tag} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  border: '1px solid #efeaf8', borderRadius: 10, padding: '12px 12px 14px',
                  background: '#fdfcff',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PlatformTag tag={pl.tag} bg={pl.bg} size={42} radius={99} />
                    <span style={{ fontWeight: 700, fontSize: 14.5, color: '#2b2543' }}>{pl.name}</span>
                    <span style={{ color: '#22d3ee', fontSize: 10, verticalAlign: 'super' }}>*</span>
                  </div>
                  <button
                    onClick={() => handleConnect(platformEnum)}
                    disabled={isConnecting}
                    style={{
                      border: '1.5px solid #ddd6f3', background: '#fff', borderRadius: 8,
                      padding: '6px 17px', fontSize: 13, fontWeight: 700, color: '#7c3aed',
                      cursor: isConnecting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                      opacity: isConnecting ? 0.6 : 1,
                    }}
                  >
                    {isConnecting ? (
                      <span>{t.processing}</span>
                    ) : (
                      <>
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.8 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.8-1.7" />
                        </svg>
                        {t.seConnect}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right card: Tổng quan kết nối */}
        <Card style={{ minWidth: isMobile ? 'auto' : 280, padding: '18px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#211c38', marginBottom: 14 }}>{t.seOverview}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatMini label={t.seTotalAccounts} value={stats.total} color="#7c3aed" bg="#f1e9ff" />
            <StatMini label={t.seActiveAccounts} value={stats.active} color="#16a34a" bg="#e8f8ee" />
            <StatMini label={t.seExpiredAccounts} value={stats.expired} color="#c2410c" bg="#ffedd5" />
            <StatMini label={t.seErrorAccounts} value={stats.error} color="#dc2626" bg="#fee2e2" />
          </div>
        </Card>
      </div>

      {/* ——— Account list table ——— */}
      <Card style={{ padding: 26 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>
            {t.seListTitle} ({filtered.length})
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCheckAll}
              disabled={loading || connections.length === 0}
              style={{
                border: '1.5px solid #ece8f6', background: '#fff', borderRadius: 10,
                padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#3f3a55',
                cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                opacity: loading ? 0.6 : 1,
              }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.5 9a9 9 0 0114.8-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15" />
              </svg>
              {t.seCheckStatus}
            </button>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
              style={{
                border: '1.5px solid #ece8f6', background: '#fff', borderRadius: 10,
                padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#3f3a55', cursor: 'pointer',
              }}
            >
              <option value="ALL">{t.seAllStatus}</option>
              <option value="ACTIVE">{t.seStatusActive}</option>
              <option value="EXPIRED">{t.seStatusExpired}</option>
              <option value="ERROR">{t.seStatusError}</option>
              <option value="DISCONNECTED">{t.seStatusDisconnected}</option>
            </select>
          </div>
        </div>

        {/* Loading state */}
        {loading && connections.length === 0 ? (
          <Loader label={t.listLoading} />
        ) : connections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#8a85a0', fontSize: 14 }}>
            {t.listEmpty}
          </div>
        ) : (
          <>
            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #efeaf8' }}>
                    {[t.seColPlatform, t.seColAccount, t.seColStatus, t.seColDate, t.seColToken, t.seColActions].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#8a85a0', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c) => {
                    const st = STATUS_STYLE[c.connectionStatus] ?? STATUS_STYLE.ACTIVE;
                    const tk = tokenInfo(c);
                    const act = actionType(c);
                    const tag = PLATFORM_TO_TAG[c.platform];
                    const bg = PLATFORM_BG[tag];
                    const isLoading = actionLoading[c.id] ?? false;

                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f5f2fa' }}>
                        {/* Platform */}
                        <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <PlatformTag tag={tag} bg={bg} size={30} radius={99} />
                            <div>
                              <div style={{ fontWeight: 600, color: '#2b2543' }}>{platformName(c.platform)}</div>
                              <div style={{ fontSize: 11, color: '#8a85a0' }}>{accountSubLabel(c)}</div>
                            </div>
                          </div>
                        </td>

                        {/* Account */}
                        <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {c.avatarUrl ? (
                              <img
                                src={c.avatarUrl}
                                alt=""
                                style={{ width: 28, height: 28, borderRadius: '50%', flex: 'none', objectFit: 'cover' }}
                              />
                            ) : (
                              <span style={{
                                width: 28, height: 28, borderRadius: '50%', flex: 'none',
                                background: 'linear-gradient(135deg,#e9f0ff,#f1e9ff)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, color: '#7c3aed',
                              }}>{(c.accountName || '?').charAt(0)}</span>
                            )}
                            <div>
                              <div style={{ fontWeight: 600, color: '#2b2543' }}>{c.accountName || '—'}</div>
                              <div style={{ fontSize: 11, color: '#8a85a0' }}>
                                {c.platformUsername ? `@${c.platformUsername}` : (c.platformAccountId || '')}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: 8,
                            fontSize: 11.5, fontWeight: 700, background: st.bg, color: st.color,
                          }}>{statusLabel(c.connectionStatus)}</span>
                        </td>

                        {/* Date */}
                        <td style={{ padding: '12px 8px', whiteSpace: 'nowrap', color: '#3f3a55', fontSize: 12.5 }}>
                          {fmtDate(c.createdAt)}
                        </td>

                        {/* Token */}
                        <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                          {tk.valid !== null ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={tk.valid ? '#16a34a' : '#dc2626'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              </svg>
                              <div>
                                <div style={{ fontWeight: 600, color: tk.valid ? '#16a34a' : '#dc2626', fontSize: 12 }}>{tk.label}</div>
                                <div style={{ fontSize: 11, color: tk.valid ? '#8a85a0' : '#c2410c' }}>{tk.sub}</div>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#8a85a0' }}>—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                            {act === 'refresh' && (
                              <>
                                <button
                                  onClick={() => handleRefresh(c.id)}
                                  disabled={isLoading}
                                  title={lang === 'en' ? 'Refresh token' : 'Làm mới token'}
                                  style={{ border: 'none', background: 'none', cursor: isLoading ? 'wait' : 'pointer', padding: 4, display: 'flex', opacity: isLoading ? 0.5 : 1 }}
                                >
                                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M23 4v6h-6M1 20v-6h6" />
                                    <path d="M3.5 9a9 9 0 0114.8-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, fontSize: 16, color: '#8a85a0', fontWeight: 700 }}
                                >⋯</button>
                                {openMenu === c.id && (
                                  <div style={{
                                    position: 'absolute', right: 0, top: '100%', zIndex: 20,
                                    background: '#fff', border: '1px solid #efeaf8', borderRadius: 10,
                                    boxShadow: '0 8px 24px rgba(0,0,0,.1)', minWidth: 150, overflow: 'hidden',
                                  }}>
                                    <button
                                      onClick={() => { handleValidate(c.id); setOpenMenu(null); }}
                                      style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '10px 14px', fontSize: 12.5, fontWeight: 600, color: '#3f3a55', cursor: 'pointer' }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = '#faf6ff'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                    >
                                      {t.seCheckStatus}
                                    </button>
                                    <button
                                      onClick={() => { handleDisconnect(c.id); setOpenMenu(null); }}
                                      style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '10px 14px', fontSize: 12.5, fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fff5f5'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                    >
                                      {lang === 'en' ? 'Disconnect' : 'Ngắt kết nối'}
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                            {act === 'reconnect' && (
                              <>
                                <button
                                  onClick={() => handleConnect(c.platform)}
                                  disabled={isLoading}
                                  style={{
                                    border: '1.5px solid #ece8f6', background: '#fff', borderRadius: 8,
                                    padding: '5px 12px', fontSize: 11.5, fontWeight: 700, color: '#c2410c',
                                    cursor: isLoading ? 'wait' : 'pointer', opacity: isLoading ? 0.5 : 1,
                                  }}
                                >{t.seReconnect}</button>
                                <button
                                  onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, fontSize: 16, color: '#8a85a0', fontWeight: 700 }}
                                >⋯</button>
                                {openMenu === c.id && (
                                  <div style={{
                                    position: 'absolute', right: 0, top: '100%', zIndex: 20,
                                    background: '#fff', border: '1px solid #efeaf8', borderRadius: 10,
                                    boxShadow: '0 8px 24px rgba(0,0,0,.1)', minWidth: 150, overflow: 'hidden',
                                  }}>
                                    <button
                                      onClick={() => { handleDisconnect(c.id); setOpenMenu(null); }}
                                      style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '10px 14px', fontSize: 12.5, fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fff5f5'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                    >
                                      {lang === 'en' ? 'Disconnect' : 'Ngắt kết nối'}
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                            {act === 'connect' && (
                              <button
                                onClick={() => handleConnect(c.platform)}
                                disabled={isLoading}
                                style={{
                                  border: 'none', borderRadius: 8,
                                  padding: '6px 14px', fontSize: 11.5, fontWeight: 700, color: '#fff',
                                  background: brandGradient, cursor: isLoading ? 'wait' : 'pointer',
                                  opacity: isLoading ? 0.5 : 1,
                                }}
                              >{t.seConnect}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#3f3a55' }}>
                {t.seShowPerPage}
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                  style={{ border: '1.5px solid #ece8f6', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                {t.sePerPage}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      width: 30, height: 30, borderRadius: 8, border: p === page ? 'none' : '1.5px solid #ece8f6',
                      background: p === page ? brandGradient : '#fff',
                      color: p === page ? '#fff' : '#3f3a55',
                      fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                    }}
                  >{p}</button>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ——— Status info section ——— */}
      <Card style={{ padding: 26 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 16 }}>{t.seInfoTitle}</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 14 }}>
          <InfoItem emoji="🟢" label={t.seStatusActive} desc={t.seInfoActive} />
          <InfoItem emoji="🟠" label={t.seStatusExpired} desc={t.seInfoExpired} />
          <InfoItem emoji="⚫" label={t.seStatusError} desc={t.seInfoError} />
          <InfoItem emoji="🛡️" label={t.seInfoCheckLabel} desc={t.seInfoCheck} />
        </div>
      </Card>
    </div>
  );
}

// ——— Small helpers ———

function StatMini({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#3f3a55', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function InfoItem({ emoji, label, desc }: { emoji: string; label: string; desc: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 14 }}>
        <span style={{ marginRight: 6 }}>{emoji}</span>
        <span style={{ fontWeight: 700, color: '#211c38' }}>{label}</span>
      </div>
      <div style={{ fontSize: 12, color: '#8a85a0', lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}
