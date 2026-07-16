import type { Lang } from '../types';
import client, { type ApiResponse, type PageResponse } from './apiClient';

// 2026-07-17: Cấu hình AI theo DB (cụm trang admin "Cấu hình AI") — nối BE thật /admin/ai/*.
// API key KHÔNG bao giờ rời backend ở dạng full: mọi response chỉ mang `apiKeyMasked`
// ("••••" + 4 ký tự cuối); gửi key mới qua trường write-only `apiKey` (SEC-03).

export type AiProviderCode = 'ANTHROPIC' | 'GOOGLE';
export type AiTaskCode =
  | 'CONTENT_GENERATION'
  | 'PLATFORM_FORMATTING'
  | 'TREND_RESEARCH'
  | 'GOLDEN_HOURS'
  | 'STRATEGY_OPTIMIZATION'
  | 'CONTENT_REGENERATION';
export type AiTestStatus = 'SUCCESS' | 'FAILED';

const P = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);

// ===== Nhà cung cấp & API key =====

export interface AiProviderInfo {
  id: string;
  code: AiProviderCode;
  name: string;
  /** null = chưa cấu hình key. */
  apiKeyMasked: string | null;
  enabled: boolean;
  lastTestedAt: string | null;
  lastTestStatus: AiTestStatus | null;
  updatedAt: string | null;
}

export async function listAiProviders(): Promise<AiProviderInfo[]> {
  const { data } = await client.get<ApiResponse<AiProviderInfo[]>>('/admin/ai/providers');
  return data.result;
}

/** `apiKey` là write-only: bỏ trống/undefined = giữ key hiện tại. */
export async function updateAiProvider(
  id: string,
  patch: { name?: string; apiKey?: string; enabled?: boolean },
): Promise<AiProviderInfo> {
  const { data } = await client.put<ApiResponse<AiProviderInfo>>(`/admin/ai/providers/${id}`, patch);
  return data.result;
}

export interface AiTestResult {
  status: AiTestStatus;
  /** Thông điệp lỗi rút gọn khi FAILED (đã redact — không chứa key). */
  message: string | null;
  latencyMs: number | null;
  testedAt: string;
}

/** "Kiểm tra kết nối": BE gọi AI service chạy 1 call model tối thiểu bằng key của provider. */
export async function testAiProvider(id: string): Promise<AiTestResult> {
  const { data } = await client.post<ApiResponse<AiTestResult>>(`/admin/ai/providers/${id}/test`);
  return data.result;
}

// ===== Model =====

export interface AiModelInfo {
  id: string;
  providerId: string;
  providerCode: AiProviderCode;
  modelCode: string;
  displayName: string | null;
  enabled: boolean;
  /** Đơn giá USD / 1M token — chỉ để ước tính chi phí; null = chưa khai. */
  inputPricePer1m: number | null;
  outputPricePer1m: number | null;
}

export async function listAiModels(): Promise<AiModelInfo[]> {
  const { data } = await client.get<ApiResponse<AiModelInfo[]>>('/admin/ai/models');
  return data.result;
}

export async function createAiModel(input: {
  providerId: string;
  modelCode: string;
  displayName?: string;
  inputPricePer1m?: number | null;
  outputPricePer1m?: number | null;
}): Promise<AiModelInfo> {
  const { data } = await client.post<ApiResponse<AiModelInfo>>('/admin/ai/models', input);
  return data.result;
}

export async function updateAiModel(
  id: string,
  patch: { displayName?: string; enabled?: boolean; inputPricePer1m?: number | null; outputPricePer1m?: number | null },
): Promise<AiModelInfo> {
  const { data } = await client.put<ApiResponse<AiModelInfo>>(`/admin/ai/models/${id}`, patch);
  return data.result;
}

/** Xóa mềm — BE chặn khi model đang được routing dùng (mã 2015, hiển thị .message). */
export async function deleteAiModel(id: string): Promise<void> {
  await client.delete<ApiResponse<AiModelInfo>>(`/admin/ai/models/${id}`);
}

// ===== Định tuyến theo nghiệp vụ =====

export interface AiRoutingInfo {
  id: string;
  taskCode: AiTaskCode;
  primaryModelId: string;
  primaryModelCode: string;
  primaryProviderCode: AiProviderCode;
  fallbackModelId: string | null;
  fallbackModelCode: string | null;
  fallbackProviderCode: AiProviderCode | null;
  temperature: number | null;
  maxTokens: number | null;
  enabled: boolean;
}

