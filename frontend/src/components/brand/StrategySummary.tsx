import { useApp } from '../../context/AppContext';
import type { ContentStrategy } from '../../api/contentStrategy';
import { FREQUENCY_UNIT_OPTIONS } from '../../data';
import { C } from '../../styles/colors';

/** "Tóm tắt chiến lược" — 6 ô đếm (Mục tiêu / Tần suất / Nền tảng / Đối tượng / Phong cách / CTA). */
export default function StrategySummary({ s }: { s: Pick<ContentStrategy, 'goals' | 'frequencyCount' | 'frequencyUnit' | 'platforms' | 'audiences' | 'styles' | 'ctas'> }) {
  const { t, lang } = useApp();
  const unitLabel = FREQUENCY_UNIT_OPTIONS(lang).find((u) => u.value === (s.frequencyUnit ?? 'WEEK'))?.label ?? '';
  const tiles: [string, string][] = [
    [t.csSumGoals, `${s.goals.length} ${t.csUnitGoals}`],
    [t.csSumFreq, `${s.frequencyCount ?? 3} ${t.csPostsPer} ${unitLabel}`],
    [t.csSumPlatforms, `${s.platforms.length} ${t.csUnitPlatforms}`],
    [t.csSumAudience, `${s.audiences.length} ${t.csUnitGroups}`],
    [t.csSumStyle, `${s.styles.length} ${t.csUnitStyles}`],
    [t.csSumCta, `${s.ctas.length} ${t.csUnitCta}`],
  ];
  return (
    <div style={{ background: `linear-gradient(150deg,${C.legacyBgf6f2ff},${C.legacyBgfcf1fc})`, border: `1px solid ${C.promoBorder}`, borderRadius: 16, padding: 18 }}>
      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15, color: C.accentText, marginBottom: 14 }}>{t.csSummary}</div>
      {/* Cap mỗi ô ở 200px (auto-fit + canh giữa): 6 ô không giãn ngang full-width, tự wrap 3 ô/hàng khi rộng (#4.2). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 200px))', justifyContent: 'center', gap: 12 }}>
        {tiles.map(([label, value]) => (
          <div key={label} style={{ background: C.surface, border: `1px solid ${C.promoBorder}`, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink350 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.textStrong, marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
