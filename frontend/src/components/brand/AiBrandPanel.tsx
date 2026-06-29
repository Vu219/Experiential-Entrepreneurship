import type { ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui';
import type { Dict } from '../../i18n';
import BrandHealthBar from './BrandHealthBar';
import { ReadChips } from './chips';

/**
 * Panel "AI đã hiểu về thương hiệu" — dùng chung cho màn Tạo/Sửa (preview theo dữ liệu
 * đang nhập) và màn Xem (đầy đủ). Gồm: AI Brand Health + "Cần bổ sung" + Brand Keywords
 * + Brand Do & Don't.
 */
export default function AiBrandPanel({ percent, missing, keywords, dos, donts, sticky = true }: {
  percent: number;
  missing: (keyof Dict)[];
  keywords: string[];
  dos: string[];
  donts: string[];
  sticky?: boolean;
}) {
  const { t } = useApp();
  return (
    <Card style={{ padding: 20, background: 'linear-gradient(150deg,#f6f2ff,#fcf1fc)', border: '1px solid #efe6fb', display: 'flex', flexDirection: 'column', gap: 16, position: sticky ? 'sticky' : 'static', top: 90 }}>
      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15, color: '#5b2b9e' }}>{t.bpAiUnderstand}</div>

      <div>
        <BrandHealthBar percent={percent} />
        <div style={{ fontSize: 12.5, color: '#7d6aa3', marginTop: 8 }}>{percent >= 80 ? t.bpHealthGood : t.bpHealthTip}</div>
      </div>

      {missing.length > 0 && (
        <Section title={t.bpNeedMore}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {missing.map((k) => <span key={k} style={{ background: '#fff', border: '1px dashed #d6cdf0', borderRadius: 999, padding: '4px 11px', fontSize: 12, fontWeight: 600, color: '#9b7fd6' }}>{t[k]}</span>)}
          </div>
        </Section>
      )}

      <Section title={t.bpKeywords}><ReadChips items={keywords} /></Section>

      <Section title={t.bpDoDont}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', marginBottom: 7 }}>{t.bpDo}</div>
            <DotList items={dos} color="#16a34a" empty={t.bpHealthGood} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#d6336c', marginBottom: 7 }}>{t.bpDont}</div>
            <DotList items={donts} color="#d6336c" empty="—" />
          </div>
        </div>
      </Section>

      <div style={{ fontSize: 12, color: '#9b7fd6', fontStyle: 'italic', borderTop: '1px solid #ece2fb', paddingTop: 12 }}>{t.bpHealthTip}</div>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#574f6e', marginBottom: 9 }}>{title}</div>
      {children}
    </div>
  );
}

function DotList({ items, color, empty }: { items: string[]; color: string; empty: string }) {
  if (!items.length) return <span style={{ fontSize: 12.5, color: '#b3acc6' }}>{empty}</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#4b4660' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flex: 'none' }} />{it}
        </div>
      ))}
    </div>
  );
}
