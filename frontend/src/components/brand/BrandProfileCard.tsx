import { LayoutList, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon } from '../ui';
import BrandHealthBar from './BrandHealthBar';
import { brandHealth } from './brandHealth';
import type { BrandProfile } from '../../api/brandProfile';
import { LogoSquare } from './chips';
import { C } from '../../styles/colors';

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
    <Card style={{ padding: 20, border: active ? '2px solid transparent' : `1px solid ${C.border}`, backgroundImage: active ? `linear-gradient(${C.surface},${C.surface}), ${brandGradient}` : undefined, backgroundOrigin: 'border-box', backgroundClip: active ? 'padding-box, border-box' : undefined, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <LogoSquare logoUrl={profile.logoUrl} brandName={profile.brandName} size={50} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 16, color: C.textStrong, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.brandName}</span>
            {active && <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: C.onBrand, background: brandGradient, padding: '3px 9px', borderRadius: 999 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />{t.bpActive}</span>}
          </div>
          <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>{profile.industry}</div>
        </div>
      </div>

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map((tag, i) => (
            <span key={i} style={{ background: C.surfaceMuted, color: C.legacyText5b4b86, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag}</span>
          ))}
        </div>
      )}

      <BrandHealthBar percent={percent} compact />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: C.textMuted }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon icon={LayoutList} size={15} stroke={C.legacyTexta78bfa} />
          {strategyCount} {t.bpStrategiesWord}
        </span>
        <span>{t.bpUpdated}: {fmtDate(profile.updatedAt)}</span>
      </div>

      {/* Icon con mắt bỏ (trùng chức năng với "Xem"): card không active giữ "Chọn dùng" + "Xem". */}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
        {!active && (
          <button onClick={onUse} className="btn-outline" style={{ ...btnGhost, color: C.primary, borderColor: C.legacyBordere0d5fb, background: C.surfaceMuted }}>{t.bpUse}</button>
        )}
        <button onClick={onView} className="btn-soft" style={btnGhost}>{t.bpView}</button>
        <button onClick={onEdit} title={t.bpEdit} style={iconBtn} aria-label={t.bpEdit}><Icon icon={Pencil} size={16} stroke={C.textSecondary} /></button>
        <button onClick={onDelete} title={t.bpDelete} style={{ ...iconBtn, color: C.legacyTextd6336c }} aria-label={t.bpDelete}><Icon icon={Trash2} size={16} stroke={C.legacyTextd6336c} /></button>
      </div>
    </Card>
  );
}

const btnGhost = { flex: 1, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 10, padding: '8px 0', fontSize: 13, fontWeight: 700, color: C.ink550, cursor: 'pointer' } as const;
const iconBtn = { flex: 'none', width: 38, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 10, padding: '8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSecondary } as const;
