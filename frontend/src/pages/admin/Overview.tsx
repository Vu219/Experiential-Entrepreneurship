import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Icon, Card } from '../../components/ui';
import { adminStats, adminUsers, planDist, health } from '../../data';

export default function Overview() {
  const { t, lang, brandGradient } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const sCards = adminStats(lang);
  const users = adminUsers(lang);
  const hl = health(lang);
  const stacked = isMobile || isTablet;

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 18 }}>
        {sCards.map((s, i) => (
          <Card key={i} style={{ padding: 20, borderRadius: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon icon={s.icon} stroke={s.color} />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16a34a', background: '#e8f8ee', padding: '3px 9px', borderRadius: 999 }}>{s.trend}</span>
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 26, color: '#211c38', margin: '14px 0 2px' }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#8a85a0' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.7fr 1fr', gap: 20, alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.adRecent}</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6', cursor: 'pointer' }}>{t.viewAll}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  {[t.colName, t.colPlan, t.colStatus, t.colPosts, t.colJoined].map((h, i) => (
                    <th key={i} style={{ fontSize: 12, fontWeight: 600, color: '#a59fbb', padding: '12px 8px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f1eef8' }}>
                    <td style={{ padding: '13px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 32, height: 32, flex: 'none', borderRadius: '50%', background: brandGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{u.initials}</span>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#2b2543' }}>{u.name}</div>
                          <div style={{ fontSize: 11.5, color: '#a59fbb' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 8px' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: u.planColor, background: u.planBg, padding: '4px 10px', borderRadius: 999 }}>{u.plan}</span>
                    </td>
                    <td style={{ padding: '13px 8px' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: u.stColor, background: u.stBg, padding: '4px 10px', borderRadius: 999 }}>{u.status}</span>
                    </td>
                    <td style={{ padding: '13px 8px', fontSize: 13.5, fontWeight: 600, color: '#2b2543' }}>{u.posts}</td>
                    <td style={{ padding: '13px 8px', fontSize: 13, color: '#8a85a0' }}>{u.joined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 18 }}>{t.adPlanDist}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {planDist.map((p, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#3f3a55' }}>{p.plan}</span>
                    <span style={{ fontSize: 13, color: '#8a85a0' }}>{p.count} · {p.pct}</span>
                  </div>
                  <div style={{ height: 9, borderRadius: 99, background: '#f1eef9', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, width: p.pct, background: p.color }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 16 }}>{t.adHealth}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {hl.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13.5, color: '#3f3a55' }}>{h.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: h.color, background: h.bg, padding: '4px 10px', borderRadius: 999 }}>{h.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
