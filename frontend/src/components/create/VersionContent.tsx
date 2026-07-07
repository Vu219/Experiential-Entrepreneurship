import { useApp } from '../../context/AppContext';
import type { ContentVersion } from '../../api/contentCreationService';
import { CaptionCounter, HashtagCounter } from './platformLimits';

const sectionLabel = { fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 9 } as const;
const block = { background: '#faf8fe', borderRadius: 12, padding: '13px 15px', fontSize: 13.5, lineHeight: 1.55, color: '#3f3a55' } as const;

/** Hiển thị read-only một ContentVersion: bài viết (hook → thân → CTA), caption, hashtag, CTA, media prompt. */
export default function VersionContent({ version }: { version: ContentVersion }) {
  const { t } = useApp();
  const partLabel = (label: string) => (
    <span style={{ display: 'inline-block', background: '#f3edff', color: '#7c3aed', borderRadius: 7, padding: '2px 8px', fontSize: 10.5, fontWeight: 700, marginBottom: 6 }}>{label}</span>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={sectionLabel}>{t.cwTabPost}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...block, borderLeft: '3px solid #8b5cf6', borderRadius: '0 12px 12px 0' }}>
            {partLabel(t.cwHook)}
            <div>{version.post.hook}</div>
          </div>
          <div style={{ ...block, borderLeft: '3px solid #22d3ee', borderRadius: '0 12px 12px 0', whiteSpace: 'pre-line' }}>
            {partLabel(t.cwBody)}
            <div>{version.post.body}</div>
          </div>
          <div style={{ ...block, borderLeft: '3px solid #ec4899', borderRadius: '0 12px 12px 0' }}>
            {partLabel(t.cwEndCta)}
            <div>{version.post.cta}</div>
          </div>
        </div>
      </div>

      <div>
        <div style={sectionLabel}>{t.cwTabCaption}</div>
        <div style={block}>{version.caption}</div>
        <CaptionCounter platform={version.platform} text={version.caption} />
      </div>

      <div>
        <div style={sectionLabel}>{t.cwTabHashtag}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {version.hashtags.map((h, i) => (
            <span key={i} style={{ background: '#f3edff', color: '#7c3aed', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 600 }}>{h}</span>
          ))}
        </div>
        <HashtagCounter platform={version.platform} count={version.hashtags.length} />
      </div>

      <div>
        <div style={sectionLabel}>{t.cwTabCta}</div>
        <div style={block}>{version.cta}</div>
      </div>

      <div>
        <div style={sectionLabel}>{t.cwTabMedia}</div>
        <div style={{ ...block, border: '1.5px dashed #d9cef5', background: '#fdfcff', fontSize: 12.5, color: '#6b6680' }}>{version.mediaPrompt}</div>
      </div>
    </div>
  );
}
