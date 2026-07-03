import { useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card, PlatformTag, Icon } from '../ui';
import { PLATFORMS } from '../../theme';
import type { BrandProfile, Platform } from '../../api/brandProfile';
import AiBrandPanel from './AiBrandPanel';
import { brandHealth } from './brandHealth';
import { LogoSquare, ReadChips } from './chips';
import LogoLightbox from './LogoLightbox';

const splitTags = (s: string | null): string[] => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const TAG_BY_ENUM: Record<Platform, string> = { FACEBOOK: 'FB', INSTAGRAM: 'IG', THREADS: 'TH' };

/** Màn Xem hồ sơ (read-only, full-page) — cột phải là panel đầy đủ "AI đã hiểu về thương hiệu". */
export default function BrandProfileView({ profile, onClose, onEdit }: { profile: BrandProfile; onClose: () => void; onEdit: () => void }) {
  const { t, brandGradient } = useApp();
  // 4 mốc responsive: mobile <640 (xếp dọc trong card), mobile+tablet <1024 (panel AI xuống dưới thay vì 2 cột).
  const { width } = useBreakpoint();
  const isMobile = width < 640;
  const stack = width < 1024;
  const { percent, missing } = brandHealth(profile);
  const tones = splitTags(profile.brandVoice);
  const audiences = splitTags(profile.targetAudience);
  const [zoom, setZoom] = useState(false);

  // Logo có ảnh thật → bấm để phóng to (lightbox); placeholder chữ cái thì không.
  const zoomableLogo = (size?: number) =>
    profile.logoUrl ? (
      <button
        type="button"
        onClick={() => setZoom(true)}
        title={t.bpLogoZoom}
        aria-label={t.bpLogoZoom}
        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'zoom-in', flex: 'none' }}
      >
        <LogoSquare logoUrl={profile.logoUrl} brandName={profile.brandName} size={size} />
      </button>
    ) : (
      <LogoSquare logoUrl={profile.logoUrl} brandName={profile.brandName} size={size} />
    );

  return (
    <div className="view-pop" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onClose} className="btn-soft" style={backBtn}><Icon icon={ChevronLeft} size={18} stroke="#5b5670" />{t.bpBack}</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, flex: 1, minWidth: 0 }}>
          {zoomableLogo(46)}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20, color: '#211c38', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.brandName}</div>
            <div style={{ fontSize: 13, color: '#8a85a0' }}>{profile.industry}</div>
          </div>
        </div>
        <button onClick={onEdit} className="btn-grad" style={{ border: 'none', borderRadius: 11, padding: '10px 20px', fontSize: 14, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.bpEdit}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: stack ? '1fr' : 'minmax(0,1fr) 380px', gap: 18, alignItems: 'start' }}>
        {/* Cột chính — thông tin read-only theo 3 cụm */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15, color: '#211c38', borderBottom: '1px solid #f1eef8', paddingBottom: 12 }}>{t.bpSecInfo}</div>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 18, alignItems: isMobile ? 'center' : 'flex-start' }}>
              {zoomableLogo()}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, width: isMobile ? '100%' : undefined }}>
                <Row label={t.bpLabelIndustry} value={<span style={val}>{profile.industry}</span>} />
                {profile.description && <Row label={t.bpfDesc} value={<span style={{ ...val, fontWeight: 500, color: '#4b4660' }}>{profile.description}</span>} />}
              </div>
            </div>
          </Card>

          <Card style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15, color: '#211c38', borderBottom: '1px solid #f1eef8', paddingBottom: 12 }}>{t.bpSecPosition}</div>
            <Row label={t.bpLabelTone} value={<ReadChips items={tones} />} />
            <Row label={t.bpfAudience} value={<ReadChips items={audiences} />} />
            <Row label={t.bpKeywords} value={<ReadChips items={profile.brandKeywords} />} />
          </Card>

          <Card style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15, color: '#211c38', borderBottom: '1px solid #f1eef8', paddingBottom: 12 }}>{t.bpSecChannels}</div>
            <Row label={t.bpfPlatforms} value={
              <div style={{ display: 'flex', gap: 8 }}>
                {profile.platforms.length === 0 ? <span style={{ fontSize: 13, color: '#b3acc6' }}>—</span> : profile.platforms.map((p) => { const pl = PLATFORMS.find((x) => x.tag === TAG_BY_ENUM[p]); return pl ? <PlatformTag key={p} tag={pl.tag} bg={pl.bg} size={30} radius={9} /> : null; })}
              </div>
            } />
          </Card>
        </div>

        {/* Cột phải — panel "AI đã hiểu về thương hiệu" (mobile/tablet: xếp xuống dưới nội dung) */}
        <div style={{ position: stack ? 'static' : 'sticky', top: 90 }}>
          <AiBrandPanel percent={percent} missing={missing} keywords={profile.brandKeywords} dos={profile.brandDos} donts={profile.brandDonts} sticky={false} />
        </div>
      </div>

      {zoom && profile.logoUrl && <LogoLightbox src={profile.logoUrl} alt={profile.brandName} onClose={() => setZoom(false)} />}
    </div>
  );
}

const val = { fontSize: 14, fontWeight: 700, color: '#211c38' } as const;
const backBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' } as const;

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#9b94b5' }}>{label}</span>
      {value}
    </div>
  );
}
