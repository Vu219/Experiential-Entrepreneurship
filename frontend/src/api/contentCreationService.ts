import type { Platform } from "./brandProfile";
import type {
  ContentItemResponse,
  ContentLifecycle,
  ContentVersionResponse,
  VideoScriptResponse,
} from "./contentGeneration";
import {
  createContentItem as apiCreateContentItem,
  startContentGeneration,
  getContentGenerationJob,
  startFormatting,
  getFormattingJob,
  updateContentVersion,
  updateContentItemStatus,
  updateWizardState,
  listContentItems,
  getContentItem,
  deleteContentItem,
  startRegeneratePart,
  getRegenJob,
  type RegenSectionName,
} from "./contentGeneration";
import { listTrendResearchSessions, getTrendResearchSession } from "./trendResearch";
import type { PageResponse } from "./apiClient";
import { useAppStore } from "../store/useAppStore";
import { mockBrandVoice, placeholderImage, draftListTitle } from "../createData";

// ===== Lớp service THỐNG NHẤT cho màn Tạo nội dung (list + wizard) =====
//
// ĐÃ NỐI API THẬT:
// - createContentItem (B2: tạo bài shell DRAFT) + generateVersion (mỗi nền tảng một job
//   ghi ContentVersion GIÀU vào bài; start + poll qua api/contentGeneration.ts, NFR-04).
// - saveContent (PUT từng bản nền tảng + PATCH trạng thái bài).
// - listContents / getContentDetail / deleteContent (FR-87/FR-89, đợt 3) — GET/DELETE thật.
// - listAttachableTrends (dữ liệu research thật từ api/trendResearch.ts).
// - brandVoice trong toContentVersion đọc THẬT từ backend (FR-30).
//
// CÒN MOCK (đánh dấu TODO(api) ở từng hàm — backend chưa có endpoint):
// nháp wizard (saveWizardDraft/getWizardDraft) / checkBrandVoice (nút "Kiểm tra lại") / generateImage.
// Lang chỉ dùng cho phần mock (đọc từ useAppStore) — backend thật tự sinh theo brand profile.

// ---- Kiểu dữ liệu dùng chung ----

/** Một phần có mốc thời gian của kịch bản video (hook / CTA cuối) — đã chuẩn hóa cho UI. */
export interface ScriptSection {
  content: string;
  /** Gợi ý cảnh quay riêng cho phần này (khung hình, b-roll, chuyển cảnh). */
  sceneSuggestion: string;
  /** Mốc thời gian trong video, vd "0-3s". */
  timing: string;
}

/** Một bước đánh số trong thân bài kịch bản. */
export interface ScriptStep {
  index: number;
  content: string;
  sceneSuggestion: string;
}

/** Kịch bản quay video (FR-25): hook có timing → các bước → CTA cuối có timing. */
export interface VideoScript {
  hook: ScriptSection;
  steps: ScriptStep[];
  cta: ScriptSection;
}

const emptySection = (): ScriptSection => ({ content: "", sceneSuggestion: "", timing: "" });

/** Kịch bản rỗng — dùng cho mock/khởi tạo editor. */
export const emptyScript = (): VideoScript => ({ hook: emptySection(), steps: [], cta: emptySection() });

/** Kết quả "Kiểm tra brand voice" — % phù hợp + nhận xét từng khía cạnh. */
export interface BrandVoiceCheck {
  score: number; // 0–100
  tone: string;
  wording: string;
  message: string;
  summary: string;
}

/** Một phiên bản nội dung theo TỪNG nền tảng (BR-04: format riêng mỗi platform). */
export interface ContentVersion {
  id: string;
  platform: Platform;
  /**
   * Trạng thái của BẢN nền tảng này (khác trạng thái BÀI). `FORMATTED` = đã chuyển thể xong
   * theo đặc thù nền tảng — nguồn sự thật duy nhất để biết nền tảng nào đã định dạng
   * (không suy từ việc "đã từng chạy job format" nữa).
   */
  status: ContentLifecycle;
  script: VideoScript;
  caption: string;
  hashtags: string[];
  cta: string;
  mediaPrompt: string;
  imageUrl: string | null;
  brandVoice: BrandVoiceCheck;
  createdAt: string;
}

