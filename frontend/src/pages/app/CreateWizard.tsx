import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';

import { Icon } from '../../components/ui.tsx';
import PageContainer from '../../components/PageContainer.tsx';
import type { ApiError } from '../../api/apiClient.ts';
import { withToast } from '../../utils/toastFlow';
import {
  type ContentLifecycle,
  ERR_CONTENT_ITEM_NOT_DRAFT,
  ERR_CONTENT_ITEM_NOT_FOUND,
  ERR_CONTENT_ITEM_ID_REQUIRED,
  ERR_TOKEN_QUOTA_EXCEEDED,
} from '../../api/contentGeneration.ts';
import type { Platform } from '../../api/brandProfile.ts';
import {
  createContentItem,
  generateVersion,
  saveContent,
  saveVersions,
  formatContent,
  deleteContent,
  getWizardResume,
  saveWizardState,
  type ContentVersion,
  type GenerationResult,
  type SaveVersionInput,
  type WizardDraft,
} from '../../api/contentCreationService.ts';
import type { PlatformRun } from '../../components/create/steps/GenerateStep.tsx';
import WizardStepper, { type WizardStep } from '../../components/create/WizardStepper.tsx';
import { WizardStepSkeleton } from '../../components/create/CreateSkeleton.tsx';
import SourceStep, { type SourceSelection, type WizardLiveSelection } from '../../components/create/steps/SourceStep.tsx';
import GenerateStep from '../../components/create/steps/GenerateStep.tsx';
import FinalizeStep, { type FormatScope } from '../../components/create/steps/FinalizeStep.tsx';
import ScheduleStep from '../../components/create/steps/ScheduleStep.tsx';
import { useToast } from '../../components/toast/ToastProvider';

/**
 * /create/new — lớp 2: wizard timeline 4 mốc (trang riêng, không modal):
 * 1 Chọn nguồn → 2 AI tạo nội dung → 3 Chỉnh sửa & Hoàn Thiện → 4 Lên lịch (mở tab Lịch đăng bài).
 *
 * Mốc 3 gộp ba mốc cũ (Định dạng · Chỉnh sửa · Duyệt & Lưu): định dạng giờ là NÚT trong không gian
 * chỉnh sửa, còn duyệt/lưu là toggle "Xem tổng thể" + chọn trạng thái tại chỗ — không phải quay lui
 * giữa các bước. "Thứ được duyệt = thứ được đăng" vẫn giữ: bản đem lên lịch là bản FORMATTED đang
 * hiển thị, và trạng thái duyệt chỉ gắn khi người dùng tự chọn.
 */
