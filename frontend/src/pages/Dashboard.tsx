import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Icon, Card, PlatformTag } from '../components/ui';
import { stats, weekChart, platformUsage, posts } from '../data';

export default function Dashboard() {
  const { t, lang, profile, brandGradient, go } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const statCards = stats(lang);
  const chart = weekChart(lang);
  const rows = posts(lang);

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Hero banner */}
      <div style={{ borderRadius: 22, padding: isMobile ? '24px 22px' : '30px 34px', background: `radial-gradient(700px 300px at 90% -40%,rgba(255,255,255,.45),transparent),${brandGradient}`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', boxShadow: '0 26px 50px -28px rgba(139,92,246,.55)' }}>
        <div>
          <div style={{ fontSize: 14, opacity: 0.92 }}>{t.greeting}, {profile.name} 👋</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 28, margin: '6px 0 8px' }}>{t.dashHeadline}</div>
          <div style={{ fontSize: 14, opacity: 0.9, maxWidth: 480, lineHeight: 1.5 }}>{t.dashHeadSub}</div>
        </div>
        <button onClick={() => go('create')} style={{ border: 'none', borderRadius: 13, padding: '14px 22px', fontWeight: 700, fontSize: 14, color: '#7c2bb0', background: '#fff', whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: '0 10px 22px -10px rgba(0,0,0,.3)' }}>✨ {t.createNew}</button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 18 }}>
        {statCards.map((s, i) => (
          <Card key={i} style={{ padding: 20, borderRadius: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={s.icon} stroke={s.color} />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: s.trendColor, background: s.trendBg, padding: '3px 9px', borderRadius: 999 }}>{s.trend}</span>
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 27, color: '#211c38', margin: '14px 0 2px' }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#8a85a0' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Performance + platforms */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1.6fr 1fr', gap: 18, alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.perfTitle}</div>
              <div style={{ fontSize: 12.5, color: '#8a85a0' }}>{t.perfSub}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#8b5cf6', background: '#f3edff', borderRadius: 8, padding: '6px 12px' }}>7D</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#8a85a0', background: '#f6f4fb', borderRadius: 8, padding: '6px 12px' }}>30D</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 200, paddingTop: 10 }}>
            {chart.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', borderRadius: '8px 8px 0 0', background: brandGradient, height: b.h, minHeight: 8 }} />
                <span style={{ fontSize: 11.5, color: '#a59fbb' }}>{b.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 4 }}>{t.platTitle}</div>
          <div style={{ fontSize: 12.5, color: '#8a85a0', marginBottom: 18 }}>{t.platSub}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {platformUsage.map((p, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, fontWeight: 600, color: '#3f3a55' }}>
                    <PlatformTag tag={p.tag} bg={p.bg} />
                    {p.name}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#211c38' }}>{p.pct}</span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: '#f1eef9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, width: p.pct, background: p.bg }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent posts table */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.recentTitle}</div>
          <span onClick={() => go('calendar')} style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6', cursor: 'pointer' }}>{t.viewAll}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                {[t.colPost, t.colPlatform, t.colStatus, t.colReach, t.colDate].map((h, i) => (
                  <th key={i} style={{ fontSize: 12, fontWeight: 600, color: '#a59fbb', padding: '12px 8px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f1eef8' }}>
                  <td style={{ padding: '14px 8px', fontSize: 14, fontWeight: 600, color: '#2b2543', maxWidth: 300 }}>{p.title}</td>
                  <td style={{ padding: '14px 8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#5b5670' }}>
                      <PlatformTag tag={p.tag} bg={p.bg} size={22} radius={7} fontSize={11} />
                      {p.platform}
                    </span>
                  </td>
                  <td style={{ padding: '14px 8px' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: p.stColor, background: p.stBg, padding: '4px 11px', borderRadius: 999 }}>{p.status}</span>
                  </td>
                  <td style={{ padding: '14px 8px', fontSize: 14, fontWeight: 600, color: '#2b2543' }}>{p.reach}</td>
                  <td style={{ padding: '14px 8px', fontSize: 13, color: '#8a85a0' }}>{p.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