export async function listAiRouting(): Promise<AiRoutingInfo[]> {
  const { data } = await client.get<ApiResponse<AiRoutingInfo[]>>('/admin/ai/routing');
  return data.result;
}

/** PUT = thay toàn bộ tham số của dòng routing (fallback/temperature/maxTokens null là XÓA). */
export async function updateAiRouting(
  id: string,
  body: {
    primaryModelId: string;
    fallbackModelId?: string | null;
    temperature?: number | null;
    maxTokens?: number | null;
    enabled: boolean;
  },
): Promise<AiRoutingInfo> {
  const { data } = await client.put<ApiResponse<AiRoutingInfo>>(`/admin/ai/routing/${id}`, body);
  return data.result;
}

// ===== Sử dụng & chi phí =====

export interface AiUsageRow {
  id: string;
  userEmail: string | null;
  taskCode: AiTaskCode;
  providerCode: AiProviderCode;
  modelCode: string;
  totalTokens: number;
  estimatedCost: number | null;
  createdAt: string;
}

export async function getAiUsage(page: number, size = 20): Promise<PageResponse<AiUsageRow>> {
  const { data } = await client.get<ApiResponse<PageResponse<AiUsageRow>>>('/admin/ai/usage', {
    params: { page, size },
  });
  return data.result;
}

export interface AiUsageSummary {
  month: string; // "YYYY-MM"
  totalTokens: number;
  estimatedCost: number | null;
  byTask: { taskCode: AiTaskCode; totalTokens: number; estimatedCost: number | null }[];
  byModel: { providerCode: AiProviderCode; modelCode: string; totalTokens: number; estimatedCost: number | null }[];
}

export async function getAiUsageSummary(month?: string): Promise<AiUsageSummary> {
  const { data } = await client.get<ApiResponse<AiUsageSummary>>('/admin/ai/usage/summary', {
    params: { month: month || undefined },
  });
  return data.result;
}

// ===== Audit log =====

export interface AiAuditRow {
  id: string;
  actorEmail: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'TEST_CONNECTION';
  entityType: string;
  entityId: string;
  beforeSnapshot: string | null;
  afterSnapshot: string | null;
  createdAt: string;
}

export async function getAiAudit(page: number, size = 20): Promise<PageResponse<AiAuditRow>> {
  const { data } = await client.get<ApiResponse<PageResponse<AiAuditRow>>>('/admin/ai/audit', {
    params: { page, size },
  });
  return data.result;
}

// ===== Trạng thái AI service (badge link sang /admin/system) =====

/** Đọc service `aiService` từ GET /admin/system (FR-81) — không có endpoint riêng. */
export async function getAiServiceStatus(): Promise<'UP' | 'DOWN' | 'UNKNOWN'> {
  try {
    const { data } = await client.get<ApiResponse<{ services: { name: string; status: 'UP' | 'DOWN' }[] }>>('/admin/system');
    const svc = data.result.services.find((s) => s.name === 'aiService');
    return svc ? svc.status : 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

// ===== Nhãn hiển thị (cùng pattern meta-label của api/admin.ts) =====

export const aiTaskLabel = (lang: Lang, task: AiTaskCode): string =>
  ({
    CONTENT_GENERATION: P(lang, 'Tạo nội dung', 'Content generation'),
    PLATFORM_FORMATTING: P(lang, 'Định dạng nền tảng', 'Platform formatting'),
    TREND_RESEARCH: P(lang, 'Nghiên cứu xu hướng', 'Trend research'),
    GOLDEN_HOURS: P(lang, 'Khung giờ vàng', 'Golden hours'),
    STRATEGY_OPTIMIZATION: P(lang, 'Tối ưu chiến lược', 'Strategy optimization'),
    CONTENT_REGENERATION: P(lang, 'Tạo lại nội dung', 'Content regeneration'),
  })[task] ?? task;

export const aiAuditActionLabel = (lang: Lang, action: AiAuditRow['action']): string =>
  ({
    CREATE: P(lang, 'Tạo mới', 'Created'),
    UPDATE: P(lang, 'Cập nhật', 'Updated'),
    DELETE: P(lang, 'Xóa', 'Deleted'),
    TEST_CONNECTION: P(lang, 'Kiểm tra kết nối', 'Connection test'),
  })[action] ?? action;

export const fmtAiDateTime = (iso: string | null): string =>
  iso ? iso.slice(0, 16).replace('T', ' ') : '—';
