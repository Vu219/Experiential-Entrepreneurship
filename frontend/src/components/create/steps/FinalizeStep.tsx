import { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, Layers, Pencil, RefreshCw, Save, Sparkles } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Card, Icon } from '../../ui';
import type { ContentLifecycle } from '../../../api/contentGeneration';
import type { Platform } from '../../../api/brandProfile';
import { emptyScript, type ContentVersion, type GenerationResult } from '../../../api/contentCreationService';
import type { SourceSelection } from './SourceStep';
import { TONE_COLORS } from '../../../statusTokens';
import StepLayout from '../StepLayout';
import SourceInfoCard, { sourceToInfo } from '../SourceInfoCard';
import PlatformTabs, { tagOfPlatform } from '../PlatformTabs';
import ScriptSections from '../ScriptSections';
import VersionContent from '../VersionContent';
import PostImagePreview from '../PostImagePreview';
import BrandVoicePanel from '../BrandVoicePanel';
import AutoGrowTextarea from '../AutoGrowTextarea';
import { CONTENT_STATUS_META } from '../statusMeta';
import { CaptionCounter, HashtagCounter, parseHashtags } from '../platformLimits';
import { useBrandVoiceCheck } from '../useBrandVoiceCheck';
import { useScriptRegen } from '../useScriptRegen';

/** Phạm vi một lượt định dạng: 'all' = mọi nền tảng đang chọn, hoặc đúng MỘT nền tảng. */
export type FormatScope = 'all' | Platform;

// Trạng thái được phép gắn khi lưu (theo state machine: trước khi vào pipeline đăng).
const SAVE_STATUSES: ContentLifecycle[] = ['DRAFT', 'NEED_REVIEW', 'APPROVED'];

const groupLabel = { fontSize: 12, fontWeight: 800, letterSpacing: '.04em', color: '#a59fbb' } as const;
const fieldLabel = { display: 'block', fontSize: 11.5, fontWeight: 700, color: '#a59fbb', marginBottom: 6 } as const;
const inputBase = {
  width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '11px 14px',
  fontSize: 13.5, lineHeight: 1.55, color: '#241f3a', background: '#fbfaff', outline: 'none',
} as const;

/** Tiêu đề một trong 3 mục (Script video · Nội dung · Media prompt) + đường kẻ mảnh. */
function GroupHeading({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 12px' }}>
      <span style={groupLabel}>{text}</span>
      <span aria-hidden style={{ flex: 1, height: 1, background: '#f1edfa' }} />
    </div>
  );
}

/**
 * Mốc 3 — Chỉnh sửa & Hoàn Thiện: gộp ba mốc cũ (Định dạng · Chỉnh sửa · Duyệt & Lưu) vào MỘT bước.
 *
 * - Định dạng không còn là mốc riêng mà là THAO TÁC bằng nút ngay trong không gian chỉnh sửa
 *   (cùng cơ chế với nút "Tạo lại" của kịch bản): "Định dạng tổng" cho mọi nền tảng, hoặc
 *   "Định dạng theo nền tảng" cho riêng nền tảng đang xem. Cả hai đều ADAPT từ bản gốc.
 * - "Xem tổng thể" đổi qua lại giữa CHẾ ĐỘ CHỈNH và CHẾ ĐỘ XEM — chế độ xem chính là màn duyệt cũ,
 *   nên không phải quay lui bước nào để duyệt.
 * - Trạng thái khi lưu chọn ngay tại đây; mặc định là Nháp, nên "đã duyệt" luôn là hành động
 *   CÓ CHỦ ĐÍCH của người dùng chứ không bị tự gán khi lưu.
 */