/** Một lượt AI sinh nội dung (mốc 2). "Tạo lại" tạo GenerationResult MỚI, không ghi đè. */
export interface GenerationResult {
  id: string;
  note?: string; // ghi chú người dùng nhập khi "Tạo lại"
  createdAt: string;
  versions: ContentVersion[]; // 1 phần tử / nền tảng
}

/** Mục trong danh sách nội dung đã tạo (lớp 1). */
export interface ContentListItem {
  id: string;
  title: string;
  excerpt: string;
  platforms: Platform[];
  status: ContentLifecycle;
  brandVoice: number; // % — 0 nếu chưa kiểm tra (bản nháp)
  brandId: string;
  brandName: string;
  updatedAt: string;
  /** Bản nháp dở dang trong wizard → hiện nút "Tiếp tục". */
  isDraft: boolean;
  /** Bước wizard đang dừng (chỉ có ở bản nháp) — card hiện "Dừng ở: …". */
  draftStep?: 1 | 2 | 3;
}

/** Sắp xếp danh sách: mới nhất / brand voice cao nhất / theo thứ tự trạng thái. */
export type ContentSort = "newest" | "voice" | "status";

export interface ContentListParams {
  q?: string;
  platform?: Platform;
  status?: ContentLifecycle;
  brandId?: string;
  sort?: ContentSort;
  /** Trang 0-based (theo Pageable của backend). */
  page?: number;
  size?: number;
}

/** Input tạo MỘT phiên bản cho MỘT nền tảng (PA1: mỗi nền tảng một job backend). */
export interface GenerateVersionInput {
  strategyId: string;
  /** B2: bài (ContentItem) mà bản nền tảng này ghi vào — tạo trước bằng createContentItem. */
  contentItemId: string;
  platform: Platform;
  /** Trend gắn kèm — gửi id, backend resolve NỘI DUNG (ownership check, id lạ bị bỏ qua). */
  trendId?: string;
  /** Ý tưởng content gắn kèm — như trendId. */
  ideaId?: string;
  /** Ghi chú của user (mốc 1 + ghi chú "Tạo lại" nếu có) — vào thẳng prompt AI. */
  note?: string;
  /** TEXT bản trước cần cải thiện khi tạo lại (FR-32) — KHÔNG phải id. */
  regenerateFrom?: string;
}

/** Trend/idea gắn được vào bài — lấy từ phiên research THẬT của tab Xu hướng. */
export interface AttachableTrend {
  id: string;
  kind: "trend" | "idea";
  title: string;
}

export interface GenerateImageInput {
  platform: Platform;
  mediaPrompt: string;
}

export interface CheckBrandVoiceInput {
  brandId: string;
  platform: Platform;
  script: VideoScript;
  caption: string;
}

/** Nội dung cuối của MỘT bản nền tảng cần lưu — ghi đè vào version đang active của bài. */
export interface SaveVersionInput {
  /** Id bản nền tảng đang active trên backend (PUT target). */
  versionId: string;
  script: VideoScript;
  caption: string;
  hashtags: string[];
  cta: string;
  mediaPrompt: string;
}

export interface SaveContentInput {
  itemId: string;
  /** Trạng thái khi lưu: giữ Nháp (không PATCH) / gửi duyệt / phê duyệt. */
  status: "DRAFT" | "NEED_REVIEW" | "APPROVED";
  versions: SaveVersionInput[];
}

