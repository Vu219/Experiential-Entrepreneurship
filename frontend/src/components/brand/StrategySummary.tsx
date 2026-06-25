import { useApp } from '../../context/AppContext';
import type { ContentStrategy } from '../../api/contentStrategy';

/** "Tóm tắt chiến lược" — 6 ô đếm (Mục tiêu / Tần suất / Nền tảng / Đối tượng / Phong cách / CTA). */
export default function StrategySummary({ s }: { s: Pick<ContentStrategy, 'goals' | 'postsPerWeek' | 'platforms' | 'audiences' | 'styles' | 'ctas'> }) {
  const { t } = useApp();
  const tiles: [string, string][] = [
    [t.csSumGoals, `${s.goals.length} ${t.csUnitGoals}`],
    [t.csSumFreq, `${s.postsPerWeek} ${t.csPostsPerWeek}`],
    [t.csSumPlatforms, `${s.platforms.length} ${t.csUnitPlatforms}`],
    [t.csSumAudience, `${s.audiences.length} ${t.csUnitGroups}`],
    [t.csSumStyle, `${s.styles.length} ${t.csUnitStyles}`],
    [t.csSumCta, `${s.ctas.length} ${t.csUnitCta}`],
  ];
  return (
    <div style={{ background: 'linear-gradient(150deg,#f6f2ff,#fcf1fc)', border: '1px solid #efe6fb', borderRadius: 16, padding: 18 }}>
      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15, color: '#5b2b9e', marginBottom: 14 }}>{t.csSummary}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
        {tiles.map(([label, value]) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #efe6fb', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#9b94b5' }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#211c38', marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
