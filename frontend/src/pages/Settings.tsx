import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, ShieldCheck, ShieldUser, Link, PlugZap, Activity, ShieldAlert, Users, type LucideIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useUiStore } from '../store/useUiStore';
import { Card, PlatformTag, Loader } from '../components/ui';
import { notifLabels, themeOptions } from '../data';
import { PLATFORMS, PLATFORM_BG, PLATFORM_ACCENT } from '../theme';
import { STATUS_COLORS, STATUS_NEUTRAL, STATUS_PENDING } from '../statusTokens';
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
import { useToast } from '../components/toast/ToastProvider';

type SettingsTab = 'appearance' | 'notifications' | 'connections';

// ——— Status badge color map ———
// Dùng chung design token (statusTokens.ts) với phần "Chú thích trạng thái" bên dưới
// để badge trong bảng và chấm chú thích luôn đồng bộ màu.
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE: STATUS_COLORS.active,
  CONNECTED: STATUS_COLORS.active,
  EXPIRED: STATUS_COLORS.expired,
  ON_HOLD: STATUS_PENDING,
  ERROR: STATUS_COLORS.error,
  REVOKED: STATUS_COLORS.error,
  PENDING: STATUS_PENDING,
  DISCONNECTED: STATUS_NEUTRAL,
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
                  // Viền card đang chọn lấy màu theo theme hiện tại (var(--brand-to)) → khớp tông vừa chọn.
                  return (
                    <div key={th.key} onClick={() => setTheme(th.key)} style={{ flex: 1, border: `2px solid ${active ? 'var(--brand-to)' : '#ece8f6'}`, borderRadius: 13, padding: 10, cursor: 'pointer', background: active ? '#faf6ff' : '#fff' }}>
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
  const toast = useToast();

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
      toast.success(t.seConnOk);
      // Clean URL
      setSearchParams({ tab: 'connections' }, { replace: true });
    } else if (error) {
      toast.error(t.seConnFail);
      setSearchParams({ tab: 'connections' }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ——— Actions ———
  const handleConnect = async (platform: PlatformEnum) => {
    const tag = PLATFORM_TO_TAG[platform];
    setConnectingPlatform(tag);
    try {
      const { authorizationUrl } = await getAuthorizationUrl(platform);
      window.location.href = authorizationUrl;
    } catch {
      toast.error(t.seConnStartFail);
      setConnectingPlatform(null);
    }
  };

  const handleValidate = async (id: string) => {
    setActionLoading((p) => ({ ...p, [id]: true }));
    try {
      const updated = await validateConnection(id);
      setConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      toast.success(t.seVerified);
    } catch {
      toast.error(t.seVerifyFail);
    } finally {
      setActionLoading((p) => ({ ...p, [id]: false }));
    }
  };

  const handleRefresh = async (id: string) => {
    setActionLoading((p) => ({ ...p, [id]: true }));
    try {
      const updated = await refreshConnection(id);
      setConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      toast.success(t.seRefreshed);
    } catch {
      toast.error(t.seRefreshFail);
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
      toast.success(t.seDisconnected);
    } catch {
      toast.error(t.seDisconnectFail);
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
      toast.success(t.seCheckedAll);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  // ——— Số tài khoản đã liên kết theo từng nền tảng (từ data thật, không hardcode) ———
  // "Đã liên kết" = mọi kết nối chưa ở trạng thái DISCONNECTED.
  const linkedCounts = connections.reduce<Record<string, number>>((acc, c) => {
    if (c.connectionStatus === 'DISCONNECTED') return acc;
    const tag = PLATFORM_TO_TAG[c.platform];
    acc[tag] = (acc[tag] ?? 0) + 1;
    return acc;
  }, {});

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

  // ——— Dropdown menu for row actions (fixed portal to prevent table overflow clipping) ———
  const [openMenu, setOpenMenu] = useState<{ id: string; rect: DOMRect; act: 'refresh' | 'reconnect' } | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handleScroll = () => setOpenMenu(null);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [openMenu]);

  // ——— Render ———
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header section — two side-by-side cards */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: 'stretch' }}>

        {/* Left card: Kết nối tài khoản mới */}
        <Card style={{ flex: 1, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.seConnectTitle}</div>
              <div style={{ fontSize: 12.5, color: '#8a85a0', marginTop: 3 }}>{t.seConnectSub}</div>
            </div>
            {/* Icon button góc phải trên — kiểm tra tất cả kết nối. */}
            <button
              onClick={handleCheckAll}
              disabled={loading || connections.length === 0}
              title={t.seCheckAllConn}
              aria-label={t.seCheckAllConn}
              style={{
                flex: 'none', width: 34, height: 34, borderRadius: 10, border: 'none',
                background: STATUS_COLORS.info.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: loading || connections.length === 0 ? 'not-allowed' : 'pointer', opacity: loading || connections.length === 0 ? 0.6 : 1,
                transition: 'filter .15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(0.95)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
            >
              <PlugZap size={17} color={STATUS_COLORS.info.color} strokeWidth={2.2} />
            </button>
          </div>
          {/* 3 card nền tảng: desktop 3/hàng, tablet hẹp 2/hàng, mobile 1/hàng. */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            {PLATFORMS.map((pl) => (
              <PlatformConnectCard
                key={pl.tag}
                tag={pl.tag}
                name={pl.name}
                bg={pl.bg}
                accent={PLATFORM_ACCENT[pl.tag]}
                desc={pl.tag === 'FB' ? t.seFbDesc : pl.tag === 'IG' ? t.seIgDesc : t.seThDesc}
                linkedCount={linkedCounts[pl.tag] ?? 0}
                linkedLabel={t.seLinkedCount}
                connectLabel={t.seConnect}
                processingLabel={t.processing}
                connecting={connectingPlatform === pl.tag}
                onConnect={() => handleConnect(TAG_TO_PLATFORM[pl.tag])}
              />
            ))}
          </div>
        </Card>

        {/* Right card: Tổng quan kết nối */}
        <Card style={{ minWidth: isMobile ? 'auto' : 280, padding: '18px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#211c38', marginBottom: 14 }}>{t.seOverview}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatMini icon={Users} label={t.seTotalAccounts} value={stats.total} color={STATUS_COLORS.info.color} bg={STATUS_COLORS.info.bg} />
            <StatMini icon={Activity} label={t.seActiveAccounts} value={stats.active} color={STATUS_COLORS.active.color} bg={STATUS_COLORS.active.bg} />
            <StatMini icon={ShieldAlert} label={t.seExpiredAccounts} value={stats.expired} color={STATUS_COLORS.expired.color} bg={STATUS_COLORS.expired.bg} />
            <StatMini icon={ShieldAlert} label={t.seErrorAccounts} value={stats.error} color={STATUS_COLORS.error.color} bg={STATUS_COLORS.error.bg} />
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
              <RefreshCw size={14} color="#7c3aed" strokeWidth={2} />
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
                              <ShieldCheck size={15} color={tk.valid ? '#16a34a' : '#dc2626'} strokeWidth={2} />
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {act === 'refresh' && (
                              <>
                                <button
                                  onClick={() => handleRefresh(c.id)}
                                  disabled={isLoading}
                                  title={lang === 'en' ? 'Refresh token' : 'Làm mới token'}
                                  style={{ border: 'none', background: 'none', cursor: isLoading ? 'wait' : 'pointer', padding: 4, display: 'flex', opacity: isLoading ? 0.5 : 1 }}
                                >
                                  <RefreshCw size={15} color="#7c3aed" strokeWidth={2} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setOpenMenu(openMenu?.id === c.id ? null : { id: c.id, rect, act: 'refresh' });
                                  }}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: 16, color: '#8a85a0', fontWeight: 700, borderRadius: 6 }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f1fb'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                >⋯</button>
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
                                  onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setOpenMenu(openMenu?.id === c.id ? null : { id: c.id, rect, act: 'reconnect' });
                                  }}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: 16, color: '#8a85a0', fontWeight: 700, borderRadius: 6 }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f1fb'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                >⋯</button>
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

      {/* ——— Status legend section ——— */}
      <Card style={{ padding: 26 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 16 }}>{t.seInfoTitle}</div>
        {/* Stack dọc ở mobile/tablet: divider dọc tự đổi thành divider ngang. align flex-start để nhãn các khối ngang hàng nhau. */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'stretch', gap: isMobile ? 24 : 0 }}>
          {/* Khối TRÁI — 3 trạng thái thật (~60%), phân bố đều bằng grid 3 cột bằng nhau, ngăn cách bằng divider dọc mờ. */}
          <div
            style={{
              flex: isMobile ? undefined : 3,
              display: isMobile ? 'flex' : 'grid',
              flexDirection: isMobile ? 'column' : undefined,
              gridTemplateColumns: isMobile ? undefined : 'repeat(3, 1fr)',
              alignItems: isMobile ? 'flex-start' : 'stretch',
              gap: isMobile ? 24 : 0,
            }}
          >
            <StatusLegendItem token="active" label={t.seStatusActive} desc={t.seInfoActive} />
            <StatusLegendItem token="expired" label={t.seStatusExpired} desc={t.seInfoExpired} />
            <StatusLegendItem token="error" label={t.seStatusError} desc={t.seInfoError} />
            {isMobile && <Divider isMobile={isMobile} />}
          </div>

          {/* Divider giữa khối trái và khối phải. */}
          <Divider isMobile={isMobile} />

          {/* Khối PHẢI (~40%) — "Kiểm tra trước khi đăng": cụm (text + shield) căn giữa khối, có gap rộng, đệm hai mép. */}
          {/* align flex-start để nhãn "Kiểm tra trước khi đăng" ngang hàng với 3 nhãn trạng thái. */}
          <div style={{ flex: isMobile ? undefined : 2, display: 'flex', justifyContent: 'center', padding: isMobile ? 0 : '0 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 28 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ShieldUser size={18} color={STATUS_COLORS.info.color} strokeWidth={2.2} style={{ flex: 'none' }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#211c38' }}>{t.seInfoCheckLabel}</span>
                </div>
                <div style={{ fontSize: 12, color: '#8a85a0', lineHeight: 1.5 }}>{t.seInfoCheck}</div>
              </div>
              <img
                src="/shield.png"
                alt={t.seShieldAlt}
                style={{ height: 108, width: 'auto', maxWidth: 186, objectFit: 'contain', flex: 'none', margin: '4px 8px 4px 0', marginTop: '-20px' }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ——— Portal Dropdown Menu ——— */}
      {openMenu && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          onClick={() => setOpenMenu(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: openMenu.rect.bottom + 6,
              left: Math.max(10, openMenu.rect.right - 160),
              zIndex: 9999,
              background: '#fff',
              border: '1px solid #efeaf8',
              borderRadius: 12,
              boxShadow: '0 10px 30px rgba(0,0,0,.15)',
              minWidth: 160,
              overflow: 'hidden',
            }}
          >
            {openMenu.act === 'refresh' && (
              <button
                onClick={() => { handleValidate(openMenu.id); setOpenMenu(null); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '11px 16px', fontSize: 12.5, fontWeight: 600, color: '#3f3a55', cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#faf6ff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
              >
                {t.seCheckStatus}
              </button>
            )}
            <button
              onClick={() => { handleDisconnect(openMenu.id); setOpenMenu(null); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '11px 16px', fontSize: 12.5, fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#fff5f5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              {lang === 'en' ? 'Disconnect' : 'Ngắt kết nối'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ——— Small helpers ———

// Ô số liệu "Tổng quan kết nối": icon trạng thái + số + nhãn. Màu icon/số dùng chung token với badge bảng.
function StatMini({ icon: IconCmp, label, value, color, bg }: { icon: LucideIcon; label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <IconCmp size={20} color={color} strokeWidth={2.2} style={{ flex: 'none' }} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color }}>{value}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#3f3a55', marginTop: 2 }}>{label}</span>
      </div>
    </div>
  );
}

// Card 1 nền tảng: dải accent brand trên đỉnh + logo + badge số liên kết + tên + mô tả + nút "+ Kết nối".
function PlatformConnectCard({ tag, name, bg, accent, desc, linkedCount, linkedLabel, connectLabel, processingLabel, connecting, onConnect }: {
  tag: string; name: string; bg: string; accent: string; desc: string;
  linkedCount: number; linkedLabel: string; connectLabel: string; processingLabel: string;
  connecting: boolean; onConnect: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12,
        border: '1px solid #efeaf8', borderRadius: 16, padding: '18px 16px 16px', background: '#fff',
        boxShadow: hover ? '0 12px 28px -12px rgba(40,20,90,.22)' : '0 2px 8px rgba(40,20,90,.05)',
        transition: 'box-shadow .18s',
      }}
    >
      {/* Dải accent brand trên đỉnh (full width, bo theo radius card). */}
      <span aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent }} />

      {/* Hàng logo + badge số liên kết. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <PlatformTag tag={tag} bg={bg} size={46} radius={12} />
        <span style={{ background: STATUS_NEUTRAL.bg, color: STATUS_NEUTRAL.color, borderRadius: 999, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {linkedCount} {linkedLabel}
        </span>
      </div>

      {/* Tên + mô tả phụ. */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{name}</div>
        <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 2 }}>{desc}</div>
      </div>

      {/* Nút "+ Kết nối" full width — outline primary, hover thành filled nhạt. */}
      <button
        onClick={onConnect}
        disabled={connecting}
        style={{
          width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          border: `1.5px solid ${STATUS_COLORS.info.color}`, borderRadius: 11, padding: '9px 14px',
          fontSize: 13.5, fontWeight: 700, color: STATUS_COLORS.info.color,
          background: hover && !connecting ? STATUS_COLORS.info.bg : '#fff',
          cursor: connecting ? 'wait' : 'pointer', opacity: connecting ? 0.6 : 1, transition: 'background .15s',
        }}
      >
        {connecting ? <span>{processingLabel}</span> : <><Link size={15} strokeWidth={2.4} />{connectLabel}</>}
      </button>
    </div>
  );
}

// Một mục chú thích trạng thái: chấm tròn (màu lấy từ design token) + label + mô tả.
// Chấm dùng STATUS_COLORS.color → đồng bộ với badge trạng thái trong bảng.
function StatusLegendItem({ token, label, desc }: { token: 'active' | 'expired' | 'error'; label: string; desc: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: STATUS_COLORS[token].color, flex: 'none' }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: '#211c38' }}>{label}</span>
      </div>
      <div style={{ fontSize: 12, color: '#8a85a0', lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

// Divider mờ: dọc trên desktop, ngang khi stack ở mobile/tablet.
// Màu lấy từ token primary (STATUS_COLORS.info) phủ opacity thấp → đồng bộ theme, không hardcode màu xám.
const DIVIDER_BG = `${STATUS_COLORS.info.color}1f`; // #7c3aed @ ~12% alpha
function Divider({ isMobile }: { isMobile: boolean }) {
  return isMobile
    ? <div style={{ height: 1, background: DIVIDER_BG, alignSelf: 'stretch' }} />
    : <div style={{ width: 1, background: DIVIDER_BG, alignSelf: 'stretch' }} />;
}
