import client, { type ApiResponse } from "./apiClient";
import type { Platform } from "./brandProfile";

// Content Generation gọi backend thật qua api/apiClient.ts (envelope { code, message, result }).
// Endpoint: /content-items (controller backend, context-path đã ở baseURL).
//
// NFR-04: tác vụ AI chạy nền — POST /generate trả về job ngay (PENDING), FE poll
// GET /content-items/jobs/{id} tới khi status là SUCCESS hoặc FAILED.

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

export interface GeneratedContentItem {
  id: string;
  script: string;
  caption: string;
  hashtags: string[];
  cta: string;
  mediaPrompt: string;
  status: ContentLifecycle;
}

export interface ContentGenerationJob {
  id: string;
  status: GenerationJobStatus;
  errorMessage: string | null;
  contentItem: GeneratedContentItem | null;
}

export interface ContentGenerationInput {
  strategyId: string;
  platform: Platform;
  topic?: string;
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

// FR-33: chỉnh sửa thủ công — partial update, field bỏ qua giữ nguyên giá trị cũ.
export interface ContentItemUpdateInput {
  script?: string;
  caption?: string;
  hashtags?: string[];
  cta?: string;
  mediaPrompt?: string;
}

// PUT /content-items/{itemId}
export async function updateContentItem(itemId: string, input: ContentItemUpdateInput): Promise<GeneratedContentItem> {
  const { data } = await client.put<ApiResponse<GeneratedContentItem>>(`/content-items/${itemId}`, input);
  return data.result;
}

// FR-34: review flow — GENERATED→NEED_REVIEW (gửi duyệt), NEED_REVIEW→APPROVED (phê duyệt).
// PATCH /content-items/{itemId}/status
export async function updateContentItemStatus(itemId: string, status: ContentLifecycle): Promise<GeneratedContentItem> {
  const { data } = await client.patch<ApiResponse<GeneratedContentItem>>(`/content-items/${itemId}/status`, { status });
  return data.result;
}
