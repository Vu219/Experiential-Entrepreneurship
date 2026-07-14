import client, { type ApiResponse, type PageResponse } from "./apiClient";
import type { Platform } from "./brandProfile";

// Content Generation gọi backend thật qua api/apiClient.ts (envelope { code, message, result }).
// Endpoint: /content-items (controller backend, context-path đã ở baseURL).
//
// B2 (1 bài → N bản nền tảng): tạo BÀI (ContentItem shell DRAFT) trước, rồi mỗi nền tảng
// một job generate ghi MỘT ContentVersion GIÀU vào bài đó (NFR-04: job chạy nền, FE poll).

export type GenerationJobStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

// Trạng thái vòng đời nội dung (state machine trong docs/WORKFLOWS.md — không tự đặt status mới).
export type ContentLifecycle =
  | "DRAFT"
  | "GENERATED"
  | "NEED_REVIEW"
  | "APPROVED"
  | "FORMATTED"
  | "SCHEDULED"
  | "POSTING"
  | "POSTED"
  | "FAILED"
  | "ANALYZING"
  | "OPTIMIZED";

// Mã lỗi backend (ErrorCode.java) cần bắt riêng ở luồng generate B2.
export const ERR_CONTENT_ITEM_NOT_FOUND = 1920; // bài không tồn tại / không thuộc user
export const ERR_CONTENT_ITEM_ID_REQUIRED = 1905; // thiếu contentItemId
export const ERR_CONTENT_ITEM_NOT_DRAFT = 1906; // bài không còn ở DRAFT (vd bấm tạo 2 lần)
export const ERR_CONTENT_ITEM_NOT_DELETABLE = 1947; // FR-89: chỉ xóa được khi DRAFT/GENERATED

// ---- Kịch bản video có cấu trúc (mirror VideoScriptDto backend; NON_NULL nên field có thể vắng) ----

/** Một phần có mốc thời gian của kịch bản (hook mở đầu / CTA cuối). */
export interface ScriptSectionResponse {
  content?: string | null;
  sceneSuggestion?: string | null;
  timing?: string | null;
}

/** Một bước đánh số trong thân bài. */
export interface ScriptStepResponse {
  index?: number | null;
  content?: string | null;
  sceneSuggestion?: string | null;
}

/** Kịch bản quay: hook có timing → các bước đánh số → CTA cuối có timing (FR-25). */
export interface VideoScriptResponse {
  hook?: ScriptSectionResponse | null;
  steps?: ScriptStepResponse[] | null;
  cta?: ScriptSectionResponse | null;
}

/** Bản nền tảng GIÀU (B2) — luồng generate điền đủ; luồng format chỉ điền formatted_*. */
export interface ContentVersionResponse {
  id: string;
  platformName: Platform;
  formattedCaption: string | null;
  formattedHashtags: string[];
  mediaFormat: string | null;
  script: VideoScriptResponse | null;
  cta: string | null;
  mediaPrompt: string | null;
  imagePrompt: string | null;
  voiceAligned: boolean | null;
  voiceScore: number | null;
  voiceNotes: string | null;
  status: ContentLifecycle;
}

/** Bài — MỘT thực thể chứa N bản nền tảng (versions). */
export interface ContentItemResponse {
  id: string;
  script: VideoScriptResponse | null;
  caption: string | null;
  hashtags: string[];
  cta: string | null;
  mediaPrompt: string | null;
  status: ContentLifecycle;
  versions: ContentVersionResponse[];
  brandProfileId: string | null;
  brandName: string | null;
  /** Idea gắn kèm (đặt lúc tạo bài / auto-save wizard). */
  ideaId: string | null;
  // ===== Trạng thái wizard (auto-save/resume) — chỉ có nghĩa khi DRAFT, null sau khi rời DRAFT =====
  wizardStep: number | null;
  wizardPlatforms: Platform[];
  wizardNote: string | null;
  trendId: string | null;
  updatedAt: string | null;
}

export interface ContentGenerationJob {
  id: string;
  status: GenerationJobStatus;
  errorMessage: string | null;
  /** B2: kết quả job là MỘT bản nền tảng (present khi SUCCESS). */
  contentVersion: ContentVersionResponse | null;
}

