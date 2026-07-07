import type { Platform } from "./brandProfile";
import type { ContentLifecycle, GeneratedContentItem } from "./contentGeneration";
import { startContentGeneration, getContentGenerationJob } from "./contentGeneration";
import { listTrendResearchSessions, getTrendResearchSession } from "./trendResearch";
import type { PageResponse } from "./apiClient";
import { useAppStore } from "../store/useAppStore";
import {
  mockContentList,
  mockGeneration,
  mockBrandVoice,
  placeholderImage,
  draftListTitle,
} from "../createData";

// ===== Lớp service THỐNG NHẤT cho màn Tạo nội dung (list + wizard) =====
//
// ĐÃ NỐI API THẬT: generateVersion (PA1 — mỗi nền tảng một job: start + poll qua
// api/contentGeneration.ts, NFR-04) và listAttachableTrends (dữ liệu research thật
// từ api/trendResearch.ts).
//
// CÒN MOCK (đánh dấu TODO(api) ở từng hàm — backend chưa có endpoint):
// listContents / getContentDetail / deleteContent / saveContent / nháp wizard /
// checkBrandVoice / generateImage, và brandVoice trong toContentVersion.
// Lang chỉ dùng cho phần mock (đọc từ useAppStore) — backend thật tự sinh theo brand profile.

// ---- Kiểu dữ liệu dùng chung ----

/** Nội dung bài viết dạng đoạn văn: mở đầu (hook) → thân bài → kêu gọi hành động. */
export interface PostContent {
  hook: string;
  body: string;
  cta: string;
}

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
  post: PostContent;
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
  draftStep?: 1 | 2 | 3 | 4;
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
  post: PostContent;
  caption: string;
}

export interface SaveContentInput {
  brandId: string;
  /** Chỉ để hiển thị trên card mock — backend thật tự join từ brandId. */
  brandName: string;
  strategyId: string;
  trendId?: string;
  status: ContentLifecycle;
  versions: ContentVersion[];
}

/** Bản nháp phiên wizard — lưu ngầm khi người dùng rời wizard giữa chừng (kể cả mốc 1). */
export interface WizardDraft {
  draftId: string;
  step: 1 | 2 | 3 | 4;
  brandId?: string;
  brandName?: string;
  strategyId?: string;
  trendId?: string;
  ideaId?: string;
  /** Nền tảng đã chọn riêng cho bài này (subset platform của chiến lược). */
  platforms?: Platform[];
  /** Ghi chú thêm cho AI đã nhập ở mốc 1. */
  note?: string;
}

export type WizardDraftInput = Omit<WizardDraft, "draftId"> & { draftId?: string };

// ---- Helpers mock ----

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const lang = () => useAppStore.getState().lang;

// Danh sách mock giữ trong module để Xóa/Lưu phản ánh ngay trên UI trong phiên làm việc.
let store: ContentListItem[] | null = null;
let storeLang: string | null = null;
const ensureStore = (): ContentListItem[] => {
  if (!store || storeLang !== lang()) {
    store = mockContentList(lang());
    storeLang = lang();
  }
  return store;
};

// ---- API của service ----

// Thứ tự trạng thái theo state machine (WORKFLOWS.md) cho sort "Theo trạng thái".
const STATUS_ORDER: ContentLifecycle[] = [
  "DRAFT", "GENERATED", "NEED_REVIEW", "APPROVED", "FORMATTED",
  "SCHEDULED", "POSTING", "POSTED", "FAILED", "ANALYZING", "OPTIMIZED",
];

// TODO(api): GET /content-items?q=&platform=&status=&brandId=&sort=&page=&size= (PageResponse,
// Pageable 0-based, mặc định updatedAt desc) — thay thân hàm bằng client.get, giữ nguyên
// tham số/kết quả. Backend cần bổ sung endpoint list; filter/sort/phân trang làm server-side.
export async function listContents(params: ContentListParams = {}): Promise<PageResponse<ContentListItem>> {
  await delay(600);
  const q = params.q?.trim().toLowerCase();
  const rows = ensureStore().filter(
    (it) =>
      (!q || it.title.toLowerCase().includes(q) || it.excerpt.toLowerCase().includes(q)) &&
      (!params.platform || it.platforms.includes(params.platform)) &&
      (!params.status || it.status === params.status) &&
      (!params.brandId || it.brandId === params.brandId),
  );
  const sort = params.sort ?? "newest";
  rows.sort((a, b) => {
    if (sort === "voice") return b.brandVoice - a.brandVoice;
    if (sort === "status") return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    return b.updatedAt.localeCompare(a.updatedAt); // mới nhất lên đầu (mặc định)
  });
  const size = params.size ?? 6;
  const page = params.page ?? 0;
  const totalPages = Math.ceil(rows.length / size);
  return {
    content: rows.slice(page * size, page * size + size),
    page,
    size,
    totalElements: rows.length,
    totalPages,
    last: page >= totalPages - 1,
  };
}

// TODO(api): GET /content-items/{id} — chi tiết nội dung kèm ContentVersion theo nền tảng.
export async function getContentDetail(id: string): Promise<{ item: ContentListItem; versions: ContentVersion[] }> {
  await delay(600);
  const item = ensureStore().find((it) => it.id === id);
  if (!item) throw new Error('Content not found');
  return { item, versions: mockGeneration(lang(), item.platforms, 0).versions };
}

