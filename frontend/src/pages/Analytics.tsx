import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Icon, Card, PlatformTag } from '../components/ui';
import { stats, monthBars, audience, posts } from '../data';

export default function Analytics() {
  const { t, lang, brandGradient } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const statCards = stats(lang);
  const bars = monthBars(lang);
  const rows = posts(lang);
  const stacked = isMobile || isTablet;

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.7fr 1fr', gap: 20, alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.anReach}</div>
            <button style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '8px 13px', fontSize: 12.5, fontWeight: 600, color: '#7c3aed', cursor: 'pointer' }}>⤓ {t.anExport}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 230 }}>
            {bars.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', borderRadius: '6px 6px 0 0', background: brandGradient, height: b.h, minHeight: 6 }} />
                <span style={{ fontSize: 10.5, color: '#a59fbb' }}>{b.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 18 }}>{t.anAudience}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {audience.map((a, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#3f3a55' }}>{a.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#211c38' }}>{a.pct}</span>
                </div>
                <div style={{ height: 9, borderRadius: 99, background: '#f1eef9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, width: a.pct, background: a.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 6 }}>{t.anTop}</div>
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
