import { useState } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Card, Icon, Loader } from '../../ui';
import type { Platform } from '../../../api/brandProfile';
import {
  generateImage,
  type ContentVersion,
  type GenerationResult,
} from '../../../api/contentCreationService';
import type { ApiError } from '../../../api/apiClient';
import type { SourceSelection } from './SourceStep';
import { TONE_COLORS } from '../../../statusTokens';
import StepLayout from '../StepLayout';
import SourceContextChip from '../SourceContextChip';
import PlatformTabs, { type PlatformRunStatus } from '../PlatformTabs';
import VersionContent from '../VersionContent';
import BrandVoicePanel from '../BrandVoicePanel';
import PostImagePreview from '../PostImagePreview';
import { useBrandVoiceCheck } from '../useBrandVoiceCheck';

/** Trạng thái job của MỘT nền tảng trong một lượt tạo (PA1 — job độc lập). */
export interface PlatformRun {
  status: PlatformRunStatus;
  error?: string;
}

/**
 * Mốc 2 — AI tạo nội dung qua backend THẬT theo PA1: mỗi nền tảng MỘT job song song,
 * poll riêng. Mỗi tab (FB/IG/Threads) có trạng thái độc lập — đang tạo / xong / lỗi —
 * tab nào xong hiện nội dung trước, nền tảng lỗi có nút "Thử lại" riêng (không đụng
 * nội dung các nền tảng đã xong). "Tạo lại" mở ô ghi chú → sinh BẢN MỚI cho mọi nền tảng.
 */