// B2: tạo BÀI shell (DRAFT) — trả về itemId để bắn các job generate ghi version vào.
export interface ContentItemCreateInput {
  strategyId: string;
  ideaId?: string;
}

// POST /content-items
export async function createContentItem(input: ContentItemCreateInput): Promise<ContentItemResponse> {
  const { data } = await client.post<ApiResponse<ContentItemResponse>>("/content-items", input);
  return data.result;
}

export interface ContentGenerationInput {
  strategyId: string;
  /** B2: bài (ContentItem) mà job ghi bản nền tảng của mình vào (bắt buộc). */
  contentItemId: string;
  platform: Platform;
  topic?: string;
  /** Trend gắn kèm (bước Chọn nguồn) — backend resolve NỘI DUNG theo ownership, id lạ bị bỏ qua. */
  trendId?: string;
  /** Ý tưởng content gắn kèm — như trendId. */
  ideaId?: string;
  /** Ghi chú thêm của user cho AI (chỉ dẫn, khác topic là chủ đề). */
  note?: string;
  /** TEXT bản trước cần cải thiện khi tạo lại (FR-32) — KHÔNG phải id. */
  regenerateFrom?: string;
}

// POST /content-items/generate
export async function startContentGeneration(input: ContentGenerationInput): Promise<ContentGenerationJob> {
  const { data } = await client.post<ApiResponse<ContentGenerationJob>>("/content-items/generate", input);
  return data.result;
}

// GET /content-items/jobs/{jobId}
export async function getContentGenerationJob(jobId: string): Promise<ContentGenerationJob> {
  const { data } = await client.get<ApiResponse<ContentGenerationJob>>(`/content-items/jobs/${jobId}`);
  return data.result;
}

// ---- FR-40..FR-46: định dạng theo nền tảng (async job, NFR-04) ----
// PA2-a: mỗi nền tảng format từ CHÍNH bản active của nó (giữ chỉnh sửa tay làm đầu vào),
// job trả về các bản FORMATTED khi SUCCESS. Item phải GENERATED/APPROVED/FORMATTED.

export const ERR_CONTENT_ITEM_NOT_FORMATTABLE = 1925; // item không ở trạng thái cho phép format
export const ERR_TOKEN_QUOTA_EXCEEDED = 1990; // hết hạn mức token tháng

export interface ContentFormattingJob {
  id: string;
  status: GenerationJobStatus;
  errorMessage: string | null;
  /** Các bản định dạng hiện hành của bài (điền khi SUCCESS). */
  versions: ContentVersionResponse[] | null;
}

// POST /content-items/{itemId}/format
export async function startFormatting(itemId: string, platforms: Platform[]): Promise<ContentFormattingJob> {
  const { data } = await client.post<ApiResponse<ContentFormattingJob>>(`/content-items/${itemId}/format`, { platforms });
  return data.result;
}

// GET /content-items/format-jobs/{jobId}
export async function getFormattingJob(jobId: string): Promise<ContentFormattingJob> {
  const { data } = await client.get<ApiResponse<ContentFormattingJob>>(`/content-items/format-jobs/${jobId}`);
  return data.result;
}

// ---- Tạo lại từng phần kịch bản (async job; patch in-place đúng nhánh, FE poll về merge) ----

export type RegenSectionName = "HOOK" | "BODY" | "CTA";
export type RegenFieldName = "CONTENT" | "SCENE";

/** Fragment CHỈ chứa phần vừa tạo lại — FE dùng section/field để merge đúng nhánh. */
export interface ScriptPartPatchResponse {
  section: RegenSectionName;
  field: RegenFieldName;
  stepIndex: number | null;
  /** HOOK/CTA: nội dung hoặc gợi ý cảnh quay mới (tùy field). */
  text: string | null;
  /** HOOK/CTA + field=CONTENT: mốc thời gian mới (nếu AI đổi). */
  timing: string | null;
  /** BODY: các bước đã tạo lại. */
  steps: { index: number; text: string }[] | null;
}

export interface ScriptRegenJob {
  id: string;
  status: GenerationJobStatus;
  errorMessage: string | null;
  /** Present khi SUCCESS. */
  patch: ScriptPartPatchResponse | null;
}

