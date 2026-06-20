import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Card, PlatformTag } from '../components/ui';
import { trends, trendTags, brandDefaults } from '../data';

export default function Trends() {
  const { t, lang, brand, go } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const list = trends(lang);
  const industry = brand.industry || brandDefaults(lang).industry;
  const stacked = isMobile || isTablet;

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.5fr 1fr', gap: 20, alignItems: 'start' }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.trHot}</div>
            <div style={{ fontSize: 12.5, color: '#8a85a0' }}>{t.trIndustry}: {industry}</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', background: '#f3edff', borderRadius: 8, padding: '7px 12px' }}>🔥 Real-time</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((tr) => (
            <div key={tr.rank} style={{ display: 'flex', alignItems: 'center', gap: 14, border: '1px solid #efeaf8', borderRadius: 14, padding: 14, background: '#fcfbfe' }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20, color: '#d9cef0', width: 24, textAlign: 'center', flex: 'none' }}>{tr.rank}</div>
              <PlatformTag tag={tr.tag} bg={tr.bg} size={30} radius={8} fontSize={11} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#2b2543' }}>{tr.topic}</div>
                <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 2 }}>{tr.vol} {t.trVol}</div>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16a34a', background: '#e8f8ee', borderRadius: 999, padding: '4px 10px', flex: 'none' }}>↑ {tr.growth}</span>
              <button onClick={() => go('create')} style={{ border: '1px solid #e7d9fb', background: '#fff', borderRadius: 9, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#7c3aed', cursor: 'pointer', flex: 'none' }}>{t.use}</button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 16 }}>{t.trTags}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {trendTags.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f4f1fa', paddingBottom: 9 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#7c3aed' }}>{h.tag}</span>
              <span style={{ fontSize: 12.5, color: '#a59fbb' }}>{h.vol}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
