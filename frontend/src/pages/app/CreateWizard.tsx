import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { Icon } from '../../components/ui.tsx';
import type { ApiError } from '../../api/apiClient.ts';
import type { ContentLifecycle } from '../../api/contentGeneration.ts';
import type { Platform } from '../../api/brandProfile.ts';
import {
  generateVersion,
  saveContent,
  getWizardDraft,
  type ContentVersion,
  type GenerationResult,
  type WizardDraft,
} from '../../api/contentCreationService.ts';
import type { PlatformRun } from '../../components/create/steps/GenerateStep.tsx';
import WizardStepper, { type WizardStep } from '../../components/create/WizardStepper.tsx';
import { WizardStepSkeleton } from '../../components/create/CreateSkeleton.tsx';
import SourceStep, { type SourceSelection } from '../../components/create/steps/SourceStep.tsx';
import GenerateStep from '../../components/create/steps/GenerateStep.tsx';
import EditStep from '../../components/create/steps/EditStep.tsx';
import ReviewStep from '../../components/create/steps/ReviewStep.tsx';
import ScheduleStep from '../../components/create/steps/ScheduleStep.tsx';

/**
 * /create/new — lớp 2: wizard timeline 5 mốc (trang riêng, không modal).
 * 1 Chọn nguồn → 2 AI tạo nội dung → 3 Chỉnh sửa thủ công → 4 Duyệt & Lưu →
 * 5 Lên lịch (sắp có — disabled trong stepper, component đã chừa sẵn để nối
 * sang tab Lịch đăng bài).
 */
