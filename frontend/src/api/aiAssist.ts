import client, { type ApiResponse } from "./apiClient";
import type { Platform } from "./brandProfile";
import type { FailedPostRetryResult } from "./failedPosts";
import type { PublishErrorCode } from "./publishErrorCatalog";

// AI hỗ trợ chính sách (docs/failed-posts-error-handling-plan.md §8) — backend AiAssistController (/me/ai-assist).
// Mọi lời gọi AI chạy NỀN: API trả job ngay, FE poll. Token tính vào "Token AI tháng này".

export type AiAssistStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
export type PolicyRiskLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH";
export type PolicyCheckAiStatus =
  | "NOT_NEEDED" | "DISABLED" | "PLAN_NOT_INCLUDED" | "LIMIT_REACHED" | "QUOTA_EXCEEDED"
  | "PENDING" | "RUNNING" | "DONE" | "FAILED";
export type AiFixApplyAction = "SAVE" | "RETRY_NOW";

/** Gợi ý AI sửa bài: nội dung gốc lúc tạo gợi ý + nội dung gợi ý (FE vẽ diff). */
export interface AiFixSuggestion {
  originalCaption: string;
  originalHashtags: string[];
  caption: string;
  hashtags: string[];
  changes: string[];
}

export interface PolicyIssue {
  excerpt: string;
  reason: string;
  suggestion: string;
}

export interface PolicyAiAssessment {
  riskLevel: PolicyRiskLevel;
  summary: string;
  issues: PolicyIssue[];
}

export interface AiAssistJob {
  id: string;
  kind: "POLICY_FIX" | "POLICY_CHECK";
  status: AiAssistStatus;
  contentVersionId: string;
  contentItemId: string | null;
  postId: string | null;
  platform: Platform;
  errorCode: PublishErrorCode | null;
  /** Câu thân thiện khi FAILED. */
  errorMessage: string | null;
  /** Nội dung bản đã đổi sau khi tạo gợi ý. */
  stale: boolean;
  appliedAt: string | null;
  fix: AiFixSuggestion | null;
  check: PolicyAiAssessment | null;
}

/** Nghi vấn của bộ luật miễn phí — `category` dịch qua i18n (aiRule_*), `excerpt` là đoạn gốc. */
export interface PolicyRuleHit {
  ruleId: string;
  category: string;
  severity: PolicyRiskLevel;
  excerpt: string;
}

export interface PolicyCheckResult {
  contentVersionId: string;
  contentHash: string;
  enabled: boolean;
  ruleRisk: PolicyRiskLevel;
  ruleHits: PolicyRuleHit[];
  aiStatus: PolicyCheckAiStatus;
  jobId: string | null;
  ai: PolicyAiAssessment | null;
  aiChecksUsed: number;
  aiChecksLimit: number | null;
}

/** Lượt AI hỗ trợ chính sách theo gói (GET /me/ai-assist/usage). Giới hạn null = không giới hạn, 0 = gói không gồm. */
export interface AiAssistUsage {
  planCode: string | null;
  policyCheckAiUsed: number;
  policyCheckAiLimit: number | null;
  aiFixMaxPerVersion: number | null;
  resetAt: string;
}

export interface AiFixApplyResult {
  contentVersionId: string;
  contentItemId: string | null;
  retry: FailedPostRetryResult | null;
}

// POST /me/ai-assist/fixes — chỉ khi người dùng bấm "AI sửa nội dung" (postId = bài lỗi; bỏ trống = từ cảnh báo).
export async function startAiFix(contentVersionId: string, postId?: string | null): Promise<AiAssistJob> {
  const { data } = await client.post<ApiResponse<AiAssistJob>>("/me/ai-assist/fixes", { contentVersionId, postId: postId ?? null });
  return data.result;
}

// GET /me/ai-assist/jobs/{id} — poll tới SUCCESS/FAILED.
export async function getAiAssistJob(jobId: string): Promise<AiAssistJob> {
  const { data } = await client.get<ApiResponse<AiAssistJob>>(`/me/ai-assist/jobs/${jobId}`);
  return data.result;
}

// POST /me/ai-assist/fixes/{id}/apply — lưu nội dung đã duyệt (+ đăng lại ngay bài lỗi khi RETRY_NOW).
export async function applyAiFix(jobId: string, caption: string, hashtags: string[], action: AiFixApplyAction): Promise<AiFixApplyResult> {
  const { data } = await client.post<ApiResponse<AiFixApplyResult>>(`/me/ai-assist/fixes/${jobId}/apply`, { caption, hashtags, action });
  return data.result;
}

// POST /me/ai-assist/policy-check — gọi lại khi aiStatus PENDING/RUNNING (cache theo hash, không tạo job mới).
export async function checkPolicy(contentVersionId: string): Promise<PolicyCheckResult> {
  const { data } = await client.post<ApiResponse<PolicyCheckResult>>("/me/ai-assist/policy-check", { contentVersionId });
  return data.result;
}

// GET /me/ai-assist/usage — lượt AI kiểm tra đã dùng / tổng + số lần AI sửa mỗi bản, theo gói (admin chỉnh được).
export async function getAiAssistUsage(): Promise<AiAssistUsage> {
  const { data } = await client.get<ApiResponse<AiAssistUsage>>("/me/ai-assist/usage");
  return data.result;
}

/** Mã lỗi BE khi AI sửa bị chặn bởi gói: 2193 hết lần cho bản này, 2198 gói không gồm AI sửa — FE gợi ý nâng gói. */
export const AI_FIX_PLAN_LIMIT_CODES = [2193, 2198];

/** Job còn đang chạy (cần poll tiếp). */
export const isAiRunning = (status: AiAssistStatus | PolicyCheckAiStatus | null | undefined) =>
  status === "PENDING" || status === "RUNNING";