export default function FinalizeStep({
  source,
  gen,
  itemId,
  baselines,
  status,
  setStatus,
  formatting,
  onFormat,
  saving,
  onSave,
  onPatchVersion,
  onBack,
  onGoSchedule,
}: {
  source: SourceSelection;
  gen: GenerationResult;
  /** Bài (ContentItem) đang tạo — cần cho API tạo lại từng phần. */
  itemId: string | null;
  /** Điểm brand voice lúc AI sinh từng version (versionId → %) để so sánh sau khi sửa. */
  baselines: Record<string, number>;
  status: ContentLifecycle;
  setStatus: (s: ContentLifecycle) => void;
  /** Lượt định dạng đang chạy (null = rảnh) — khoá nút + spinner đúng nút được bấm. */
  formatting: FormatScope | null;
  onFormat: (scope: FormatScope) => void;
  saving: boolean;
  onSave: () => void;
  onPatchVersion: (versionId: string, patch: Partial<ContentVersion>) => void;
  onBack: () => void;
  onGoSchedule: () => void;
}) {
  const { t, brandGradient } = useApp();
  const [platform, setPlatform] = useState(source.platforms[0]);
  const [viewMode, setViewMode] = useState(false);
  // Chuỗi hashtag đang gõ giữ nguyên (kể cả dấu cách cuối) — chỉ parse khi cập nhật state.
  const [hashtagDrafts, setHashtagDrafts] = useState<Record<string, string>>({});
  const voice = useBrandVoiceCheck(source.brand.id, onPatchVersion);
  const version = gen.versions.find((v) => v.platform === platform) ?? gen.versions[0] ?? null;
  // Tạo lại từng phần kịch bản cho bản nền tảng đang xem — patch merge vào version mới nhất.
  const regen = useScriptRegen(itemId, version?.id, version?.script ?? emptyScript(), (s) => {
    if (version) onPatchVersion(version.id, { script: s });
  });

  // Job format đang chạy chiếm nội dung của bản nền tảng → khoá cả hai nút, và khoá luôn ô nhập
  // của nền tảng đang bị định dạng lại (nội dung sắp bị thay).
  const busy = formatting !== null;
  const isFormatted = (p: Platform) => gen.versions.some((v) => v.platform === p && v.status === 'FORMATTED');
  const allFormatted = source.platforms.every(isFormatted);
  const missing = source.platforms.filter((p) => !isFormatted(p));

  if (!version) return null;

  const hashtagText = hashtagDrafts[version.id] ?? version.hashtags.join(' ');
  const done = isFormatted(version.platform);

  const formatBar = (
    <div style={{ background: '#faf8fe', border: '1px solid #f1edfa', borderRadius: 14, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => onFormat('all')}
          disabled={busy}
          className="btn-grad"
          title={t.cwFormatAllHint}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 11, padding: '10px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, boxShadow: '0 12px 24px -12px rgba(139,92,246,.6)', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
        >
          <span style={{ display: 'inline-flex', animation: formatting === 'all' ? 'spinslow 0.8s linear infinite' : undefined }}>
            <Icon icon={formatting === 'all' ? RefreshCw : Layers} size={14.5} stroke="#fff" />
          </span>
          {formatting === 'all' ? t.cwFormatting : t.cwFormatAll}
        </button>
        <button
          onClick={() => onFormat(version.platform)}
          disabled={busy}
          className="btn-soft"
          title={t.cwFormatOneHint}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #ece8f6', background: '#fff', borderRadius: 11, padding: '10px 16px', fontWeight: 700, fontSize: 13, color: '#7c3aed', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}
        >
          <span style={{ display: 'inline-flex', animation: formatting === version.platform ? 'spinslow 0.8s linear infinite' : undefined }}>
            <Icon icon={formatting === version.platform ? RefreshCw : Sparkles} size={14} stroke="#7c3aed" />
          </span>
          {t.cwFormatOne} · {tagOfPlatform(version.platform)}
        </button>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#8a85a0', lineHeight: 1.5 }}>{t.cwFormatHint}</div>
      {done && <div style={{ marginTop: 6, fontSize: 11.5, color: '#b45309', lineHeight: 1.5 }}>{t.cwFormatRedoNote}</div>}
    </div>
  );

  // Chế độ CHỈNH: 3 mục (Script video · Nội dung · Media prompt), ô nhập tự co giãn hết chữ.
  const editFields = (
    <>
      <GroupHeading text={t.cwTabScript} />
      <ScriptSections
        script={version.script}
        editable
        onChange={(script) => onPatchVersion(version.id, { script })}
        onRegenerateSection={regen.onRegenerateSection}
        onRegenerateScene={regen.onRegenerateScene}
        onRegenerateStep={regen.onRegenerateStep}
        regenerating={regen.regenerating}
      />

      <GroupHeading text={t.cwTabContent} />
      <label style={fieldLabel}>{t.cwTabCaption}</label>
      <AutoGrowTextarea value={version.caption} onChange={(v) => onPatchVersion(version.id, { caption: v })} minHeight={90} style={inputBase} />
      <CaptionCounter platform={version.platform} text={version.caption} />

      <label style={{ ...fieldLabel, marginTop: 16 }}>{t.cwTabHashtag}</label>
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

      <label style={{ ...fieldLabel, marginTop: 16 }}>{t.cwTabCta}</label>
      <AutoGrowTextarea value={version.cta} onChange={(v) => onPatchVersion(version.id, { cta: v })} minHeight={56} style={inputBase} />

      <GroupHeading text={t.cwTabMedia} />
      <AutoGrowTextarea value={version.mediaPrompt} onChange={(v) => onPatchVersion(version.id, { mediaPrompt: v })} minHeight={70} style={inputBase} />
    </>
  );

  const mainCard = (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.cwFinalizeTitle}</div>
          <div style={{ fontSize: 12.5, color: '#8a85a0', lineHeight: 1.5 }}>{t.cwFinalizeSub}</div>
        </div>
        {/* Toggle CHỈNH ⇄ XEM — chế độ xem chính là màn duyệt, không cần đổi bước */}
        <button
          onClick={() => setViewMode((v) => !v)}
          aria-pressed={viewMode}
          className="btn-soft"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flex: 'none', border: viewMode ? '1.5px solid #7c3aed' : '1px solid #ece8f6', background: viewMode ? '#f6f2ff' : '#fff', borderRadius: 11, padding: '9px 14px', fontSize: 12.5, fontWeight: 700, color: '#7c3aed', cursor: 'pointer' }}
        >
          <Icon icon={viewMode ? Pencil : Eye} size={14} stroke="#7c3aed" />
          {viewMode ? t.cwViewEdit : t.cwViewAll}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '16px 0 6px' }}>
        <PlatformTabs platforms={source.platforms} value={version.platform} onChange={setPlatform} />
      </div>
      {/* NFR-14: nhãn minh bạch AI + tình trạng định dạng của ĐÚNG nền tảng đang xem */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ background: TONE_COLORS.ai.bg, color: TONE_COLORS.ai.color, borderRadius: 7, padding: '2px 9px', fontSize: 10.5, fontWeight: 700 }}>✨ {t.cwAiLabel}</span>
        <span style={{ background: done ? TONE_COLORS.info.bg : TONE_COLORS.neutral.bg, color: done ? TONE_COLORS.info.color : TONE_COLORS.neutral.color, borderRadius: 7, padding: '2px 9px', fontSize: 10.5, fontWeight: 700 }}>
          {done ? t.cwFormatDone : t.cwNotFormatted}
        </span>
      </div>

      {formatBar}

      {/* Cảnh báo thiếu chỉ có nghĩa khi ĐÃ format một phần (vài nền tảng xong, vài nền tảng chưa) —
          lúc chưa format gì thì "chưa định dạng" là trạng thái bình thường, không phải lỗi.
          Đây là TRẠNG THÁI bền (khác lỗi thao tác đã chuyển qua toast) nên giữ inline. */}
      {missing.length > 0 && missing.length < source.platforms.length && (
        <div style={{ marginTop: 14, fontSize: 12.5, color: '#b45309', background: '#fdf6e7', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 }}>
          {t.cwFormatMissing}
        </div>
      )}

      {viewMode ? <div style={{ marginTop: 20 }}><VersionContent version={version} /></div> : editFields}
    </Card>
  );

  const side = (
    <>
      <SourceInfoCard info={sourceToInfo(source)} />
      <BrandVoicePanel
        check={version.brandVoice}
        busy={voice.busy}
        baselineScore={baselines[version.id]}
        onRecheck={() => voice.run(version)}
      />
      <PostImagePreview version={version} brandName={source.brand.brandName} />
      {/* Duyệt & Lưu gộp vào đây: chọn trạng thái ngay tại bước Hoàn thiện */}
      <Card style={{ padding: 20 }}>
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', marginBottom: 10 }}>{t.cwReviewStatus}</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SAVE_STATUSES.map((s) => {
            const meta = CONTENT_STATUS_META[s];
            const on = status === s;
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                aria-pressed={on}
                style={{ border: on ? `1.5px solid ${meta.color}` : '1px solid #ece8f6', background: on ? meta.bg : '#fff', color: on ? meta.color : '#574f6e', borderRadius: 10, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
              >
                {t[meta.labelKey]}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 11.5, color: '#8a85a0', lineHeight: 1.5 }}>{t.cwStatusHint}</div>
      </Card>
    </>
  );

  const action = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          disabled={saving || busy}
          onClick={onBack}
          className="btn-soft"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 'none', border: '1px solid #ece8f6', background: '#fff', borderRadius: 12, padding: '13px 18px', fontWeight: 700, fontSize: 14, color: '#574f6e', cursor: saving || busy ? 'not-allowed' : 'pointer', opacity: saving || busy ? 0.55 : 1 }}
        >
          <Icon icon={ArrowLeft} size={15} stroke="#574f6e" />{t.cwBack}
        </button>
        <button
          disabled={saving || busy}
          onClick={onSave}
          className="btn-grad"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1, border: 'none', borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, boxShadow: '0 14px 28px -12px rgba(139,92,246,.6)', cursor: saving || busy ? 'not-allowed' : 'pointer', opacity: saving || busy ? 0.6 : 1 }}
        >
          <Icon icon={Save} size={16} stroke="#fff" />
          {saving ? t.cwSaving : t.cwSave}
        </button>
      </div>
      {/* Lên lịch cần bản đã ĐỊNH DẠNG cho mọi nền tảng (backend chỉ nhận version FORMATTED) */}
      <button
        onClick={onGoSchedule}
        disabled={!allFormatted || saving || busy}
        title={allFormatted ? undefined : t.cwFormatMissing}
        className="link-underline"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', background: 'transparent', padding: 4, fontSize: 12.5, fontWeight: 700, color: '#7c3aed', cursor: !allFormatted || saving || busy ? 'not-allowed' : 'pointer', opacity: !allFormatted || saving || busy ? 0.45 : 1 }}
      >
        {t.cwNextSchedule}<Icon icon={ArrowRight} size={13} stroke="#7c3aed" />
      </button>
    </div>
  );

  return <StepLayout main={mainCard} side={side} action={action} />;
}