export default function CreateWizard() {
  const { t, go } = useApp();
  const { width } = useBreakpoint();
  // Bản nháp dở dang từ danh sách ("Tiếp tục"): nạp lại id đã chọn rồi để SourceStep
  // tự fetch dữ liệu MỚI NHẤT (không dùng bản chụp cũ — hồ sơ/chiến lược vừa sửa hiện đúng).
  const draftId = (useLocation().state as { draftId?: string } | null)?.draftId;
  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(!!draftId);
  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    getWizardDraft(draftId)
      .then((d) => { if (!cancelled) setDraft(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDraftLoading(false); });
    return () => { cancelled = true; };
  }, [draftId]);

  const [step, setStep] = useState<WizardStep>(1);
  const [maxReached, setMaxReached] = useState<WizardStep>(1);
  const [source, setSource] = useState<SourceSelection | null>(null);
  const [gens, setGens] = useState<GenerationResult[]>([]);
  const [genIndex, setGenIndex] = useState(0);
  // PA1: mỗi nền tảng MỘT job backend độc lập — trạng thái run theo genId → platform.
  // Tab nào xong hiện trước; nền tảng lỗi có "Thử lại" riêng, không reset nền tảng đã xong.
  const [runsByGen, setRunsByGen] = useState<Record<string, Partial<Record<Platform, PlatformRun>>>>({});
  // Điểm brand voice lúc AI sinh từng version (versionId → %) — mốc 3/4 so sánh để
  // cảnh báo nhẹ khi người dùng sửa tay làm điểm tụt.
  const [baselines, setBaselines] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<ContentLifecycle>('NEED_REVIEW');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const goStep = (s: WizardStep) => {
    setStep(s);
    setMaxReached((m) => (s > m ? s : m));
  };

  // Nội dung đã tạo bị vô hiệu (đổi hồ sơ/chiến lược qua dialog ở mốc 1) → xóa khỏi phiên.
  const discardGenerated = () => {
    setGens([]);
    setGenIndex(0);
    setRunsByGen({});
    setBaselines({});
    setMaxReached(1);
  };

  const handleSourceNext = (sel: SourceSelection) => {
    // Đổi trend / bộ nền tảng sau khi đã sinh nội dung → bỏ các bản cũ (nội dung không còn
    // khớp nguồn). Đổi hồ sơ/chiến lược đã qua dialog xác nhận ở SourceStep.
    if (
      source &&
      (sel.brand.id !== source.brand.id ||
        sel.strategy.id !== source.strategy.id ||
        sel.trend?.id !== source.trend?.id ||
        sel.platforms.join() !== source.platforms.join())
    ) {
      discardGenerated();
    }
    setSource(sel);
    goStep(2);
  };

  const setRun = (genId: string, platform: Platform, run: PlatformRun) =>
    setRunsByGen((prev) => ({ ...prev, [genId]: { ...prev[genId], [platform]: run } }));

  // Chạy MỘT job cho MỘT nền tảng (API thật: start + poll). Cập nhật state dạng hàm —
  // chỉ đụng version của nền tảng này, nội dung các nền tảng đã xong giữ nguyên.
  const runPlatform = async (genId: string, platform: Platform, regenerateFrom?: string, regenNote?: string) => {
    if (!source) return;
    setRun(genId, platform, { status: 'running' });
    try {
      const version = await generateVersion({
        strategyId: source.strategy.id,
        platform,
        // Trend/idea + ghi chú user chọn/nhập ở mốc 1 — truyền thẳng vào payload backend.
        trendId: source.trend?.kind === 'trend' ? source.trend.id : undefined,
        ideaId: source.trend?.kind === 'idea' ? source.trend.id : undefined,
        note: [source.aiNote, regenNote].filter(Boolean).join('\n') || undefined,
        regenerateFrom,
      });
      setGens((prev) =>
        prev.map((g) =>
          g.id === genId ? { ...g, versions: [...g.versions.filter((v) => v.platform !== platform), version] } : g,
        ),
      );
      setBaselines((prev) => ({ ...prev, [version.id]: version.brandVoice.score }));
      setRun(genId, platform, { status: 'done' });
    } catch (e) {
      setRun(genId, platform, { status: 'error', error: (e as ApiError).message });
    }
  };

  // Lượt tạo mới (lần đầu hoặc "Tạo lại" kèm note): 1 GenerationResult + N job SONG SONG.
  // "Tạo lại" sinh BẢN MỚI dựa trên bản hiện tại — không ghi đè; bản trước gửi dạng TEXT
  // (caption của đúng nền tảng đó), không phải id.
  const startGeneration = (regenNote?: string) => {
    if (!source) return;
    const prevGen = gens[genIndex] ?? null;
    const genId = `gen-${Date.now()}`;
    const gen: GenerationResult = { id: genId, note: regenNote, createdAt: new Date().toISOString(), versions: [] };
    setGens((prev) => {
      setGenIndex(prev.length);
      return [...prev, gen];
    });
    for (const p of source.platforms) {
      const regenerateFrom = regenNote !== undefined ? prevGen?.versions.find((v) => v.platform === p)?.caption : undefined;
      void runPlatform(genId, p, regenerateFrom, regenNote);
    }
  };

  // "Thử lại" riêng nền tảng lỗi của bản hiện tại — các nền tảng đã xong không bị đụng.
  const retryPlatform = (platform: Platform) => {
    const gen = gens[genIndex];
    if (!gen) return;
    const idx = gens.findIndex((g) => g.id === gen.id);
    const prevGen = idx > 0 ? gens[idx - 1] : null;
    const regenerateFrom = gen.note !== undefined ? prevGen?.versions.find((v) => v.platform === platform)?.caption : undefined;
    void runPlatform(gen.id, platform, regenerateFrom, gen.note);
  };

  // Chỉnh sửa (mốc 3) / sinh ảnh / kiểm tra brand voice cập nhật version trong bản hiện tại.
  const patchVersion = (versionId: string, patch: Partial<ContentVersion>) => {
    setGens((prev) =>
      prev.map((g, i) =>
        i === genIndex ? { ...g, versions: g.versions.map((v) => (v.id === versionId ? { ...v, ...patch } : v)) } : g,
      ),
    );
  };

  const handleSave = async () => {
    if (!source || !gens[genIndex] || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveContent({
        brandId: source.brand.id,
        brandName: source.brand.brandName,
        strategyId: source.strategy.id,
        trendId: source.trend?.id,
        status,
        versions: gens[genIndex].versions,
      });
      go('create');
    } catch (e) {
      setSaveError((e as ApiError).message);
      setSaving(false);
    }
  };

  const gen = gens[genIndex] ?? null;
  // Mốc 3/4 cần đã có nội dung — thiếu thì quay về mốc tương ứng.
  const effectiveStep: WizardStep = step >= 3 && !gen ? 2 : step >= 2 && !source ? 1 : step;

  return (
    <div className="view-pop" style={{ maxWidth: width >= 1440 ? 1320 : 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button onClick={() => go('create')} className="btn-soft" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, color: '#574f6e', cursor: 'pointer' }}>
          <Icon icon={ArrowLeft} size={15} stroke="#574f6e" />{t.cwBackToList}
        </button>
        <div style={{ flex: 1, minWidth: 260 }}>
          <WizardStepper current={effectiveStep} maxReached={maxReached} onGo={goStep} />
        </div>
      </div>

      {effectiveStep === 1 &&
        (draftLoading ? (
          <WizardStepSkeleton />
        ) : (
          <SourceStep
            value={source}
            draft={draft}
            draftId={draftId}
            generatedSource={gens.length > 0 && source ? { brandId: source.brand.id, strategyId: source.strategy.id } : null}
            onDiscardGenerated={discardGenerated}
            onNext={handleSourceNext}
          />
        ))}
      {effectiveStep === 2 && source && (
        <GenerateStep
          source={source}
          gens={gens}
          genIndex={genIndex}
          setGenIndex={setGenIndex}
          runs={gen ? runsByGen[gen.id] ?? {} : {}}
          onGenerate={() => startGeneration()}
          onRegenerate={(note) => startGeneration(note)}
          onRetryPlatform={retryPlatform}
          onPatchVersion={patchVersion}
          onBack={() => goStep(1)}
          onNext={() => gen && goStep(3)}
        />
      )}
      {effectiveStep === 3 && source && gen && (
        <EditStep source={source} gen={gen} baselines={baselines} onPatchVersion={patchVersion} onBack={() => goStep(2)} onNext={() => goStep(4)} />
      )}
      {effectiveStep === 4 && source && gen && (
        <ReviewStep
          source={source}
          gen={gen}
          baselines={baselines}
          status={status}
          setStatus={setStatus}
          saving={saving}
          saveError={saveError}
          onSave={handleSave}
          onPatchVersion={patchVersion}
          onBack={() => goStep(3)}
          onGoSchedule={() => goStep(5)}
        />
      )}
      {effectiveStep === 5 && <ScheduleStep version={gen?.versions[0] ?? null} brandName={source?.brand.brandName ?? ''} />}
    </div>
  );
}