export interface RegeneratePartInput {
  section: RegenSectionName;
  field: RegenFieldName;
  /** Chỉ dùng khi section=BODY: bước cần tạo lại (1-based); bỏ trống = tất cả bước. */
  stepIndex?: number;
}

// POST /content-items/{itemId}/versions/{versionId}/regenerate-part
export async function startRegeneratePart(itemId: string, versionId: string, input: RegeneratePartInput): Promise<ScriptRegenJob> {
  const { data } = await client.post<ApiResponse<ScriptRegenJob>>(
    `/content-items/${itemId}/versions/${versionId}/regenerate-part`,
    input,
  );
  return data.result;
}

// GET /content-items/regen-jobs/{jobId}
export async function getRegenJob(jobId: string): Promise<ScriptRegenJob> {
  const { data } = await client.get<ApiResponse<ScriptRegenJob>>(`/content-items/regen-jobs/${jobId}`);
  return data.result;
}

// FR-33: chỉnh sửa thủ công MỘT bản nền tảng — partial update, field bỏ qua giữ nguyên.
export interface ContentVersionUpdateInput {
  script?: VideoScriptResponse;
  caption?: string;
  hashtags?: string[];
  cta?: string;
  mediaPrompt?: string;
}

// PUT /content-items/{itemId}/versions/{versionId} — trả về nguyên bài (kèm versions).
export async function updateContentVersion(
  itemId: string,
  versionId: string,
  input: ContentVersionUpdateInput,
): Promise<ContentItemResponse> {
  const { data } = await client.put<ApiResponse<ContentItemResponse>>(
    `/content-items/${itemId}/versions/${versionId}`,
    input,
  );
  return data.result;
}

// C (resume): auto-save trạng thái wizard trên bài DRAFT — debounce phía FE ~1s.
export interface WizardStateInput {
  step: number;
  platforms?: Platform[];
  trendId?: string;
  ideaId?: string;
  note?: string;
}

// PATCH /content-items/{itemId}/wizard-state — chỉ khi bài còn DRAFT (khác → CONTENT_ITEM_NOT_EDITABLE).
export async function updateWizardState(itemId: string, input: WizardStateInput): Promise<ContentItemResponse> {
  const { data } = await client.patch<ApiResponse<ContentItemResponse>>(
    `/content-items/${itemId}/wizard-state`,
    input,
  );
  return data.result;
}

// FR-34: review flow — DRAFT/GENERATED→NEED_REVIEW (gửi duyệt), NEED_REVIEW→APPROVED (phê duyệt),
// NEED_REVIEW→GENERATED (trả về sửa).
// PATCH /content-items/{itemId}/status
export async function updateContentItemStatus(itemId: string, status: ContentLifecycle): Promise<ContentItemResponse> {
  const { data } = await client.patch<ApiResponse<ContentItemResponse>>(`/content-items/${itemId}/status`, { status });
  return data.result;
}

// ---- FR-87/FR-89: thư viện nội dung (danh sách / chi tiết / xóa) ----

// Filter/sort/phân trang SERVER-SIDE (page 0-based theo Pageable). Backend bỏ qua param undefined.
export interface ContentItemListParams {
  status?: ContentLifecycle;
  brandProfileId?: string;
  platform?: Platform;
  q?: string;
  sort?: "newest" | "voice" | "status";
  page?: number;
  size?: number;
}

// GET /content-items — bài của user, mỗi bài kèm versions[] + brandProfileId/brandName/updatedAt.
export async function listContentItems(params: ContentItemListParams): Promise<PageResponse<ContentItemResponse>> {
  const { data } = await client.get<ApiResponse<PageResponse<ContentItemResponse>>>("/content-items", { params });
  return data.result;
}

// GET /content-items/{itemId}
export async function getContentItem(itemId: string): Promise<ContentItemResponse> {
  const { data } = await client.get<ApiResponse<ContentItemResponse>>(`/content-items/${itemId}`);
  return data.result;
}

// DELETE /content-items/{itemId} — soft delete; lỗi ERR_CONTENT_ITEM_NOT_DELETABLE nếu không ở DRAFT/GENERATED.
export async function deleteContentItem(itemId: string): Promise<void> {
  await client.delete<ApiResponse<ContentItemResponse>>(`/content-items/${itemId}`);
}