export default function GenerateStep({
  source,
  gens,
  genIndex,
  setGenIndex,
  runs,
  starting,
  startError,
  onGenerate,
  onRegenerate,
  onRetryPlatform,
  onPatchVersion,
  onBack,
  onNext,
}: {
  source: SourceSelection;
  gens: GenerationResult[];
  genIndex: number;
  setGenIndex: (i: number) => void;
  /** Trạng thái run theo nền tảng của BẢN đang xem (rỗng với bản đã hoàn tất từ trước). */
  runs: Partial<Record<Platform, PlatformRun>>;
  /** Đang tạo bài / khởi động lượt generate — khoá nút "Tạo nội dung với AI" (chống double-click). */
  starting: boolean;
  /** Lỗi khi tạo bài (trước khi có job nào) — hiển thị cạnh nút tạo. */
  startError: string | null;
  onGenerate: () => void;
  onRegenerate: (note: string) => void;
  onRetryPlatform: (platform: Platform) => void;
  onPatchVersion: (versionId: string, patch: Partial<ContentVersion>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t, brandGradient } = useApp();
  const gen = gens[genIndex] ?? null;
  const [platform, setPlatform] = useState(source.platforms[0]);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenNote, setRegenNote] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const voice = useBrandVoiceCheck(source.brand.id, onPatchVersion);

  const version = gen?.versions.find((v) => v.platform === platform) ?? null;
  const run = runs[platform];
  // Khoá "Tạo lại"/"Thử lại" khi còn job chạy HOẶC đang khởi động lượt mới (chống double-fire).
  const busy = starting || Object.values(runs).some((r) => r?.status === 'running');
  const anyRunning = busy;
  // Tiếp tục chỉ mở khi MỌI nền tảng của bài đã có version (nền tảng lỗi phải thử lại
  // hoặc quay về mốc 1 bỏ chọn) và không còn job đang chạy.
  const allDone = !!gen && source.platforms.every((p) => gen.versions.some((v) => v.platform === p));
  const statuses = Object.fromEntries(
    Object.entries(runs).filter(([, r]) => r).map(([p, r]) => [p, r!.status]),
  ) as Partial<Record<Platform, PlatformRunStatus>>;

  const runGenerateImage = async () => {
    if (!version || imageBusy) return;
    setImageBusy(true);
    setImageError(null);
    try {
      const { imageUrl } = await generateImage({ platform: version.platform, mediaPrompt: version.mediaPrompt });
      onPatchVersion(version.id, { imageUrl });
    } catch (e) {
      setImageError(`${t.cwGenImageError}: ${(e as ApiError).message}`);
    } finally {
      setImageBusy(false);
    }
  };

  // Cột trái — vùng nội dung. Chưa có lượt nào: nút gọi AI đặt TRONG khung; có rồi:
  // nội dung theo tab, từng tab trạng thái riêng.
  const mainCard = (
    <Card>
      {!gen ? (
        starting ? (
          <Loader label={t.cwGenerating} />
        ) : (
          <div style={{ textAlign: 'center', padding: '28px 8px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(150deg,#f6f2ff,#fcf1fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon icon={Sparkles} size={28} stroke="#a78bfa" />
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: '#211c38' }}>{t.cwStep2}</div>
            <div style={{ fontSize: 13, color: '#8a85a0', margin: '8px auto 20px', maxWidth: 380, lineHeight: 1.55 }}>{t.cwGenIntro}</div>
            {startError && (
              <div style={{ margin: '0 auto 14px', maxWidth: 380, fontSize: 12.5, color: '#d1435b', background: '#fdf1f3', borderRadius: 10, padding: '10px 12px' }}>{startError}</div>
            )}
            <button onClick={onGenerate} disabled={starting} className="btn-grad" style={{ border: 'none', borderRadius: 12, padding: '13px 26px', fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, boxShadow: '0 14px 28px -12px rgba(139,92,246,.6)', cursor: starting ? 'not-allowed' : 'pointer', opacity: starting ? 0.6 : 1 }}>
              {t.cwGenBtn}
            </button>
          </div>
        )
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <PlatformTabs
              platforms={source.platforms}
              value={platform}
              onChange={setPlatform}
              statuses={statuses}
              statusLabels={{ running: t.cwGenStatusRunning, done: t.cwGenStatusDone, error: t.cwGenStatusError }}
            />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {/* Các bản đã sinh — "Tạo lại" thêm bản mới, bản cũ giữ nguyên */}
              {gens.map((g, i) => (
                <button
                  key={g.id}
                  onClick={() => setGenIndex(i)}
                  title={g.note}
                  style={{ border: i === genIndex ? '1.5px solid #8b5cf6' : '1px solid #ece8f6', background: i === genIndex ? '#f6f1ff' : '#fff', color: i === genIndex ? '#6d28d9' : '#574f6e', borderRadius: 9, padding: '6px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {t.cwVersion} {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* NFR-14: nhãn minh bạch AI + nhãn tối ưu theo nền tảng */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ background: TONE_COLORS.ai.bg, color: TONE_COLORS.ai.color, borderRadius: 7, padding: '2px 9px', fontSize: 10.5, fontWeight: 700 }}>✨ {t.cwAiLabel} · {t.cwVersion} {genIndex + 1}/{gens.length}</span>
            <span style={{ background: '#e0f7fb', color: '#0e7490', borderRadius: 7, padding: '2px 9px', fontSize: 10.5, fontWeight: 700 }}>{t.cwOptimizedPer}</span>
          </div>

          {/* Ghi chú của bản hiện tại (nhập lúc "Tạo lại") */}
          {gen.note && (
            <div style={{ marginBottom: 14, fontSize: 12, color: '#6b6680', background: '#faf8fe', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: '#574f6e' }}>{t.cwVersionNote}:</span> {gen.note}
            </div>
          )}

          {/* Panel theo tab: đang tạo / lỗi + Thử lại / nội dung — độc lập từng nền tảng */}
          {run?.status === 'running' ? (
            <Loader label={t.cwGenerating} />
          ) : run?.status === 'error' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 0' }}>
              <div style={{ fontSize: 13, color: '#d1435b', background: '#fdf1f3', borderRadius: 12, padding: '12px 14px', lineHeight: 1.55 }}>
                {t.cwGenPlatformError}{run.error ? `: ${run.error}` : ''}
              </div>
              <button
                onClick={() => onRetryPlatform(platform)}
                disabled={busy}
                className="btn-grad"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'flex-start', border: 'none', borderRadius: 11, padding: '10px 20px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
              >
                <Icon icon={RefreshCw} size={14} stroke="#fff" />{t.cwRetry}
              </button>
            </div>
          ) : version ? (
            <VersionContent version={version} />
          ) : null}

          {/* Tạo lại: mở ô ghi chú → sinh BẢN MỚI cho mọi nền tảng */}
          <div style={{ marginTop: 18, borderTop: '1px solid #f1edfa', paddingTop: 16 }}>
            {regenOpen ? (
              <>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', marginBottom: 8 }}>{t.cwRegenNote}</label>
                <textarea
                  value={regenNote}
                  onChange={(e) => setRegenNote(e.target.value)}
                  placeholder={t.cwRegenNotePh}
                  style={{ width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '11px 14px', fontSize: 13.5, color: '#241f3a', background: '#fbfaff', outline: 'none', resize: 'vertical', minHeight: 70 }}
                />
                <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 6 }}>{t.cwRegenHint}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    disabled={anyRunning}
                    onClick={() => { onRegenerate(regenNote); setRegenOpen(false); setRegenNote(''); }}
                    className="btn-grad"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 11, padding: '10px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: anyRunning ? 'not-allowed' : 'pointer', opacity: anyRunning ? 0.6 : 1 }}
                  >
                    <Icon icon={RefreshCw} size={14} stroke="#fff" />{t.cwRegenRun}
                  </button>
                  <button onClick={() => setRegenOpen(false)} className="btn-soft" style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 13, color: '#574f6e', cursor: 'pointer' }}>
                    {t.cancel}
                  </button>
                </div>
              </>
            ) : (
              <button
                disabled={anyRunning}
                onClick={() => setRegenOpen(true)}
                className="btn-soft"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #ece8f6', background: '#fff', borderRadius: 11, padding: '10px 16px', fontWeight: 700, fontSize: 13, color: '#7c3aed', cursor: anyRunning ? 'not-allowed' : 'pointer', opacity: anyRunning ? 0.5 : 1 }}
              >
                <Icon icon={RefreshCw} size={14} stroke="#7c3aed" />{t.cwRegen}
              </button>
            )}
          </div>
        </>
      )}
    </Card>
  );

  // Cột phải — chip ngữ cảnh nguồn + brand voice + preview của TAB đang chọn.
  const side = (
    <>
      <SourceContextChip source={source} />
      <BrandVoicePanel
        check={version?.brandVoice ?? null}
        busy={voice.busy}
        error={voice.error}
        onRecheck={version ? () => voice.run(version) : undefined}
      />
      <PostImagePreview
        version={version}
        brandName={source.brand.brandName}
        imageBusy={imageBusy}
        imageError={imageError}
        onGenerateImage={version ? runGenerateImage : undefined}
      />
    </>
  );

  const action = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onBack}
          className="btn-soft"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 'none', border: '1px solid #ece8f6', background: '#fff', borderRadius: 12, padding: '13px 18px', fontWeight: 700, fontSize: 14, color: '#574f6e', cursor: 'pointer' }}
        >
          <Icon icon={ArrowLeft} size={15} stroke="#574f6e" />{t.cwBack}
        </button>
        <button
          disabled={!allDone || anyRunning}
          onClick={onNext}
          className="btn-grad"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1, border: 'none', borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, cursor: !allDone || anyRunning ? 'not-allowed' : 'pointer', opacity: !allDone || anyRunning ? 0.55 : 1 }}
        >
          {t.cwNext}<Icon icon={ArrowRight} size={16} stroke="#fff" />
        </button>
      </div>
      {gen && (!allDone || anyRunning) && (
        <div style={{ fontSize: 11.5, color: '#a59fbb', textAlign: 'center' }}>{t.cwGenAllDoneHint}</div>
      )}
    </div>
  );

  return <StepLayout main={mainCard} side={side} action={action} />;
}
