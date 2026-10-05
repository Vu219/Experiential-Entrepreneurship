import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Icon } from '../ui';
import type { ContentVersion } from '../../api/contentCreationService';
import ScriptSections from './ScriptSections';
import { CaptionCounter, HashtagCounter } from './platformLimits';
import { C } from '../../styles/colors';

const sectionLabel = { fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: C.textFaint, marginBottom: 8 } as const;
const block = { background: C.bg, borderRadius: 12, padding: '12px 16px', fontSize: 13.5, lineHeight: 1.55, color: C.text } as const;

export type VersionTab = 'script' | 'content' | 'media';

/** Thanh sub-tab dùng chung: Script video / Nội dung / Media prompt. */
export function VersionTabs({ value, onChange }: { value: VersionTab; onChange: (tab: VersionTab) => void }) {
  const { t } = useApp();
  const tabs: { key: VersionTab; label: string }[] = [
    { key: 'script', label: t.cwTabScript },
    { key: 'content', label: t.cwTabContent },
    { key: 'media', label: t.cwTabMedia },
  ];
  return (
    <div role="tablist" style={{ display: 'inline-flex', gap: 4, background: C.surfaceMuted, borderRadius: 11, padding: 4 }}>
      {tabs.map(({ key, label }) => {
        const on = value === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(key)}
            style={{
              border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              background: on ? C.surface : 'transparent', color: on ? C.primary : C.textMuted,
              boxShadow: on ? `0 2px 8px -3px ${C.legacyShadowrgba8060140_25_}` : 'none',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Tab Script video (read-only): 3 section (Mở đầu · Nội dung chính · Kết bài) trên timeline dọc,
 *  mỗi section 2 cột (nội dung | gợi ý cảnh quay). Dùng CHUNG ScriptSections với màn sửa — nhất quán. */
export function ScriptView({ version }: { version: ContentVersion }) {
  return <ScriptSections script={version.script} />;
}

/** Tab Nội dung (read-only): caption + hashtag + CTA gộp CÙNG tab, kèm bộ đếm giới hạn nền tảng. */
export function ContentFieldsView({ version }: { version: ContentVersion }) {
  const { t } = useApp();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={sectionLabel}>{t.cwTabCaption}</div>
        <div style={block}>{version.caption}</div>
        <CaptionCounter platform={version.platform} text={version.caption} />
      </div>
      <div>
        <div style={sectionLabel}>{t.cwTabHashtag}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {version.hashtags.map((h, i) => (
            <span key={i} style={{ background: C.primarySoft, color: C.primary, borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 600 }}>{h}</span>
          ))}
        </div>
        <HashtagCounter platform={version.platform} count={version.hashtags.length} />
      </div>
      <div>
        <div style={sectionLabel}>{t.cwTabCta}</div>
        <div style={block}>{version.cta}</div>
      </div>
    </div>
  );
}

/** Tab Media prompt (read-only) + nút copy nhanh (FR-29: chỉ là mô tả text, không sinh media). */
export function MediaPromptView({ version }: { version: ContentVersion }) {
  const { t } = useApp();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(version.mediaPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ ...sectionLabel, marginBottom: 0 }}>{t.cwTabMedia}</div>
        <button
          onClick={copy}
          className="btn-soft"
          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 8, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, color: copied ? C.success : C.ink600, cursor: 'pointer' }}
        >
          <Icon icon={copied ? Check : Copy} size={13} stroke={copied ? C.success : C.ink600} />
          {copied ? t.cwCopied : t.cwCopy}
        </button>
      </div>
      <div style={{ ...block, border: `1.5px dashed ${C.legacyBorderd9cef5}`, background: C.surfaceSubtle, fontSize: 12.5, color: C.textSecondary, whiteSpace: 'pre-line' }}>{version.mediaPrompt}</div>
    </div>
  );
}

/** Hiển thị read-only một ContentVersion theo 3 sub-tab: Script video / Nội dung / Media prompt. */
export default function VersionContent({ version }: { version: ContentVersion }) {
  const [tab, setTab] = useState<VersionTab>('script');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <VersionTabs value={tab} onChange={setTab} />
      {tab === 'script' && <ScriptView version={version} />}
      {tab === 'content' && <ContentFieldsView version={version} />}
      {tab === 'media' && <MediaPromptView version={version} />}
    </div>
  );
}