export default function CreateWizard() {
  const { t, go } = useApp();
  const toast = useToast();

  // Bài DRAFT dở từ danh sách ("Tiếp tục"): draftId = id bài. Nạp trạng thái wizard đã
  // auto-save (bước đang dừng + id nguồn) + các bản nền tảng đã sinh; SourceStep vẫn tự fetch
  // dữ liệu MỚI NHẤT (không dùng bản chụp cũ — hồ sơ/chiến lược vừa sửa hiện đúng).
  const draftId = (useLocation().state as { draftId?: string } | null)?.draftId;
  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(!!draftId);
  // Bước đang dở cần nhảy tới sau khi SourceStep tự xác nhận nguồn (resume bước ≥2).
  const resumeStepRef = useRef<WizardStep | null>(null);

  const [step, setStep] = useState<WizardStep>(1);
  const [maxReached, setMaxReached] = useState<WizardStep>(1);
  const [source, setSource] = useState<SourceSelection | null>(null);
  // Lựa chọn ĐANG DỞ ở mốc 1 (SourceStep báo khi user đổi) — nguồn cho auto-save trước khi Next.
  const [liveSel, setLiveSel] = useState<WizardLiveSelection | null>(null);
  // B2: bài (ContentItem) tạo khi user bắt đầu chọn nguồn (auto-save) hoặc lượt generate đầu —
  // mọi job/nền tảng ghi version vào đây, "Tạo lại" tái dùng. Đổi nguồn → thay bằng bài mới.
  const [itemId, setItemId] = useState<string | null>(null);
  const itemIdRef = useRef<string | null>(null);
  useEffect(() => { itemIdRef.current = itemId; }, [itemId]);
  const savedRef = useRef(false);
  // Chiến lược mà bài hiện tại được tạo theo — đổi chiến lược thì bài cũ không còn khớp nguồn.
  const itemStrategyRef = useRef<string | null>(null);
  const creatingRef = useRef<Promise<string> | null>(null);

  // Tạo bài shell DRAFT đúng MỘT lần — dùng chung cho auto-save + generate (chống race).
  const ensureItem = (strategyId: string, ideaId?: string): Promise<string> => {
    if (itemIdRef.current) return Promise.resolve(itemIdRef.current);
    if (!creatingRef.current) {
      creatingRef.current = createContentItem(strategyId, ideaId)
        .then((id) => {
          setItemId(id);
          itemIdRef.current = id;
          itemStrategyRef.current = strategyId;
          return id;
        })
        .finally(() => { creatingRef.current = null; });
    }
    return creatingRef.current;
  };

  // Đổi nguồn → bài cũ (chưa lưu) không còn khớp: xóa mềm rồi reset để auto-save tạo bài mới.
  // KHÔNG còn xóa khi rời wizard — bài dở là nháp hợp lệ, hiện trong danh sách với nút "Tiếp tục".
  const dropItem = () => {
    const id = itemIdRef.current;
    itemIdRef.current = null;
    itemStrategyRef.current = null;
    setItemId(null);
    if (id && !savedRef.current) void deleteContent(id).catch(() => {});
  };

  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    getWizardResume(draftId)
      .then((res) => {
        if (cancelled || !res) return;
        setDraft(res.draft);
        setItemId(draftId);
        itemIdRef.current = draftId; // ghi tiếp vào đúng bài đang dở
        if (res.versions.length > 0) {
          const resumed: GenerationResult = {
            id: `resume-${draftId}`,
            createdAt: new Date().toISOString(),
            versions: res.versions,
          };
          setGens([resumed]);
          setBaselines(Object.fromEntries(res.versions.map((v) => [v.id, v.brandVoice.score])));
        }
        if (res.draft.step > 1) resumeStepRef.current = res.draft.step;
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDraftLoading(false); });
    return () => { cancelled = true; };
  }, [draftId]);

  const [starting, setStarting] = useState(false); // đang tạo bài / khởi động lượt generate
  const startingRef = useRef(false); // guard đồng bộ chống double-click "Tạo nội dung với AI"
  const [gens, setGens] = useState<GenerationResult[]>([]);
  const [genIndex, setGenIndex] = useState(0);
  // PA1: mỗi nền tảng MỘT job backend độc lập — trạng thái run theo genId → platform.
  // Tab nào xong hiện trước; nền tảng lỗi có "Thử lại" riêng, không reset nền tảng đã xong.
  const [runsByGen, setRunsByGen] = useState<Record<string, Partial<Record<Platform, PlatformRun>>>>({});
  // Điểm brand voice lúc AI sinh từng version (versionId → %) — mốc 3/4 so sánh để
  // cảnh báo nhẹ khi người dùng sửa tay làm điểm tụt.
  const [baselines, setBaselines] = useState<Record<string, number>>({});
  // Trạng thái khi lưu — mặc định NHÁP: "đã duyệt" phải là hành động CÓ CHỦ ĐÍCH của người dùng
  // ở mốc Hoàn thiện, không được tự gắn khi họ chỉ lưu nháp.
  const [status, setStatus] = useState<ContentLifecycle>('DRAFT');
  const [saving, setSaving] = useState(false);
  // Định dạng theo nền tảng (job format thật, PA2-a) — giờ là THAO TÁC ở mốc Hoàn thiện, không còn
  // là mốc riêng. Giữ phạm vi lượt đang chạy ('all' | một nền tảng) để nút bấm hiện spinner đúng chỗ.
  // Kết quả được merge thẳng vào versions của lượt tạo hiện tại (status FORMATTED nằm trên version).
  const [formatting, setFormatting] = useState<FormatScope | null>(null);

  const goStep = (s: WizardStep) => {
    setStep(s);
    setMaxReached((m) => (s > m ? s : m));
  };

  // Nội dung đã tạo bị vô hiệu (đổi hồ sơ/chiến lược qua dialog ở mốc 1) → xóa khỏi phiên.
  // dropItem xóa mềm bài cũ để auto-save/lượt generate mới tạo BÀI mới đúng nguồn.
  const discardGenerated = () => {
    dropItem();
    setGens([]);
    setGenIndex(0);
    setRunsByGen({});
    setBaselines({});
    setMaxReached(1);
    resumeStepRef.current = null;
  };

  // Mã lỗi backend (1905/1906/1920) → thông báo rõ nghĩa, không phải lỗi chung chung.
  const generationErrorMessage = (err: ApiError): string => {
    if (err.code === ERR_CONTENT_ITEM_NOT_DRAFT) return t.cwGenItemNotDraft;
    if (err.code === ERR_CONTENT_ITEM_NOT_FOUND) return t.cwGenItemNotFound;
    if (err.code === ERR_CONTENT_ITEM_ID_REQUIRED) return t.cwGenItemMissing;
    return err.message;
  };

  const handleSourceNext = (sel: SourceSelection) => {
    // Đổi trend / bộ nền tảng sau khi đã sinh nội dung → bỏ các bản cũ (nội dung không còn
    // khớp nguồn). Đổi hồ sơ/chiến lược đã qua dialog xác nhận ở SourceStep.
    let keptGens = gens.length > 0;
    if (
      source &&
      (sel.brand.id !== source.brand.id ||
        sel.strategy.id !== source.strategy.id ||
        sel.trend?.id !== source.trend?.id ||
        sel.platforms.join() !== source.platforms.join())
    ) {
      discardGenerated();
      keptGens = false;
    } else if (!source && draft && keptGens && sel.brand.id !== draft.brandId) {
      // Resume nhưng đổi hồ sơ khác nháp → bản khôi phục không còn khớp nguồn.
      discardGenerated();
      keptGens = false;
    }
    setSource(sel);
    // Resume: đã có nội dung khôi phục → nhảy thẳng tới bước đang dừng (3/4); còn lại vào bước 2.
    const target = resumeStepRef.current;
    resumeStepRef.current = null;
    goStep(target && target >= 3 && keptGens ? target : 2);
  };

  const setRun = (genId: string, platform: Platform, run: PlatformRun) =>
    setRunsByGen((prev) => ({ ...prev, [genId]: { ...prev[genId], [platform]: run } }));

  // Chạy MỘT job cho MỘT nền tảng (API thật: start + poll) ghi version vào bài targetItemId.
  // Cập nhật state dạng hàm — chỉ đụng version của nền tảng này, các nền tảng đã xong giữ nguyên.
  const runPlatform = async (
    targetItemId: string,
    genId: string,
    platform: Platform,
    regenerateFrom?: string,
    regenNote?: string,
  ) => {
    if (!source) return;
    setRun(genId, platform, { status: 'running' });
    try {
      const version = await generateVersion({
        strategyId: source.strategy.id,
        contentItemId: targetItemId,
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
      setRun(genId, platform, { status: 'error', error: generationErrorMessage(e as ApiError) });
    }
  };

  // Lượt tạo mới (lần đầu hoặc "Tạo lại" kèm note): tạo BÀI (lần đầu) rồi 1 GenerationResult
  // + N job SONG SONG. Guard đồng bộ (startingRef) chống bấm "Tạo nội dung với AI" hai lần.
  // "Tạo lại" sinh BẢN MỚI, không ghi đè; bản trước gửi dạng TEXT (caption đúng nền tảng đó).
  const startGeneration = async (regenNote?: string) => {
    if (!source || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    // (Tái) tạo nội dung làm bản format cũ hết hiệu lực — lượt tạo mới sinh version GENERATED,
    // nên mốc Hoàn thiện sẽ tự hiện "Chưa định dạng" trở lại.
    setMaxReached((m) => (m > 2 ? 2 : m));
    try {
      // Tạo bài shell (DRAFT) một lần (dùng chung với auto-save); "Tạo lại" tái dùng bài cũ.
      const targetItemId = await ensureItem(
        source.strategy.id,
        source.trend?.kind === 'idea' ? source.trend.id : undefined,
      );
      const prevGen = gens[genIndex] ?? null;
      const genId = `gen-${Date.now()}`;
      const gen: GenerationResult = { id: genId, note: regenNote, createdAt: new Date().toISOString(), versions: [] };
      setGens((prev) => {
        setGenIndex(prev.length);
        return [...prev, gen];
      });
      for (const p of source.platforms) {
        const regenerateFrom = regenNote !== undefined ? prevGen?.versions.find((v) => v.platform === p)?.caption : undefined;
        void runPlatform(targetItemId, genId, p, regenerateFrom, regenNote);
      }
    } catch (e) {
      // Tạo bài thất bại (vd chiến lược hết ACTIVE) — báo lỗi rõ, không tạo gen, không đứng wizard.
      toast.error((e as ApiError).message || t.cwCreateItemError);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  // "Thử lại" riêng nền tảng lỗi của bản hiện tại — các nền tảng đã xong không bị đụng.
  const retryPlatform = (platform: Platform) => {
    const gen = gens[genIndex];
    if (!gen || !itemId) return;
    const idx = gens.findIndex((g) => g.id === gen.id);
    const prevGen = idx > 0 ? gens[idx - 1] : null;
    const regenerateFrom = gen.note !== undefined ? prevGen?.versions.find((v) => v.platform === platform)?.caption : undefined;
    void runPlatform(itemId, gen.id, platform, regenerateFrom, gen.note);
  };

  // Chỉnh sửa (mốc 3) / sinh ảnh / kiểm tra brand voice — MỘT đường duy nhất: các bản đã định dạng
  // được merge thẳng vào versions của lượt tạo hiện tại (thay bản cùng nền tảng), nên không còn
  // "bộ nội dung song song" để phải chọn nhánh patch.
  const patchVersion = (versionId: string, patch: Partial<ContentVersion>) => {
    setGens((prev) =>
      prev.map((g, i) =>
        i === genIndex ? { ...g, versions: g.versions.map((v) => (v.id === versionId ? { ...v, ...patch } : v)) } : g,
      ),
    );
  };

  // Bộ nội dung đang làm việc = các bản của lượt tạo hiện tại (đã gồm bản FORMATTED nếu đã định dạng).
  const workingVersions = (): ContentVersion[] => gens[genIndex]?.versions ?? [];

  // Nội dung hiện tại của các nền tảng chỉ định → payload PUT (bỏ nền tảng chưa có bản nào).
  const versionInputs = (platforms: Platform[]): SaveVersionInput[] => {
    const working = workingVersions();
    return platforms
      .map((p): SaveVersionInput | null => {
        const v = working.find((x) => x.platform === p);
        if (!v) return null;
        return {
          versionId: v.id,
          script: v.script,
          caption: v.caption,
          hashtags: v.hashtags,
          cta: v.cta,
          mediaPrompt: v.mediaPrompt,
        };
      })
      .filter((v): v is SaveVersionInput => v !== null);
  };

  // Lưu nội dung cuối vào backend: PUT từng bản nền tảng đang active + PATCH trạng thái bài.
  const persistContent = async (saveStatus: 'DRAFT' | 'NEED_REVIEW' | 'APPROVED') => {
    if (!source || !itemId) return;
    await saveContent({ itemId, status: saveStatus, versions: versionInputs(source.platforms) });
  };

  // Lưu ở mốc Hoàn thiện: PUT nội dung + gắn trạng thái người dùng đã chọn, rồi về danh sách.
  const handleSave = async () => {
    if (!source || !itemId || saving) return;
    setSaving(true);
    try {
      await withToast(persistContent(status as 'DRAFT' | 'NEED_REVIEW' | 'APPROVED'), {
        loading: 'Đang lưu nội dung...',
        success: 'Nội dung đã được lưu thành công',
        error: (e: any) => `${t.cwSaveError}: ${e.message}`,
        title: 'Lưu nội dung'
      });
      savedRef.current = true; // đã lưu (kể cả giữ Nháp có chủ đích) → KHÔNG dọn như orphan khi unmount
      go('create');
    } catch (e) {
      // toast tự hiển thị
    } finally {
      setSaving(false);
    }
  };

  // "Tiếp theo: Lên lịch" (mốc 3 → 4) — lưu bản đang hiển thị (đã định dạng + chỉnh sửa tay) kèm
  // trạng thái, rồi sang mốc Lịch. Bản FORMATTED là điều kiện lên lịch (nút đã chặn nếu còn thiếu).
  const handleGoSchedule = async () => {
    if (!source || !itemId || saving) return;
    setSaving(true);
    try {
      await withToast(persistContent(status as 'DRAFT' | 'NEED_REVIEW' | 'APPROVED'), {
        loading: 'Đang lưu trạng thái bài viết...',
        success: 'Trạng thái đã được cập nhật',
        error: (e: any) => `${t.cwSaveError}: ${e.message}`,
        title: 'Cập nhật trạng thái'
      });
      savedRef.current = true;
      goStep(4);
    } catch (e) {
      // toast xử lý
    } finally {
      setSaving(false);
    }
  };

  /**
   * Nút "Định dạng tổng" / "Định dạng theo nền tảng" ở mốc Hoàn thiện (FR-40..FR-46).
   * ADAPT: backend chuyển thể bản gốc sang đặc thù từng nền tảng (giữ thông điệp + ý định CTA).
   *
   * LƯU NGẦM TRƯỚC KHI FORMAT: job format đọc bản nguồn từ DB chứ không nhận nội dung từ FE. Vì
   * chỉnh sửa tay giờ diễn ra CÙNG bước với nút định dạng, không PUT trước thì AI sẽ chuyển thể
   * bản cũ và chỉnh sửa của người dùng bị bỏ qua trong im lặng.
   * Kết quả merge theo nền tảng — các nền tảng không nằm trong lượt này giữ nguyên bản ở FE.
   * Hết hạn mức token → báo riêng.
   */
  const handleFormat = async (scope: FormatScope) => {
    if (!source || !itemId || formatting) return;
    const targets = scope === 'all' ? source.platforms : [scope];
    setFormatting(scope);
    try {
      await saveVersions(itemId, versionInputs(targets));
      
      const versions = await withToast(formatContent(itemId, targets), {
        loading: 'AI đang định dạng nội dung...',
        success: 'Định dạng nội dung thành công',
        error: (e: any) => e.code === ERR_TOKEN_QUOTA_EXCEEDED ? t.cwFormatQuota : e.message || t.cwFormatError,
        title: 'Định dạng AI'
      });
      
      setGens((prev) =>
        prev.map((g, i) => {
          if (i !== genIndex) return g;
          const byPlatform = new Map(versions.map((v) => [v.platform, v]));
          const merged = g.versions.map((v) => byPlatform.get(v.platform) ?? v);
          const added = versions.filter((v) => !g.versions.some((x) => x.platform === v.platform));
          return { ...g, versions: [...merged, ...added] };
        }),
      );
      setBaselines((prev) => ({
        ...prev,
        ...Object.fromEntries(versions.map((v) => [v.id, v.brandVoice.score])),
      }));
    } catch (e) {
      // error handled by withToast
    } finally {
      setFormatting(null);
    }
  };

  // ===== C — auto-save trạng thái wizard (debounce ~1s) =====
  // Đã chọn chiến lược là có bài DRAFT (ensureItem) + PATCH bước/nguồn xuống DB — reload hay
  // đổi thiết bị vẫn "Tiếp tục" đúng chỗ. Trước khi Next, snapshot lấy từ liveSel (SourceStep
  // chỉ báo khi USER đổi); từ mốc 2 trở đi source là nguồn chính. Lỗi nuốt ngầm.
  const wizardSnapshot = () => {
    const strategyId = source?.strategy.id ?? liveSel?.strategyId;
    if (!strategyId) return null;
    const trendId = source ? (source.trend?.kind === 'trend' ? source.trend.id : undefined) : liveSel?.trendId;
    const ideaId = source ? (source.trend?.kind === 'idea' ? source.trend.id : undefined) : liveSel?.ideaId;
    return {
      strategyId,
      ideaId,
      state: {
        // Kẹp về 3: không bao giờ resume thẳng vào mốc 4 (Lên lịch) — mốc đó cần nội dung đã lưu.
        step: Math.min(step, 3) as 1 | 2 | 3,
        platforms: source?.platforms ?? liveSel?.platforms,
        trendId,
        ideaId,
        note: (source ? source.aiNote : liveSel?.note) || undefined,
      },
    };
  };
  const snapshotRef = useRef(wizardSnapshot);
  snapshotRef.current = wizardSnapshot;

  const persistWizard = async () => {
    if (savedRef.current) return;
    const snap = snapshotRef.current();
    if (!snap) return;
    try {
      // Đổi chiến lược sau khi bài đã tạo → bài cũ không khớp nguồn: thay bằng bài mới.
      if (itemIdRef.current && itemStrategyRef.current && itemStrategyRef.current !== snap.strategyId) dropItem();
      // Bài resume chưa biết chiến lược gốc (không lưu trên bài) → nhận chiến lược hiện tại.
      if (itemIdRef.current && !itemStrategyRef.current) itemStrategyRef.current = snap.strategyId;
      const id = await ensureItem(snap.strategyId, snap.ideaId);
      await saveWizardState(id, snap.state);
    } catch {
      // Auto-save ngầm — không chặn thao tác; lần đổi kế tiếp sẽ thử lại.
    }
  };
  const persistRef = useRef(persistWizard);
  persistRef.current = persistWizard;

  const autoSaveKey = JSON.stringify([
    step,
    source ? [source.strategy.id, source.platforms, source.trend?.id, source.aiNote] : null,
    liveSel,
  ]);
  useEffect(() => {
    const timer = setTimeout(() => { void persistRef.current(); }, 1000);
    return () => clearTimeout(timer);
  }, [autoSaveKey]);
  // Rời wizard (điều hướng SPA) → flush ngay bản auto-save cuối (fire-and-forget).
  useEffect(() => () => { void persistRef.current(); }, []);

  const gen = gens[genIndex] ?? null;
  // Mốc 3+ cần đã có nội dung — thiếu thì quay về mốc tương ứng.
  const effectiveStep: WizardStep = step >= 3 && !gen ? 2 : step >= 2 && !source ? 1 : step;

  return (
    <PageContainer>
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
            generatedSource={
              gens.length > 0
                ? source
                  ? { brandId: source.brand.id, strategyId: source.strategy.id }
                  : draft?.brandId
                    ? { brandId: draft.brandId, strategyId: null } // resume: chiến lược gốc không lưu trên bài
                    : null
                : null
            }
            autoNext={!!draft && draft.step > 1}
            onDiscardGenerated={discardGenerated}
            onSelectionChange={setLiveSel}
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
          starting={starting}
          onGenerate={() => startGeneration()}
          onRegenerate={(note) => startGeneration(note)}
          onRetryPlatform={retryPlatform}
          onPatchVersion={patchVersion}
          onBack={() => goStep(1)}
          onNext={() => gen && goStep(3)}
        />
      )}
      {effectiveStep === 3 && source && gen && (
        <FinalizeStep
          source={source}
          gen={gen}
          itemId={itemId}
          baselines={baselines}
          status={status}
          setStatus={setStatus}
          formatting={formatting}
          onFormat={handleFormat}
          saving={saving}
          onSave={handleSave}
          onPatchVersion={patchVersion}
          onBack={() => goStep(2)}
          onGoSchedule={handleGoSchedule}
        />
      )}
      {effectiveStep === 4 && (
        // Preview lấy theo nền tảng ĐẦU TIÊN người dùng chọn — không phụ thuộc thứ tự version
        // trong lượt tạo (thứ tự đó đổi theo lượt "Tạo lại"/định dạng từng nền tảng).
        <ScheduleStep
          version={gen?.versions.find((v) => v.platform === source?.platforms[0]) ?? gen?.versions[0] ?? null}
          brandName={source?.brand.brandName ?? ''}
        />
      )}
    </PageContainer>
  );
}
