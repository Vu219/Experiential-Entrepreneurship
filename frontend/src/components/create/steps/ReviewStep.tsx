import { useState } from 'react';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Card, Icon } from '../../ui';
import type { ContentLifecycle } from '../../../api/contentGeneration';
import type { ContentVersion, GenerationResult } from '../../../api/contentCreationService';
import type { SourceSelection } from './SourceStep';
import { TONE_COLORS } from '../../../statusTokens';
import StepLayout from '../StepLayout';
import SourceContextChip from '../SourceContextChip';
import PlatformTabs from '../PlatformTabs';
import VersionContent from '../VersionContent';
import PostImagePreview from '../PostImagePreview';
import BrandVoicePanel from '../BrandVoicePanel';
import { CONTENT_STATUS_META } from '../statusMeta';
import { useBrandVoiceCheck } from '../useBrandVoiceCheck';

// Trạng thái được phép gắn khi lưu (theo state machine: trước khi vào pipeline đăng).
const SAVE_STATUSES: ContentLifecycle[] = ['DRAFT', 'NEED_REVIEW', 'APPROVED'];

/**
 * Mốc 4 — Duyệt & Lưu: xem lại bản cuối theo TỪNG nền tảng (mỗi platform một
 * ContentVersion riêng), brand voice hiện lại như xác nhận cuối, gắn trạng thái rồi
 * "Lưu & về danh sách". Kèm gợi ý bước kế tiếp: Lên lịch đăng bài (mốc 5 — sắp có).
 */
export default function ReviewStep({
  source,
  gen,
  baselines,
  status,
  setStatus,
  saving,
  saveError,
  onSave,
  onPatchVersion,
  onBack,
  onGoSchedule,
}: {
  source: SourceSelection;
  gen: GenerationResult;
  baselines: Record<string, number>;
  status: ContentLifecycle;
  setStatus: (s: ContentLifecycle) => void;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onPatchVersion: (versionId: string, patch: Partial<ContentVersion>) => void;
  onBack: () => void;
  onGoSchedule: () => void;
}) {
  const { t, brandGradient } = useApp();
  const [platform, setPlatform] = useState(source.platforms[0]);
  const voice = useBrandVoiceCheck(source.brand.id, onPatchVersion);
  const version = gen.versions.find((v) => v.platform === platform) ?? gen.versions[0];

  const mainCard = (
    <Card>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.cwReviewTitle}</div>
      <div style={{ fontSize: 12.5, color: '#8a85a0', marginBottom: 16, lineHeight: 1.5 }}>{t.cwReviewSub}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <PlatformTabs platforms={source.platforms} value={version.platform} onChange={setPlatform} />
      </div>
      {/* NFR-14: nhãn minh bạch AI + tối ưu theo nền tảng */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ background: TONE_COLORS.ai.bg, color: TONE_COLORS.ai.color, borderRadius: 7, padding: '2px 9px', fontSize: 10.5, fontWeight: 700 }}>✨ {t.cwAiLabel}</span>
        <span style={{ background: '#e0f7fb', color: '#0e7490', borderRadius: 7, padding: '2px 9px', fontSize: 10.5, fontWeight: 700 }}>{t.cwOptimizedPer}</span>
      </div>

      <VersionContent version={version} />
    </Card>
  );

  const side = (
    <>
      <SourceContextChip source={source} />
      {/* Xác nhận cuối: brand voice của bản sẽ lưu (cảnh báo nếu điểm tụt sau chỉnh sửa) */}
      <BrandVoicePanel
        check={version.brandVoice}
        busy={voice.busy}
        error={voice.error}
        baselineScore={baselines[version.id]}
        onRecheck={() => voice.run(version)}
      />
      <PostImagePreview version={version} brandName={source.brand.brandName} />
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
        {saveError && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: '#d1435b', background: '#fdf1f3', borderRadius: 10, padding: '10px 12px' }}>{t.cwSaveError}: {saveError}</div>
        )}
      </Card>
    </>
  );

  const action = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          disabled={saving}
          onClick={onBack}
          className="btn-soft"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 'none', border: '1px solid #ece8f6', background: '#fff', borderRadius: 12, padding: '13px 18px', fontWeight: 700, fontSize: 14, color: '#574f6e', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.55 : 1 }}
        >
          <Icon icon={ArrowLeft} size={15} stroke="#574f6e" />{t.cwBack}
        </button>
        <button
          disabled={saving}
          onClick={onSave}
          className="btn-grad"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1, border: 'none', borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, boxShadow: '0 14px 28px -12px rgba(139,92,246,.6)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          <Icon icon={Save} size={16} stroke="#fff" />
          {saving ? t.cwSaving : t.cwSave}
        </button>
      </div>
      {/* Gợi ý bước kế tiếp — dẫn tới mốc 5 dù đang "sắp có" */}
      <button
        onClick={onGoSchedule}
        className="link-underline"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', background: 'transparent', padding: 4, fontSize: 12.5, fontWeight: 700, color: '#7c3aed', cursor: 'pointer' }}
      >
        {t.cwNextSchedule}<Icon icon={ArrowRight} size={13} stroke="#7c3aed" />
      </button>
    </div>
  );

  return <StepLayout main={mainCard} side={side} action={action} />;
}
