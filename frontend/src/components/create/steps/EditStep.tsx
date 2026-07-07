import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Card, Icon } from '../../ui';
import type { ContentVersion, GenerationResult } from '../../../api/contentCreationService';
import type { SourceSelection } from './SourceStep';
import StepLayout from '../StepLayout';
import PlatformTabs from '../PlatformTabs';
import PostImagePreview from '../PostImagePreview';
import BrandVoicePanel from '../BrandVoicePanel';
import { CaptionCounter, HashtagCounter } from '../platformLimits';
import { useBrandVoiceCheck } from '../useBrandVoiceCheck';

const parseHashtags = (text: string): string[] =>
  text.split(/[\s,]+/).map((h) => h.replace(/^#/, '').trim()).filter(Boolean).map((h) => `#${h}`);

const label = { display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 8 } as const;
const inputBase = {
  width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '11px 14px',
  fontSize: 13.5, lineHeight: 1.55, color: '#241f3a', background: '#fbfaff', outline: 'none',
} as const;

/**
 * Mốc 3 — Chỉnh sửa THỦ CÔNG từng phần (khác mốc 2: ở đó AI sửa qua "Tạo lại").
 * Panel brand voice giữ ở cột phải để kiểm LẠI sau khi sửa tay — điểm tụt so với
 * bản AI tạo sẽ có cảnh báo nhẹ. Bộ đếm caption/hashtag theo giới hạn từng nền tảng.
 */
export default function EditStep({
  source,
  gen,
  baselines,
  onPatchVersion,
  onBack,
  onNext,
}: {
  source: SourceSelection;
  gen: GenerationResult;
  /** Điểm brand voice lúc AI sinh từng version (versionId → %) để so sánh sau khi sửa. */
  baselines: Record<string, number>;
  onPatchVersion: (versionId: string, patch: Partial<ContentVersion>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t, brandGradient } = useApp();
  const [platform, setPlatform] = useState(source.platforms[0]);
  // Chuỗi hashtag đang gõ giữ nguyên (kể cả dấu cách cuối) — chỉ parse khi cập nhật state.
  const [hashtagDrafts, setHashtagDrafts] = useState<Record<string, string>>({});
  const voice = useBrandVoiceCheck(source.brand.id, onPatchVersion);
  const version = gen.versions.find((v) => v.platform === platform) ?? gen.versions[0];
  const hashtagText = hashtagDrafts[version.id] ?? version.hashtags.join(' ');

  const area = (value: string, onChange: (v: string) => void, minHeight = 70) => (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputBase, resize: 'vertical', minHeight }} />
  );

  const mainCard = (
    <Card>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.cwEditTitle}</div>
      <div style={{ fontSize: 12.5, color: '#8a85a0', marginBottom: 16, lineHeight: 1.5 }}>{t.cwEditSub}</div>

      <div style={{ marginBottom: 18 }}>
        <PlatformTabs platforms={source.platforms} value={version.platform} onChange={setPlatform} />
      </div>

      <label style={label}>{t.cwHook}</label>
      {area(version.post.hook, (v) => onPatchVersion(version.id, { post: { ...version.post, hook: v } }), 56)}

      <label style={{ ...label, marginTop: 16 }}>{t.cwBody}</label>
      {area(version.post.body, (v) => onPatchVersion(version.id, { post: { ...version.post, body: v } }), 140)}

      <label style={{ ...label, marginTop: 16 }}>{t.cwEndCta}</label>
      {area(version.post.cta, (v) => onPatchVersion(version.id, { post: { ...version.post, cta: v } }), 56)}

      <label style={{ ...label, marginTop: 16 }}>{t.cwTabCaption}</label>
      {area(version.caption, (v) => onPatchVersion(version.id, { caption: v }), 90)}
      <CaptionCounter platform={version.platform} text={version.caption} />

      <label style={{ ...label, marginTop: 16 }}>{t.cwTabHashtag}</label>
      <input
        value={hashtagText}
        onChange={(e) => {
          setHashtagDrafts((d) => ({ ...d, [version.id]: e.target.value }));
          onPatchVersion(version.id, { hashtags: parseHashtags(e.target.value) });
        }}
        placeholder={t.cwHashtagHint}
        style={inputBase}
      />
      <HashtagCounter platform={version.platform} count={version.hashtags.length} />

      <label style={{ ...label, marginTop: 16 }}>{t.cwTabCta}</label>
      {area(version.cta, (v) => onPatchVersion(version.id, { cta: v }), 56)}

      <label style={{ ...label, marginTop: 16 }}>{t.cwTabMedia}</label>
      {area(version.mediaPrompt, (v) => onPatchVersion(version.id, { mediaPrompt: v }), 70)}
    </Card>
  );

  const side = (
    <>
      <BrandVoicePanel
        check={version.brandVoice}
        busy={voice.busy}
        error={voice.error}
        baselineScore={baselines[version.id]}
        onRecheck={() => voice.run(version)}
      />
      <PostImagePreview version={version} brandName={source.brand.brandName} />
    </>
  );

  const action = (
    <div style={{ display: 'flex', gap: 10 }}>
      <button
        onClick={onBack}
        className="btn-soft"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 'none', border: '1px solid #ece8f6', background: '#fff', borderRadius: 12, padding: '13px 18px', fontWeight: 700, fontSize: 14, color: '#574f6e', cursor: 'pointer' }}
      >
        <Icon icon={ArrowLeft} size={15} stroke="#574f6e" />{t.cwBack}
      </button>
      <button
        onClick={onNext}
        className="btn-grad"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1, border: 'none', borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, cursor: 'pointer' }}
      >
        {t.cwNext}<Icon icon={ArrowRight} size={16} stroke="#fff" />
      </button>
    </div>
  );

  return <StepLayout main={mainCard} side={side} action={action} />;
}