/** Bản nháp phiên wizard khôi phục từ bài DRAFT (auto-save DB) — chỉ chứa id, dữ liệu fetch lại mới. */
export interface WizardDraft {
  /** = id bài (ContentItem) DRAFT đang dở. */
  draftId: string;
  step: 1 | 2 | 3;
  brandId?: string;
  brandName?: string;
  /** Không lưu trên bài — SourceStep tự nạp chiến lược ACTIVE của hồ sơ. */
  strategyId?: string;
  trendId?: string;
  ideaId?: string;
  /** Nền tảng đã chọn riêng cho bài này (subset platform của chiến lược). */
  platforms?: Platform[];
  /** Ghi chú thêm cho AI đã nhập ở mốc 1. */
  note?: string;
}

// ---- Helpers mock ----

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const lang = () => useAppStore.getState().lang;

// ---- API của service ----

// Thứ tự nền tảng cố định trên card (FB → IG → TH), không phụ thuộc thứ tự backend trả version.
const PLATFORM_ORDER: Platform[] = ["FACEBOOK", "INSTAGRAM", "THREADS"];

// Bước wizard resume được: 1 Chọn nguồn / 2 Tạo nội dung / 3 Hoàn thiện. KHÔNG bao giờ resume
// thẳng vào mốc 4 (Lên lịch) — mốc đó cần nội dung đã lưu, nên bước lưu ở DB luôn bị kẹp về 3.
// Bài DRAFT chưa có wizard_step → suy từ dữ liệu: đã có bản nền tảng → 3, chưa có → 1.
function resumeStep(r: ContentItemResponse): 1 | 2 | 3 {
  const s = r.wizardStep;
  if (s === 1 || s === 2) return s;
  if (s != null && s >= 3) return 3;
  return (r.versions ?? []).length > 0 ? 3 : 1;
}

// Bài (B2) → mục danh sách. Nội dung nằm ở các version (row bài thường rỗng), nên title/excerpt
// lấy từ bản nền tảng đầu tiên; brand voice của card = điểm cao nhất trong các bản.
// isDraft = bài còn DRAFT (đang dở trong wizard, auto-save) → card hiện "Tiếp tục" + bước đang dừng.
function toContentListItem(r: ContentItemResponse): ContentListItem {
  const versions = r.versions ?? [];
  const first = versions[0];
  const hook = first?.script?.hook?.content?.trim() ?? "";
  const caption = first?.formattedCaption?.trim() ?? "";
  const title = hook || caption || draftListTitle(lang());
  const excerpt =
    caption || (first?.script?.steps ?? []).map((s) => s?.content ?? "").filter(Boolean).join(" ") || "";
  const platforms = PLATFORM_ORDER.filter((p) => versions.some((v) => v.platformName === p));
  const scores = versions
    .map((v) => v.voiceScore)
    .filter((n): n is number => typeof n === "number");
  return {
    id: r.id,
    title,
    excerpt,
    platforms,
    status: r.status,
    brandVoice: scores.length ? Math.max(...scores) : 0,
    brandId: r.brandProfileId ?? "",
    brandName: r.brandName ?? "",
    updatedAt: r.updatedAt ?? new Date().toISOString(),
    isDraft: r.status === "DRAFT",
    draftStep: r.status === "DRAFT" ? resumeStep(r) : undefined,
  };
}

// FR-87: GET /content-items — filter/sort/phân trang server-side (Pageable 0-based, mặc định mới nhất).
export async function listContents(params: ContentListParams = {}): Promise<PageResponse<ContentListItem>> {
  const pg = await listContentItems({
    q: params.q?.trim() || undefined,
    platform: params.platform,
    status: params.status,
    brandProfileId: params.brandId,
    sort: params.sort ?? "newest",
    page: params.page ?? 0,
    size: params.size ?? 6,
  });
  return { ...pg, content: pg.content.map(toContentListItem) };
}

// FR-87: GET /content-items/{id} — bài kèm các bản nền tảng còn hiệu lực (tab theo version thật).
export async function getContentDetail(id: string): Promise<{ item: ContentListItem; versions: ContentVersion[] }> {
  const r = await getContentItem(id);
  return { item: toContentListItem(r), versions: (r.versions ?? []).map(toContentVersion) };
}

