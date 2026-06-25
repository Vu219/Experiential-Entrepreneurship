import { useApp } from '../../context/AppContext';
import { Card, Icon } from '../ui';
import BrandHealthBar from './BrandHealthBar';
import { brandHealth } from './brandHealth';
import type { BrandProfile } from '../../api/brandProfile';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
};

const toneTags = (voice: string | null): string[] =>
  (voice ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 2);

export default function BrandProfileCard({
  profile,
  strategyCount,
  active,
  onUse,
  onView,
  onEdit,
  onDelete,
}: {
  profile: BrandProfile;
  strategyCount: number;
  active: boolean;
  onUse: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, brandGradient } = useApp();
  const { percent } = brandHealth(profile);
  const tags = [...toneTags(profile.brandVoice), profile.targetAudience].filter(Boolean).slice(0, 3);

  return (
    <Card style={{ padding: 20, border: active ? '2px solid transparent' : '1px solid #efeaf8', backgroundImage: active ? `linear-gradient(#fff,#fff), ${brandGradient}` : undefined, backgroundOrigin: 'border-box', backgroundClip: active ? 'padding-box, border-box' : undefined, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div style={{ width: 50, height: 50, flex: 'none', borderRadius: 14, background: brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20 }}>{(profile.brandName || 'A')[0].toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 16, color: '#211c38', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.brandName}</span>
            {active && <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: '#fff', background: brandGradient, padding: '3px 9px', borderRadius: 999 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />{t.bpActive}</span>}
          </div>
          <div style={{ fontSize: 12.5, color: '#8a85a0', marginTop: 2 }}>{profile.industry}</div>
        </div>
      </div>

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map((tag, i) => (
            <span key={i} style={{ background: '#f4f1fb', color: '#5b4b86', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag}</span>
          ))}
        </div>
      )}

      <BrandHealthBar percent={percent} compact />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#8a85a0' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon path="M4 5h16v6H4zM4 13h16v6H4z" size={15} stroke="#a78bfa" />
          {strategyCount} {t.bpStrategiesWord}
        </span>
        <span>{t.bpUpdated}: {fmtDate(profile.updatedAt)}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
        {active ? (
          <button onClick={onView} style={btnGhost}>{t.bpView}</button>
        ) : (
          <button onClick={onUse} style={{ ...btnGhost, color: '#7c3aed', borderColor: '#e0d5fb', background: '#f7f2ff' }}>{t.bpUse}</button>
        )}
        <button onClick={onView} title={t.bpView} style={iconBtn} aria-label={t.bpView}><Icon path="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 9a3 3 0 100 6 3 3 0 000-6z" size={17} stroke="#6b6680" /></button>
        <button onClick={onEdit} title={t.bpEdit} style={iconBtn} aria-label={t.bpEdit}><Icon path="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" size={16} stroke="#6b6680" /></button>
        <button onClick={onDelete} title={t.bpDelete} style={{ ...iconBtn, color: '#dc2626' }} aria-label={t.bpDelete}><Icon path="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" size={16} stroke="#dc2626" /></button>
      </div>
    </Card>
  );
}

const btnGhost = { flex: 1, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '8px 0', fontSize: 13, fontWeight: 700, color: '#5b5670', cursor: 'pointer' } as const;
const iconBtn = { flex: 'none', width: 38, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b6680' } as const;
