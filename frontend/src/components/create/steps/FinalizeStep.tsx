import { useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Eye, ImagePlus, Info, Layers, Pencil, RefreshCw, Save, Sparkles } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Card, Icon } from '../../ui';
import type { ApiError } from '../../../api/apiClient';
import type { SaveReviewChoice } from '../../../api/contentCreationService';
import type { Platform } from '../../../api/brandProfile';
import { emptyScript, generateImage, type ContentVersion, type GenerationResult, type VideoScript } from '../../../api/contentCreationService';
import type { SourceSelection } from './SourceStep';
import { TONE_COLORS } from '../../../statusTokens';
import StepLayout from '../StepLayout';
import SourceInfoCard, { sourceToInfo } from '../SourceInfoCard';
import PlatformTabs, { tagOfPlatform, type PlatformReadyDot } from '../PlatformTabs';
import ScriptSections from '../ScriptSections';
import VersionContent from '../VersionContent';
import PostImagePreview from '../PostImagePreview';
import BrandVoicePanel from '../BrandVoicePanel';
import AutoGrowTextarea from '../AutoGrowTextarea';
import ConfirmModal from '../../ConfirmModal';
import { SAVE_CHOICE_META } from '../statusMeta';
import { CaptionCounter, HashtagCounter, parseHashtags } from '../platformLimits';
import { useBrandVoiceCheck } from '../useBrandVoiceCheck';
import { useScriptRegen } from '../useScriptRegen';
import { useToast } from '../../toast/ToastProvider';
import ReadinessChecklist from '../ReadinessChecklist';
import { isFormatted, useReadiness, versionOf, type ReadinessIssue } from '../useReadiness';

/** Phạm vi một lượt định dạng: 'all' = mọi nền tảng đang chọn, hoặc đúng MỘT nền tảng. */
export type FormatScope = 'all' | Platform;

// Trạng thái được phép gắn khi lưu (theo state machine: trước khi vào pipeline đăng).
const SAVE_STATUSES: SaveReviewChoice[] = ['DRAFT', 'NEED_REVIEW', 'APPROVED'];
const PLATFORM_NAME: Record<Platform, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };

const fieldLabel = { display: 'block', fontSize: 11.5, fontWeight: 700, color: '#a59fbb', marginBottom: 6 } as const;
const inputBase = {
  width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '11px 14px',
  fontSize: 13.5, lineHeight: 1.55, color: '#241f3a', background: '#fbfaff', outline: 'none',
} as const;

type SectionKey = 'script' | 'media';

/** Số phân đoạn (mở đầu + các bước + kết) và tổng thời lượng (mốc giây lớn nhất trong timing) của kịch bản. */
function scriptMeta(s: VideoScript): { segments: number; seconds: number | null } {
  const segments = [s.hook.content, ...s.steps.map((st) => st.content), s.cta.content].filter((c) => c.trim()).length;
  const nums = [s.hook.timing, s.cta.timing].join(' ').match(/\d+/g)?.map(Number) ?? [];
  return { segments, seconds: nums.length ? Math.max(...nums) : null };
}

/** Khối có thể thu gọn ở cột chỉnh sửa. `open === undefined` → luôn mở, không có nút thu gọn. */
function Section({ title, meta, open, onToggle, children }: {
  title: string;
  meta?: string | null;
  open?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  const { t } = useApp();
  const collapsible = open !== undefined && !!onToggle;
  const shown = !collapsible || open;
  const head = (
    <>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: '#211c38' }}>{title}</span>
      {meta && <span style={{ fontSize: 12, fontWeight: 600, color: '#8a85a0' }}>{meta}</span>}
      <span aria-hidden style={{ flex: 1 }} />
      {collapsible && <Icon icon={open ? ChevronUp : ChevronDown} size={16} stroke="#a59fbb" />}
    </>
  );
  return (
    <section style={{ border: '1px solid #f1edfa', borderRadius: 16, background: '#fff' }}>
      {collapsible ? (
        <button type="button" onClick={onToggle} aria-expanded={open} title={open ? t.cwSecCollapse : t.cwSecExpand}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', padding: '14px 16px', cursor: 'pointer', textAlign: 'left', font: 'inherit', borderRadius: 16 }}>
          {head}
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>{head}</div>
      )}
      {shown && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </section>
  );
}