// FR-89: DELETE /content-items/{id} — xóa mềm; backend chặn nếu bài không ở DRAFT/GENERATED.
export async function deleteContent(id: string): Promise<void> {
  await deleteContentItem(id);
}

/**
 * FR-33 — Sửa tại chỗ MỘT bản nền tảng từ màn Xem chi tiết: PUT toàn bộ nội dung của bản
 * (script cấu trúc + caption/hashtag/CTA/media prompt). Trả về bài đã cập nhật để panel
 * refresh cả status (bài APPROVED bị sửa được backend tự hạ về NEED_REVIEW).
 */
export async function saveVersionEdit(
  itemId: string,
  version: ContentVersion,
): Promise<{ item: ContentListItem; versions: ContentVersion[] }> {
  const r = await updateContentVersion(itemId, version.id, {
    script: toScriptPayload(version.script),
    caption: version.caption,
    hashtags: version.hashtags.map((h) => h.replace(/^#+/, "")),
    cta: version.cta,
    mediaPrompt: version.mediaPrompt,
  });
  return { item: toContentListItem(r), versions: (r.versions ?? []).map(toContentVersion) };
}

/**
 * FR-34 — Đổi trạng thái bài theo review flow (PATCH). Backend chỉ chấp nhận bước hợp lệ:
 * DRAFT/GENERATED → NEED_REVIEW, NEED_REVIEW → APPROVED, NEED_REVIEW → GENERATED (trả về sửa).
 */
export async function changeContentStatus(itemId: string, status: ContentLifecycle): Promise<ContentListItem> {
  const r = await updateContentItemStatus(itemId, status);
  return toContentListItem(r);
}

/**
 * C — Auto-save trạng thái wizard xuống DB (PATCH /content-items/{id}/wizard-state).
 * Gọi ngầm (debounce phía wizard) — lỗi do caller quyết định nuốt hay báo.
 */
export async function saveWizardState(itemId: string, input: Omit<WizardDraft, "draftId" | "brandId" | "brandName" | "strategyId">): Promise<void> {
  await updateWizardState(itemId, {
    step: input.step,
    platforms: input.platforms,
    trendId: input.trendId,
    ideaId: input.ideaId,
    note: input.note,
  });
}

/**
 * C — Resume bài DRAFT dở từ danh sách ("Tiếp tục"): GET detail → bản nháp wizard (id đã chọn +
 * bước đang dừng) + các bản nền tảng đã sinh (nếu có, để nhảy thẳng tới bước 2-4).
 * Trả null nếu bài đã rời DRAFT (không còn gì để resume).
 */
export async function getWizardResume(itemId: string): Promise<{ draft: WizardDraft; versions: ContentVersion[] } | null> {
  const r = await getContentItem(itemId);
  if (r.status !== "DRAFT") return null;
  return {
    draft: {
      draftId: itemId,
      step: resumeStep(r),
      brandId: r.brandProfileId ?? undefined,
      brandName: r.brandName ?? undefined,
      trendId: r.trendId ?? undefined,
      ideaId: r.ideaId ?? undefined,
      platforms: r.wizardPlatforms?.length ? r.wizardPlatforms : undefined,
      note: r.wizardNote ?? undefined,
    },
    versions: (r.versions ?? []).map(toContentVersion),
  };
}

// ---- Tạo nội dung: API THẬT (PA1 — mỗi nền tảng một job async, NFR-04) ----

// script backend trả là OBJECT có cấu trúc (VideoScriptDto — bài legacy đã được backend
// parse fallback) → chuẩn hóa field vắng/null thành chuỗi rỗng cho UI khỏi phải null-check.
function toScript(s: VideoScriptResponse | null | undefined): VideoScript {
  const section = (x?: { content?: string | null; sceneSuggestion?: string | null; timing?: string | null } | null): ScriptSection => ({
    content: x?.content ?? "",
    sceneSuggestion: x?.sceneSuggestion ?? "",
    timing: x?.timing ?? "",
  });
  return {
    hook: section(s?.hook),
    steps: (s?.steps ?? []).map((st, i) => ({
      index: st?.index ?? i + 1,
      content: st?.content ?? "",
      sceneSuggestion: st?.sceneSuggestion ?? "",
    })),
    cta: section(s?.cta),
  };
}

// Chiều ngược lại khi PUT: bỏ field rỗng (backend NON_NULL, không lưu chuỗi rỗng vô nghĩa)
// và bỏ bước không có nội dung; đánh lại index 1..n cho chắc thứ tự.
function toScriptPayload(s: VideoScript): VideoScriptResponse {
  const section = (x: ScriptSection) => ({
    content: x.content.trim() || undefined,
    sceneSuggestion: x.sceneSuggestion.trim() || undefined,
    timing: x.timing.trim() || undefined,
  });
  return {
    hook: section(s.hook),
    steps: s.steps
      .filter((st) => st.content.trim() || st.sceneSuggestion.trim())
      .map((st, i) => ({
        index: i + 1,
        content: st.content.trim() || undefined,
        sceneSuggestion: st.sceneSuggestion.trim() || undefined,
      })),
    cta: section(s.cta),
  };
}

// Map bản nền tảng GIÀU từ backend → ContentVersion cho UI. Brand voice đọc THẬT
// (FR-30: backend trả voiceScore + voiceNotes; tone/wording/message backend không có nên để trống).
function toContentVersion(v: ContentVersionResponse): ContentVersion {
  return {
    id: v.id,
    platform: v.platformName,
    status: v.status,
    script: toScript(v.script),
    caption: v.formattedCaption ?? "",
    hashtags: (v.formattedHashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)),
    cta: v.cta ?? "",
    mediaPrompt: v.mediaPrompt ?? "",
    // Ảnh chưa sinh (tính năng chưa làm); imagePrompt backend đã lưu, đón cho lượt sau.
    imageUrl: null,
    brandVoice: {
      score: v.voiceScore ?? 0,
      summary: v.voiceNotes ?? "",
      tone: "",
      wording: "",
      message: "",
    },
    createdAt: new Date().toISOString(),
  };
}

// B2: tạo BÀI shell (DRAFT) — trả itemId để bắn các job generate ghi version vào.
export async function createContentItem(strategyId: string, ideaId?: string): Promise<string> {
  const item = await apiCreateContentItem({ strategyId, ideaId });
  return item.id;
}

/**
 * Tạo MỘT ContentVersion cho MỘT nền tảng bằng backend THẬT (ghi vào bài contentItemId):
 * POST /content-items/generate → poll GET /content-items/jobs/{id} tới SUCCESS/FAILED.
 * Lỗi (job FAILED, hoặc START trả mã 1905/1906/1920) đẩy ra ngoài — UI hiển thị trạng
 * thái lỗi + "Thử lại" riêng nền tảng đó, không làm đứng wizard.
 */
export async function generateVersion(input: GenerateVersionInput): Promise<ContentVersion> {
  let job = await startContentGeneration({
    strategyId: input.strategyId,
    contentItemId: input.contentItemId,
    platform: input.platform,
    trendId: input.trendId,
    ideaId: input.ideaId,
    note: input.note,
    regenerateFrom: input.regenerateFrom,
  });
  while (job.status === "PENDING" || job.status === "RUNNING") {
    await delay(2000);
    job = await getContentGenerationJob(job.id);
  }
  if (job.status !== "SUCCESS" || !job.contentVersion) {
    throw new Error(job.errorMessage ?? "AI_SERVICE_ERROR");
  }
  return toContentVersion(job.contentVersion);
}

/**
 * FR-40..FR-46 — Định dạng bài theo nền tảng ("Định dạng tổng" / "Định dạng theo nền tảng" ở mốc
 * Hoàn thiện + nút "Format lại" ở thư viện). PA2-a: backend lặp từng nền tảng, format từ CHÍNH bản
 * active của nó (giữ chỉnh sửa tay làm đầu vào), trả về các bản FORMATTED. start + poll tới
 * SUCCESS/FAILED. Thành công một phần (một số nền tảng lỗi) vẫn trả SUCCESS kèm các bản làm được —
 * caller so với `platforms` để biết nền tảng nào còn thiếu.
 *
 * Job trả về MỌI bản còn hiệu lực của bài, nên ta LỌC về đúng các nền tảng vừa yêu cầu: định dạng
 * riêng một nền tảng không được kéo theo bản cũ (đọc từ DB) của các nền tảng khác — sẽ đè mất
 * chỉnh sửa tay chưa lưu của chúng ở FE.
 */
export async function formatContent(itemId: string, platforms: Platform[]): Promise<ContentVersion[]> {
  let job = await startFormatting(itemId, platforms);
  while (job.status === "PENDING" || job.status === "RUNNING") {
    await delay(2000);
    job = await getFormattingJob(job.id);
  }
  if (job.status !== "SUCCESS") {
    throw new Error(job.errorMessage ?? "AI_SERVICE_ERROR");
  }
  const wanted = new Set(platforms);
  return (job.versions ?? []).map(toContentVersion).filter((v) => wanted.has(v.platform));
}

// ---- Tạo lại từng phần kịch bản (async job; patch in-place đúng nhánh, poll rồi merge) ----

/** Phần kịch bản (FE-facing, chữ thường). */
export type RegenSection = "hook" | "body" | "cta";
/** Nhánh dữ liệu: nội dung nói (+timing) hoặc gợi ý cảnh quay. */
export type RegenField = "content" | "scene";

/** Fragment CHỈ chứa phần vừa tạo lại — dùng applyScriptPatch để merge vào script cục bộ. */
export interface ScriptPatch {
  section: RegenSection;
  field: RegenField;
  stepIndex: number | null;
  text: string | null;
  timing: string | null;
  steps: { index: number; text: string }[] | null;
}

const SECTION_TO_API: Record<RegenSection, RegenSectionName> = { hook: "HOOK", body: "BODY", cta: "CTA" };

/**
 * Tạo lại MỘT phần kịch bản (hook/body/cta × content/scene, tùy chọn 1 bước) — start job rồi
 * poll tới SUCCESS/FAILED. Trả về CHỈ fragment đã tạo lại; backend đã patch in-place version.
 * Không đụng các phần khác (giữ chỉnh sửa tay của người dùng ở nhánh khác).
 */
export async function regeneratePart(
  itemId: string,
  versionId: string,
  section: RegenSection,
  field: RegenField,
  stepIndex?: number,
): Promise<ScriptPatch> {
  let job = await startRegeneratePart(itemId, versionId, {
    section: SECTION_TO_API[section],
    field: field === "content" ? "CONTENT" : "SCENE",
    stepIndex,
  });
  while (job.status === "PENDING" || job.status === "RUNNING") {
    await delay(1500);
    job = await getRegenJob(job.id);
  }
  if (job.status !== "SUCCESS" || !job.patch) {
    throw new Error(job.errorMessage ?? "AI_SERVICE_ERROR");
  }
  const p = job.patch;
  return {
    section: p.section.toLowerCase() as RegenSection,
    field: p.field.toLowerCase() as RegenField,
    stepIndex: p.stepIndex,
    text: p.text,
    timing: p.timing,
    steps: p.steps,
  };
}

/** Merge fragment tạo lại vào script — CHỈ ghi đè nhánh tương ứng, các phần khác giữ nguyên. */
export function applyScriptPatch(script: VideoScript, patch: ScriptPatch): VideoScript {
  if (patch.section === "hook" || patch.section === "cta") {
    const key = patch.section;
    const sec = { ...script[key] };
    if (patch.field === "content") {
      if (patch.text != null) sec.content = patch.text;
      if (patch.timing != null) sec.timing = patch.timing;
    } else if (patch.text != null) {
      sec.sceneSuggestion = patch.text;
    }
    return { ...script, [key]: sec };
  }
  // body: áp theo index từng bước; bước không có trong patch giữ nguyên.
  const patched = patch.steps ?? [];
  const steps = script.steps.map((s) => {
    const hit = patched.find((x) => x.index === s.index);
    if (!hit) return s;
    return patch.field === "content" ? { ...s, content: hit.text } : { ...s, sceneSuggestion: hit.text };
  });
  return { ...script, steps };
}

/**
 * Trend/idea gắn được vào bài — dữ liệu THẬT từ phiên research COMPLETED gần nhất
 * của user (tab Xu hướng; backend đã scope theo user đăng nhập). Chưa có phiên nào → [].
 */
export async function listAttachableTrends(): Promise<AttachableTrend[]> {
  const sessions = await listTrendResearchSessions();
  const latest = sessions.find((s) => s.status === "COMPLETED");
  if (!latest) return [];
  const detail = await getTrendResearchSession(latest.id);
  const out: AttachableTrend[] = [];
  for (const tr of detail.trends) {
    out.push({ id: tr.id, kind: "trend", title: tr.trendName });
    for (const idea of tr.contentIdeas) {
      out.push({ id: idea.id, kind: "idea", title: idea.ideaTitle });
    }
  }
  return out;
}

// TODO(api): POST /content-items/generate-image { platform, mediaPrompt } → { imageUrl }.
// Backend chưa có endpoint này (MVP gốc chỉ tạo media prompt — FR-29); cần bổ sung.
export async function generateImage(input: GenerateImageInput): Promise<{ imageUrl: string }> {
  await delay(1400);
  return { imageUrl: placeholderImage(input.mediaPrompt.length + input.platform.length) };
}

// TODO(api): POST /content-items/check-brand-voice { brandId, platform, post, caption }
// → BrandVoiceCheck. Backend cần bổ sung endpoint.
export async function checkBrandVoice(input: CheckBrandVoiceInput): Promise<BrandVoiceCheck> {
  await delay(900);
  return mockBrandVoice(lang(), (input.script.hook.content.length + input.caption.length) % 4);
}

/**
 * PUT nội dung hiện tại vào TỪNG bản nền tảng đang active — KHÔNG đụng trạng thái bài.
 * Dùng cho "lưu ngầm trước khi định dạng" (để chỉnh sửa tay là đầu vào thật của job format,
 * vì backend đọc bản nguồn từ DB chứ không nhận nội dung từ FE).
 */
export async function saveVersions(itemId: string, versions: SaveVersionInput[]): Promise<void> {
  for (const v of versions) {
    await updateContentVersion(itemId, v.versionId, {
      script: toScriptPayload(v.script),
      caption: v.caption,
      // Backend lưu hashtag không '#' (Python trả không '#') → cắt '#' trước khi gửi, tránh nhân đôi.
      hashtags: v.hashtags.map((h) => h.replace(/^#+/, "")),
      cta: v.cta,
      mediaPrompt: v.mediaPrompt,
    });
  }
}

/**
 * Lưu bài ở mốc Hoàn thiện (B2, API THẬT): PUT nội dung cuối vào từng bản nền tảng rồi PATCH
 * trạng thái bài.
 * - DRAFT: bài đã ở DRAFT → không PATCH (giữ nháp, KHÔNG tự gắn trạng thái duyệt).
 * - NEED_REVIEW: PATCH một bước (DRAFT→NEED_REVIEW).
 * - APPROVED: PATCH hai bước (DRAFT→NEED_REVIEW→APPROVED) vì backend chỉ duyệt từ NEED_REVIEW.
 */
export async function saveContent(input: SaveContentInput): Promise<void> {
  await saveVersions(input.itemId, input.versions);
  if (input.status === "NEED_REVIEW") {
    await updateContentItemStatus(input.itemId, "NEED_REVIEW");
  } else if (input.status === "APPROVED") {
    await updateContentItemStatus(input.itemId, "NEED_REVIEW");
    await updateContentItemStatus(input.itemId, "APPROVED");
  }
}
