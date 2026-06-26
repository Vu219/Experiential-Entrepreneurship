import { useState, type CSSProperties } from 'react';
import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useUiStore } from '../store/useUiStore';
import { Card, PlatformTag } from '../components/ui';
import { notifLabels, themeOptions, connectedAccounts, connectionStats } from '../data';
import { PLATFORMS } from '../theme';

type SettingsTab = 'appearance' | 'notifications' | 'connections';

// ——— Status badge color map ———
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active: { bg: '#dcfce7', color: '#16a34a' },
  expired: { bg: '#ffedd5', color: '#c2410c' },
  disconnected: { bg: '#f3f4f6', color: '#6b7280' },
  error: { bg: '#fee2e2', color: '#dc2626' },
};

export default function Settings() {
  const { t, lang, setLang, theme, setTheme, notif, toggleNotif, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const { autoCollapse, toggleAutoCollapse } = useUiStore();
  const notifs = notifLabels(lang);
  const themes = themeOptions(lang);
  const accounts = connectedAccounts(lang);
  const cStats = connectionStats();

  const [tab, setTab] = useState<SettingsTab>('appearance');

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
      {tab === 'connections' && <ConnectionsTab t={t} lang={lang} isMobile={isMobile} brandGradient={brandGradient} accounts={accounts} stats={cStats} />}
    </div>
  );
}

// ================================================================
// Connections Tab — extracted for readability
// ================================================================

interface ConnTabProps {
  t: ReturnType<typeof import('./Settings')['default']> extends never ? never : Record<string, string>;
  lang: string;
  isMobile: boolean;
  brandGradient: string;
  accounts: ReturnType<typeof connectedAccounts>;
  stats: ReturnType<typeof connectionStats>;
}

function ConnectionsTab({ t, isMobile, brandGradient, accounts, stats }: ConnTabProps) {
  // ——— A. Header: Connect new + Overview ———
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header section — two side-by-side cards */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: 'stretch' }}>

        {/* Left card: Kết nối tài khoản mới */}
        <Card style={{ flex: 1, padding: '18px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#211c38' }}>{t.seConnectTitle}</div>
          <div style={{ fontSize: 12, color: '#8a85a0', marginBottom: 14, marginTop: 2 }}>{t.seConnectSub}</div>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
            {PLATFORMS.map((pl) => (
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
                <button style={{
                  border: '1.5px solid #ddd6f3', background: '#fff', borderRadius: 8,
                  padding: '6px 17px', fontSize: 13, fontWeight: 700, color: '#7c3aed',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.8 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.8-1.7" />
                  </svg>
                  {t.seConnect}
                </button>
              </div>
            ))}
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

      {/* ——— B. Account list table ——— */}
      <Card style={{ padding: 26 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>
            {t.seListTitle} ({accounts.length})
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{
              border: '1.5px solid #ece8f6', background: '#fff', borderRadius: 10,
              padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#3f3a55',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.5 9a9 9 0 0114.8-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15" />
              </svg>
              {t.seCheckStatus}
            </button>
            <select style={{
              border: '1.5px solid #ece8f6', background: '#fff', borderRadius: 10,
              padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#3f3a55', cursor: 'pointer',
            }}>
              <option>{t.seAllStatus}</option>
            </select>
          </div>
        </div>

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
              {accounts.map((a, i) => {
                const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.active;
                const statusLabel = a.status === 'active' ? t.seStatusActive
                  : a.status === 'expired' ? t.seStatusExpired
                    : a.status === 'disconnected' ? t.seStatusDisconnected
                      : t.seStatusError;

                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f5f2fa' }}>
                    {/* Platform */}
                    <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PlatformTag tag={a.tag} bg={a.bg} size={30} radius={99} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#2b2543' }}>{a.platform}</div>
                          <div style={{ fontSize: 11, color: '#8a85a0' }}>{a.subLabel}</div>
                        </div>
                      </div>
                    </td>

                    {/* Account */}
                    <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: '50%', flex: 'none',
                          background: 'linear-gradient(135deg,#e9f0ff,#f1e9ff)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: '#7c3aed',
                        }}>{a.name.charAt(0)}</span>
                        <div>
                          <div style={{ fontWeight: 600, color: '#2b2543' }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: '#8a85a0' }}>{a.handle}</div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 8,
                        fontSize: 11.5, fontWeight: 700, background: st.bg, color: st.color,
                      }}>{statusLabel}</span>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '12px 8px', whiteSpace: 'nowrap', color: '#3f3a55', fontSize: 12.5 }}>
                      {a.date}
                    </td>

                    {/* Token */}
                    <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                      {a.tokenValid !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={a.tokenValid ? '#16a34a' : '#dc2626'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          <div>
                            <div style={{ fontWeight: 600, color: a.tokenValid ? '#16a34a' : '#dc2626', fontSize: 12 }}>{a.tokenLabel}</div>
                            <div style={{ fontSize: 11, color: a.tokenValid ? '#8a85a0' : '#c2410c' }}>{a.tokenSub}</div>
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#8a85a0' }}>—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {a.actionType === 'refresh' && (
                          <>
                            <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 4v6h-6M1 20v-6h6" />
                                <path d="M3.5 9a9 9 0 0114.8-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15" />
                              </svg>
                            </button>
                            <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, fontSize: 16, color: '#8a85a0', fontWeight: 700 }}>⋯</button>
                          </>
                        )}
                        {a.actionType === 'reconnect' && (
                          <>
                            <button style={{
                              border: '1.5px solid #ece8f6', background: '#fff', borderRadius: 8,
                              padding: '5px 12px', fontSize: 11.5, fontWeight: 700, color: '#c2410c',
                              cursor: 'pointer',
                            }}>{t.seReconnect}</button>
                            <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, fontSize: 16, color: '#8a85a0', fontWeight: 700 }}>⋯</button>
                          </>
                        )}
                        {a.actionType === 'connect' && (
                          <button style={{
                            border: 'none', borderRadius: 8,
                            padding: '6px 14px', fontSize: 11.5, fontWeight: 700, color: '#fff',
                            background: brandGradient, cursor: 'pointer',
                          }}>{t.seConnect}</button>
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
            <select style={{ border: '1.5px solid #ece8f6', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <option>10</option>
              <option>20</option>
              <option>50</option>
            </select>
            {t.sePerPage}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2].map((p) => (
              <button key={p} style={{
                width: 30, height: 30, borderRadius: 8, border: p === 1 ? 'none' : '1.5px solid #ece8f6',
                background: p === 1 ? brandGradient : '#fff',
                color: p === 1 ? '#fff' : '#3f3a55',
                fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
              }}>{p}</button>
            ))}
          </div>
        </div>
      </Card>

      {/* ——— C. Status info section ——— */}
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