/**
 * Mốc 3 — Chỉnh sửa & Hoàn Thiện: gộp ba mốc cũ (Định dạng · Chỉnh sửa · Duyệt & Lưu) vào MỘT bước.
 *
 * - Cột trái: tab nền tảng (chấm xanh = sẵn sàng lên lịch, cam = cần xử lý) + 3 khối: "Script video" (thu gọn
 *   sẵn khi đã có nội dung), "Nội dung đăng" (luôn mở; thanh định dạng gọn ở đầu khối), "Media".
 *   Định dạng là THAO TÁC bằng nút: "Định dạng tổng" cho mọi nền tảng, hoặc riêng nền tảng đang xem — cả hai ADAPT
 *   từ bản gốc; định dạng lại bản đã định dạng phải xác nhận (chỉnh sửa tay sẽ mất).
 * - Cột phải (dính khi cuộn): xem trước → checklist sẵn sàng → trạng thái khi lưu → nút; cuối cùng là tóm tắt
 *   "Thông tin nguồn" + "Kiểm tra brand voice" (thu gọn).
 * - Nút chính "Tiếp theo: Lên lịch" LƯU rồi mới sang mốc 4 (lưu lỗi thì ở lại, toast báo lỗi). Trạng thái khi lưu
 *   mặc định Nháp — "đã duyệt" luôn là hành động CÓ CHỦ ĐÍCH của người dùng.
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
  status: SaveReviewChoice;
  setStatus: (s: SaveReviewChoice) => void;
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
  const toast = useToast();
  const [platform, setPlatform] = useState(source.platforms[0]);
  const [viewMode, setViewMode] = useState(false);
  // Chuỗi hashtag đang gõ giữ nguyên (kể cả dấu cách cuối) — chỉ parse khi cập nhật state.
  const [hashtagDrafts, setHashtagDrafts] = useState<Record<string, string>>({});
  const voice = useBrandVoiceCheck(source.brand.id, onPatchVersion);
  const readiness = useReadiness(source.platforms, gen.versions, status);
  const version = versionOf(gen.versions, platform) ?? gen.versions[0] ?? null;
  // "Script video" thu gọn sẵn khi kịch bản đã có nội dung (quyết định một lần lúc vào bước).
  const [openSec, setOpenSec] = useState<Record<SectionKey, boolean>>(() => ({
    script: !version || scriptMeta(version.script).segments === 0,
    media: true,
  }));
  const [confirmFormat, setConfirmFormat] = useState<FormatScope | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  // Tạo lại từng phần kịch bản cho bản nền tảng đang xem — patch merge vào version mới nhất.
  const regen = useScriptRegen(itemId, version?.id, version?.script ?? emptyScript(), (s) => {
    if (version) onPatchVersion(version.id, { script: s });
  });

  // Job format đang chạy chiếm nội dung của bản nền tảng → khoá cả hai nút.
  const busy = formatting !== null;
  // MỘT nguồn "đã định dạng": bản đang sửa (versionOf) — tab, thanh định dạng và checklist đọc cùng một giá trị.
  const formattedOf = (p: Platform) => readiness.byPlatform[p]?.formatted ?? isFormatted(versionOf(gen.versions, p));
  const missing = source.platforms.filter((p) => !formattedOf(p));

  if (!version) return null;

  const hashtagText = hashtagDrafts[version.id] ?? version.hashtags.join(' ');
  const done = formattedOf(version.platform);
  const script = scriptMeta(version.script);
  const scriptMetaText = script.segments > 0
    ? [t.cwScriptSegments.replace('{n}', String(script.segments)), script.seconds ? t.cwScriptDuration.replace('{n}', String(script.seconds)) : null].filter(Boolean).join(' · ')
    : null;

  // Định dạng lại bản ĐÃ định dạng sẽ mất chỉnh sửa tay → hỏi trước; chưa định dạng thì chạy luôn.
  const requestFormat = (scope: FormatScope) => {
    const redo = scope === 'all' ? source.platforms.some(formattedOf) : formattedOf(scope);
    if (redo) setConfirmFormat(scope);
    else onFormat(scope);
  };

  // Mock "Sinh ảnh" dùng chung với mốc 2 (TODO(api) ở contentCreationService) — chỉ ảnh xem trước, không lưu.
  const runGenerateImage = async () => {
    if (imageBusy) return;
    setImageBusy(true);
    try {
      const { imageUrl } = await generateImage({ platform: version.platform, mediaPrompt: version.mediaPrompt });
      onPatchVersion(version.id, { imageUrl });
    } catch (e) {
      toast.error(`${t.cwGenImageError}: ${(e as ApiError).message}`);
    } finally {
      setImageBusy(false);
    }
  };

  const tabDots = Object.fromEntries(source.platforms.map((p): [Platform, PlatformReadyDot] => [
    p, readiness.byPlatform[p].issues.length === 0 && !readiness.approvalNeeded ? 'ready' : 'attention',
  ]));

  // Thanh định dạng gọn ở đầu "Nội dung đăng": trạng thái + 2 nút + (i) giải thích; cảnh báo dài vào tooltip/xác nhận.
  const formatBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: '#faf8fe', border: '1px solid #f1edfa', borderRadius: 12, padding: '8px 10px', marginBottom: 16 }}>
      <span style={{ background: done ? TONE_COLORS.info.bg : TONE_COLORS.neutral.bg, color: done ? TONE_COLORS.info.color : TONE_COLORS.neutral.color, borderRadius: 7, padding: '3px 9px', fontSize: 11.5, fontWeight: 700 }}>
        {done ? t.cwFormatDone : t.cwNotFormatted} · {tagOfPlatform(version.platform)}
      </span>
      {missing.length > 0 && missing.length < source.platforms.length && (
        <span title={t.cwFormatMissing} style={{ fontSize: 11.5, fontWeight: 600, color: '#b45309' }}>
          {missing.map((p) => tagOfPlatform(p)).join(', ')}: {t.cwNotFormatted.toLowerCase()}
        </span>
      )}
      <span aria-hidden style={{ flex: 1 }} />
      <button
        onClick={() => requestFormat(version.platform)}
        disabled={busy}
        className="btn-soft"
        title={t.cwFormatOneHint}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '7px 12px', fontWeight: 700, fontSize: 12.5, color: '#7c3aed', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}
      >
        <span style={{ display: 'inline-flex', animation: formatting === version.platform ? 'spinslow 0.8s linear infinite' : undefined }}>
          <Icon icon={formatting === version.platform ? RefreshCw : Sparkles} size={13.5} stroke="#7c3aed" />
        </span>
        {t.cwFormatOne} · {tagOfPlatform(version.platform)}
      </button>
      <button
        onClick={() => requestFormat('all')}
        disabled={busy}
        className="btn-soft"
        title={t.cwFormatAllHint}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #e3d9fb', background: '#f6f2ff', borderRadius: 10, padding: '7px 12px', fontWeight: 700, fontSize: 12.5, color: '#6d28d9', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}
      >
        <span style={{ display: 'inline-flex', animation: formatting === 'all' ? 'spinslow 0.8s linear infinite' : undefined }}>
          <Icon icon={formatting === 'all' ? RefreshCw : Layers} size={13.5} stroke="#6d28d9" />
        </span>
        {formatting === 'all' ? t.cwFormatting : t.cwFormatAll}
      </button>
      <span tabIndex={0} role="img" aria-label={`${t.cwFormatInfo} ${t.cwFormatHint}`} title={t.cwFormatHint}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 8, cursor: 'help' }}>
        <Icon icon={Info} size={15} stroke="#a59fbb" />
      </span>
    </div>
  );

  const editFields = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section title={t.cwTabScript} meta={scriptMetaText} open={openSec.script} onToggle={() => setOpenSec((o) => ({ ...o, script: !o.script }))}>
        <ScriptSections
          script={version.script}
          editable
          onChange={(s) => onPatchVersion(version.id, { script: s })}
          onRegenerateSection={regen.onRegenerateSection}
          onRegenerateScene={regen.onRegenerateScene}
          onRegenerateStep={regen.onRegenerateStep}
          regenerating={regen.regenerating}
        />
      </Section>

      <Section title={t.cwSecPost}>
        {formatBar}
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
      </Section>

      <Section title={t.cwSecMedia} open={openSec.media} onToggle={() => setOpenSec((o) => ({ ...o, media: !o.media }))}>
        <label style={fieldLabel}>{t.cwTabMedia}</label>
        <AutoGrowTextarea value={version.mediaPrompt} onChange={(v) => onPatchVersion(version.id, { mediaPrompt: v })} minHeight={70} style={inputBase} />
        <button
          onClick={runGenerateImage}
          disabled={imageBusy || !version.mediaPrompt.trim()}
          className="btn-soft"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, border: '1px solid #e3d9fb', background: '#fff', borderRadius: 10, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, color: '#6d28d9', cursor: imageBusy || !version.mediaPrompt.trim() ? 'not-allowed' : 'pointer', opacity: imageBusy || !version.mediaPrompt.trim() ? 0.55 : 1 }}
        >
          <Icon icon={ImagePlus} size={14} stroke="#6d28d9" />
          {imageBusy ? t.cwGenImageBusy : t.cwGenImage}
        </button>
      </Section>
    </div>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '16px 0' }}>
        <PlatformTabs platforms={source.platforms} value={version.platform} onChange={setPlatform}
          readiness={tabDots} readinessLabels={{ ready: t.cwTabReady, attention: t.cwTabAttention }} />
        {/* NFR-14: nhãn minh bạch AI */}
        <span style={{ marginLeft: 'auto', background: TONE_COLORS.ai.bg, color: TONE_COLORS.ai.color, borderRadius: 7, padding: '2px 9px', fontSize: 10.5, fontWeight: 700 }}>✨ {t.cwAiLabel}</span>
      </div>

      {viewMode ? <VersionContent version={version} /> : editFields}
    </Card>
  );

  // Cột phải dính khi cuộn: xem trước → checklist → trạng thái khi lưu (cụm nút gắn ngay sau qua sideAction).
  const sideSticky = (
    <>
      <PostImagePreview version={version} brandName={source.brand.brandName} />
      <ReadinessChecklist
        platforms={source.platforms}
        readiness={readiness}
        busy={busy}
        onFormat={requestFormat}
        onApprove={() => setStatus('APPROVED')}
      />
      <Card style={{ padding: 16 }}>
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', marginBottom: 10 }}>{t.cwReviewStatus}</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SAVE_STATUSES.map((s) => {
            const meta = SAVE_CHOICE_META[s];
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

  // Không nền tảng nào đủ điều kiện → vẫn cho sang mốc 4, nhưng nhắc lý do ngay dưới nút.
  const issueText = (p: Platform, issue: ReadinessIssue) => ({
    IG_MEDIA: t.rdShortIg, NOT_FORMATTED: t.rdShortNotFormatted, NO_ACCOUNT: t.rdShortNoAccount, VOICE_LOW: t.rdShortVoice,
  }[issue].replace('{p}', PLATFORM_NAME[p]));
  const noEligible = readiness.eligible.length === 0
    ? t.cwNoEligible.replace('{reasons}', source.platforms.map((p) => issueText(p, readiness.byPlatform[p].issues[0])).join('; '))
    : null;

  const locked = saving || busy;
  const action = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={onGoSchedule}
        disabled={locked}
        className="btn-grad"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', border: 'none', borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 14.5, color: '#fff', background: brandGradient, boxShadow: '0 14px 28px -12px rgba(139,92,246,.6)', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.6 : 1 }}
      >
        {saving ? t.cwSaving : t.cwNextSchedule}
        {!saving && <Icon icon={ArrowRight} size={16} stroke="#fff" />}
      </button>
      {noEligible && <div role="note" style={{ fontSize: 12, color: '#b45309', lineHeight: 1.5 }}>{noEligible}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={locked}
          onClick={onBack}
          className="btn-soft"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 'none', border: '1px solid #ece8f6', background: '#fff', borderRadius: 12, padding: '11px 16px', fontWeight: 700, fontSize: 13.5, color: '#574f6e', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.55 : 1 }}
        >
          <Icon icon={ArrowLeft} size={15} stroke="#574f6e" />{t.cwBack}
        </button>
        <button
          disabled={locked}
          onClick={onSave}
          className="btn-outline"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, flex: 1, border: '1.5px solid #d9cdf7', background: '#fff', borderRadius: 12, padding: '11px 14px', fontWeight: 700, fontSize: 13.5, color: '#6d28d9', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.55 : 1 }}
        >
          <Icon icon={Save} size={15} stroke="#6d28d9" />
          {t.cwSave}
        </button>
      </div>
    </div>
  );

  // Dưới cùng, mặc định thu gọn: chỉ còn 2 dòng tóm tắt.
  const sideFooter = (
    <>
      <SourceInfoCard info={sourceToInfo(source)} defaultOpen={false} />
      <BrandVoicePanel
        check={version.brandVoice}
        busy={voice.busy}
        baselineScore={baselines[version.id]}
        onRecheck={() => voice.run(version)}
        threshold={readiness.voiceThreshold}
        collapsible
      />
    </>
  );

  return (
    <>
      <StepLayout main={mainCard} sideSticky={sideSticky} sideAction={action} sideFooter={sideFooter} />
      {confirmFormat && (
        <ConfirmModal
          title={t.cwFormatRedoTitle}
          message={confirmFormat === 'all' ? t.cwFormatRedoAllNote : t.cwFormatRedoNote}
          confirmLabel={t.cwFormatRedoConfirm}
          variant="warning"
          onClose={() => setConfirmFormat(null)}
          onConfirm={() => { const scope = confirmFormat; setConfirmFormat(null); onFormat(scope); }}
        />
      )}
    </>
  );
}