// TODO(api): DELETE /content-items/{id} (soft delete phía backend).
export async function deleteContent(id: string): Promise<void> {
  await delay(500);
  store = ensureStore().filter((it) => it.id !== id);
  drafts.delete(id);
}

// Nháp wizard lưu trong module cho phiên làm việc (API thật sẽ lưu ở backend).
const drafts = new Map<string, WizardDraft>();

// TODO(api): POST /content-items/drafts (tạo) | PUT /content-items/drafts/{id} (cập nhật) —
// lưu ngầm trạng thái wizard (bước hiện tại + brandId/strategyId/trendId) để "Tiếp tục"
// từ danh sách quay lại đúng bước đang dở.
export async function saveWizardDraft(input: WizardDraftInput): Promise<WizardDraft> {
  await delay(300);
  const draftId = input.draftId ?? `mock-draft-${Date.now()}`;
  const draft: WizardDraft = { ...input, draftId };
  drafts.set(draftId, draft);
  // Upsert vào danh sách nội dung với trạng thái Nháp để người dùng thấy và "Tiếp tục".
  const title = input.brandName ? `${draftListTitle(lang())} · ${input.brandName}` : draftListTitle(lang());
  const item: ContentListItem = {
    id: draftId,
    title,
    excerpt: '',
    platforms: [],
    status: 'DRAFT',
    brandVoice: 0,
    brandId: input.brandId ?? '',
    brandName: input.brandName ?? '',
    updatedAt: new Date().toISOString(),
    isDraft: true,
    draftStep: input.step,
  };
  const rest = ensureStore().filter((it) => it.id !== draftId);
  store = [item, ...rest];
  return draft;
}

// TODO(api): GET /content-items/drafts/{id} — trả null nếu nháp không còn.
export async function getWizardDraft(draftId: string): Promise<WizardDraft | null> {
  await delay(300);
  return drafts.get(draftId) ?? null;
}

// ---- Tạo nội dung: API THẬT (PA1 — mỗi nền tảng một job async, NFR-04) ----

// script backend trả là các DÒNG: hook \n thân bài + gợi ý cảnh \n ... \n CTA
// (ContentItemMapper.formatScript nối bằng '\n') → tách lại thành hook/thân/kết cho UI.
function splitScript(script: string, fallbackCta: string): PostContent {
  const lines = script.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { hook: "", body: "", cta: fallbackCta };
  if (lines.length === 1) return { hook: lines[0], body: "", cta: fallbackCta };
  return { hook: lines[0], body: lines.slice(1, -1).join("\n"), cta: lines[lines.length - 1] };
}

function toContentVersion(item: GeneratedContentItem, platform: Platform): ContentVersion {
  return {
    id: item.id,
    platform,
    post: splitScript(item.script ?? "", item.cta ?? ""),
    caption: item.caption ?? "",
    hashtags: (item.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)),
    cta: item.cta ?? "",
    mediaPrompt: item.mediaPrompt ?? "",
    imageUrl: null,
    // TODO(api): Python trả brand_voice_check nhưng backend chưa persist/expose qua
    // ContentItemResponse — tạm chấm mock; khi backend trả trường này thì map thẳng vào.
    brandVoice: mockBrandVoice(lang(), item.id.length % 4),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Tạo MỘT ContentVersion cho MỘT nền tảng bằng backend THẬT:
 * POST /content-items/generate → poll GET /content-items/jobs/{id} tới SUCCESS/FAILED.
 * Ném lỗi khi job FAILED — UI hiển thị trạng thái lỗi + "Thử lại" riêng nền tảng đó.
 */
export async function generateVersion(input: GenerateVersionInput): Promise<ContentVersion> {
  let job = await startContentGeneration({
    strategyId: input.strategyId,
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
  if (job.status !== "SUCCESS" || !job.contentItem) {
    throw new Error(job.errorMessage ?? "AI_SERVICE_ERROR");
  }
  return toContentVersion(job.contentItem, input.platform);
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
  return mockBrandVoice(lang(), (input.post.hook.length + input.caption.length) % 4);
}

// TODO(api): PUT /content-items/{id} + PATCH /content-items/{id}/status
// (api/contentGeneration.ts đã có updateContentItem/updateContentItemStatus) hoặc endpoint
// lưu trọn bộ version theo nền tảng. Input cần truyền: brandId, strategyId, trendId, status,
// versions (mỗi nền tảng một bản).
export async function saveContent(input: SaveContentInput): Promise<ContentListItem> {
  await delay(700);
  const first = input.versions[0];
  const item: ContentListItem = {
    id: `mock-content-${Date.now()}`,
    title: first.caption.split(/[.!?]/)[0].slice(0, 80),
    excerpt: first.caption,
    platforms: input.versions.map((v) => v.platform),
    status: input.status,
    brandVoice: Math.round(input.versions.reduce((s, v) => s + v.brandVoice.score, 0) / input.versions.length),
    brandId: input.brandId,
    brandName: input.brandName,
    updatedAt: new Date().toISOString(),
    isDraft: input.status === 'DRAFT',
    draftStep: input.status === 'DRAFT' ? 4 : undefined,
  };
  store = [item, ...ensureStore()];
  return item;
}
