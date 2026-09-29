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
/**
 * Kết quả "Kiểm tra kết nối" (AI service phân loại bằng classify_error). SUCCESS/FAILED = dữ liệu
 * cũ (trước 29/9) hoặc FAILED = lỗi khác (AI service không phản hồi...).
 */
export type AiTestStatus =
  | 'OK' | 'INVALID_KEY' | 'RATE_LIMITED' | 'DAILY_QUOTA_EXHAUSTED' | 'PROVIDER_OVERLOADED' | 'NETWORK_ERROR'
  | 'SUCCESS' | 'FAILED';
export type AiRouteHealth = 'OK' | 'DEGRADED' | 'ERROR';
export type AiModelBlockReason =
  | 'MODEL_DELETED'
  | 'MODEL_DISABLED'
  | 'PROVIDER_DISABLED'
  | 'PROVIDER_KEY_MISSING';

const P = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);

// ===== Nhà cung cấp & API key =====

/** Một model trong catalog đã đồng bộ từ API provider (giá là GỢI Ý từ bảng giá tự bảo trì). */
export interface AiCatalogModel {
  id: string;
  displayName?: string | null;
  maxInputTokens?: number | null;
  maxTokens?: number | null;
  suggestedInputPricePer1m?: number | null;
  suggestedOutputPricePer1m?: number | null;
}

export interface AiProviderInfo {
  id: string;
  code: AiProviderCode;
  name: string;
  /** null = chưa cấu hình key. */
  apiKeyMasked: string | null;
  enabled: boolean;
  lastTestedAt: string | null;
  lastTestStatus: AiTestStatus | null;
  /** Từng gặp 429 FreeTier (Google) — banner khuyên bật billing; null = chưa. Reset trạng thái model sẽ xoá. */
  freeTierDetectedAt: string | null;
  updatedAt: string | null;
  /** null = chưa đồng bộ; thứ tự như provider trả (Anthropic: mới nhất trước). */
  modelCatalog: AiCatalogModel[] | null;
  modelCatalogSyncedAt: string | null;
  /** Số nghiệp vụ có model chính/dự phòng thuộc provider này — cảnh báo trước khi tắt. */
  dependentTaskCount: number;
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
  /** Thông điệp lỗi rút gọn của provider khi không OK (đã redact — không chứa key). */
  message: string | null;
  latencyMs: number | null;
  /** Lần test này gặp 429 FreeTier (Google). */
  freeTier: boolean;
  testedAt: string;
}

/**
 * "Kiểm tra kết nối": BE nhờ AI service LIỆT KÊ model bằng key của provider (Gemini
 * GET /v1beta/models, Anthropic GET /v1/models) — không gọi generateContent, không tốn quota.
 */
export async function testAiProvider(id: string): Promise<AiTestResult> {
  const { data } = await client.post<ApiResponse<AiTestResult>>(`/admin/ai/providers/${id}/test`);
  return data.result;
}

/**
 * Đồng bộ catalog model từ API provider (Anthropic /v1/models, Google ListModels — qua AI
 * service). Cần key; provider KHÔNG trả giá — giá gợi ý join từ bảng giá tự bảo trì phía BE.
 */
export async function syncAiProviderModels(id: string): Promise<AiProviderInfo> {
  const { data } = await client.post<ApiResponse<AiProviderInfo>>(`/admin/ai/providers/${id}/sync-models`);
  return data.result;
}

/** Mức hiển thị của kết quả test: xanh = OK, vàng/cam = key hợp lệ nhưng nhà cung cấp tạm từ chối, đỏ = hỏng. */
export type AiTestTone = 'ok' | 'limited' | 'error';

export function aiTestTone(status: AiTestStatus | null): AiTestTone | null {
  if (status == null) return null;
  if (status === 'OK' || status === 'SUCCESS') return 'ok';
  if (status === 'RATE_LIMITED' || status === 'DAILY_QUOTA_EXHAUSTED' || status === 'PROVIDER_OVERLOADED') return 'limited';
  return 'error'; // INVALID_KEY, NETWORK_ERROR, FAILED
}

/** Nhãn ngắn (badge) + câu giải thích (ribbon/toast) cho một kết quả test. */
export function aiTestStatusText(lang: Lang, status: AiTestStatus, freeTier: boolean): { badge: string; detail: string } {
  switch (status) {
    case 'OK':
    case 'SUCCESS':
      return { badge: P(lang, 'Đã kết nối', 'Connected'), detail: P(lang, 'Kết nối thành công', 'Connection OK') };
    case 'DAILY_QUOTA_EXHAUSTED':
      return {
        badge: P(lang, 'Hết quota ngày', 'Daily quota used up'),
        detail: freeTier
          ? P(lang, 'Key hợp lệ — đang hết quota miễn phí trong ngày', 'Key is valid — free daily quota is used up')
          : P(lang, 'Key hợp lệ — đã hết quota trong ngày', 'Key is valid — daily quota is used up'),
      };
    case 'RATE_LIMITED':
      return {
        badge: P(lang, 'Bị giới hạn tốc độ', 'Rate limited'),
        detail: P(lang, 'Key hợp lệ — đang bị giới hạn tốc độ, thử lại sau ít phút', 'Key is valid — rate limited, try again in a few minutes'),
      };
    case 'PROVIDER_OVERLOADED':
      return {
        badge: P(lang, 'Nhà cung cấp quá tải', 'Provider overloaded'),
        detail: P(lang, 'Key hợp lệ — nhà cung cấp tạm quá tải', 'Key is valid — the provider is temporarily overloaded'),
      };
    case 'INVALID_KEY':
      return {
        badge: P(lang, 'Kết nối thất bại', 'Connection failed'),
        detail: P(lang, 'Kết nối thất bại — API key không hợp lệ hoặc đã bị thu hồi', 'Connection failed — the API key is invalid or revoked'),
      };
    case 'NETWORK_ERROR':
      return {
        badge: P(lang, 'Kết nối thất bại', 'Connection failed'),
        detail: P(lang, 'Kết nối thất bại — không kết nối được tới nhà cung cấp', 'Connection failed — could not reach the provider'),
      };
    default:
      return { badge: P(lang, 'Kết nối thất bại', 'Connection failed'), detail: P(lang, 'Kết nối thất bại', 'Connection failed') };
  }
}

export const aiFreeTierText = (lang: Lang) => ({
  banner: P(lang,
    'Đang dùng gói miễn phí của Google (giới hạn thấp). Hãy bật billing trong Google AI Studio để dùng cho môi trường thật.',
    "Using Google's free tier (low limits). Enable billing in Google AI Studio for production use."),
  since: (at: string) => P(lang, `Phát hiện lúc ${at}`, `Detected at ${at}`),
});

// ===== Trạng thái model (circuit breaker, Redis) =====

/** Một model đang bị cho nghỉ; model không có trong danh sách = khả dụng. */
export interface AiModelHealth {
  /** "google" / "anthropic" (chữ thường). */
  provider: string;
  model: string;
  state: 'COOLDOWN' | 'EXHAUSTED';
  reason: string;
  /** Hết nghỉ lúc (giờ ứng dụng, LocalDateTime). */
  until: string;
  freeTier: boolean;
  updatedAt: string;
}

export async function listAiModelHealth(): Promise<AiModelHealth[]> {
  const { data } = await client.get<ApiResponse<AiModelHealth[]>>('/admin/ai/model-health');
  return data.result;
}

/** "Reset trạng thái model": xoá cooldown/hết quota của mọi model thuộc provider — trả số model đã xoá. */
export async function resetAiModelHealth(providerId: string): Promise<number> {
  const { data } = await client.post<ApiResponse<number>>(`/admin/ai/providers/${providerId}/reset-model-health`);
  return data.result;
}

/** "14:00" nếu trong hôm nay, còn lại "30/09 14:00" (chuỗi giờ ứng dụng, không đổi múi giờ). */
const fmtUntil = (until: string): string => {
  const [date, time] = until.split('T');
  const hhmm = (time ?? '').slice(0, 5);
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return date === todayStr ? hhmm : `${date.slice(8, 10)}/${date.slice(5, 7)} ${hhmm}`;
};

export const aiModelHealthLabel = (lang: Lang, h: AiModelHealth): string => {
  const at = fmtUntil(h.until);
  if (h.state === 'EXHAUSTED') return P(lang, `Hết quota ngày · reset lúc ${at}`, `Daily quota exhausted · resets at ${at}`);
  if (h.reason === 'rate_limited') return P(lang, `Bị giới hạn tốc độ · thử lại lúc ${at}`, `Rate limited · retry at ${at}`);
  return P(lang, `Nhà cung cấp quá tải · tạm nghỉ tới ${at}`, `Provider overloaded · paused until ${at}`);
};

export const aiModelHealthText = (lang: Lang) => ({
  title: P(lang, 'Model đang tạm nghỉ', 'Models paused'),
  hint: P(lang, 'Hệ thống tự bỏ qua các model này khi tạo nội dung cho tới thời điểm trên.',
    'These models are skipped automatically until the time shown.'),
  reset: P(lang, 'Reset trạng thái model', 'Reset model status'),
  resetDone: (n: number) => P(lang, `Đã reset trạng thái ${n} model`, `Reset status of ${n} model(s)`),
});

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
  /** Trần max_tokens tham khảo của model (null = không rõ) — chỉ để gợi ý/cảnh báo. */
  maxTokens: number | null;
  /** Nghiệp vụ đang dùng model này làm chính/dự phòng — cảnh báo trước khi tắt/xóa. */
  usedByTaskCodes: AiTaskCode[] | null;
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
  maxTokens?: number | null;
}): Promise<AiModelInfo> {
  const { data } = await client.post<ApiResponse<AiModelInfo>>('/admin/ai/models', input);
  return data.result;
}

export async function updateAiModel(
  id: string,
  patch: {
    displayName?: string;
    enabled?: boolean;
    inputPricePer1m?: number | null;
    outputPricePer1m?: number | null;
    maxTokens?: number | null;
  },
): Promise<AiModelInfo> {
  const { data } = await client.put<ApiResponse<AiModelInfo>>(`/admin/ai/models/${id}`, patch);
  return data.result;
}

/** Xóa mềm — BE chặn khi model đang được routing dùng (mã 2015, hiển thị .message). */
export async function deleteAiModel(id: string): Promise<void> {
  await client.delete<ApiResponse<AiModelInfo>>(`/admin/ai/models/${id}`);
}

// ===== Định tuyến theo nghiệp vụ =====

/** Một model trong chuỗi dự phòng (position 0 = thử ngay sau model chính). */
export interface AiRoutingFallback {
  position: number;
  modelId: string;
  modelCode: string;
  providerCode: AiProviderCode;
}

/** Trần độ dài chuỗi dự phòng — khớp AiConfigServiceImpl.MAX_FALLBACKS. */
export const MAX_FALLBACKS = 5;

export interface AiRoutingInfo {
  id: string;
  taskCode: AiTaskCode;
  primaryModelId: string;
  primaryModelCode: string;
  primaryProviderCode: AiProviderCode;
  /** LEGACY = fallbacks[0]; dùng `fallbacks`. */
  fallbackModelId: string | null;
  fallbackModelCode: string | null;
  fallbackProviderCode: AiProviderCode | null;
  /** Chuỗi dự phòng theo thứ tự thử ([] = không dùng). */
  fallbacks: AiRoutingFallback[];
  temperature: number | null;
  maxTokens: number | null;
  enabled: boolean;
}

export async function listAiRouting(): Promise<AiRoutingInfo[]> {
  const { data } = await client.get<ApiResponse<AiRoutingInfo[]>>('/admin/ai/routing');
  return data.result;
}

/**
 * PUT = thay toàn bộ tham số của dòng routing (temperature/maxTokens null là XÓA).
 * `fallbackModelIds` = cả chuỗi dự phòng theo thứ tự ([] = không dùng) — BE chặn trùng / chứa
 * model chính (2047) / quá MAX_FALLBACKS (2048).
 */
export async function updateAiRouting(
  id: string,
  body: {
    primaryModelId: string;
    fallbackModelIds: string[];
    temperature?: number | null;
    maxTokens?: number | null;
    enabled: boolean;
  },
): Promise<AiRoutingInfo> {
  const { data } = await client.put<ApiResponse<AiRoutingInfo>>(`/admin/ai/routing/${id}`, body);
  return data.result;
}

// ===== Effective status (một nguồn sự thật, tính ở BE — GET /admin/ai/status) =====

export interface AiRouteStatus {
  routingId: string;
  taskCode: AiTaskCode;
  enabled: boolean;
  /** null khi route tắt (dùng env) — không tính vào degraded/error counts. */
  health: AiRouteHealth | null;
  /** null = model chính dùng được. */
  primaryBlockReason: AiModelBlockReason | null;
  /** null = dự phòng dùng được HOẶC không có dự phòng (phân biệt bằng hasFallback). */
  fallbackBlockReason: AiModelBlockReason | null;
  hasFallback: boolean;
}

export interface AiEffectiveStatus {
  /** false = AI_CONFIG_FROM_DB tắt: toàn bộ config DB không hiệu lực, usage KHÔNG được ghi. */
  fromDb: boolean;
  degradedCount: number;
  errorCount: number;
  routes: AiRouteStatus[];
}

/**
 * Lý do một model không dùng được — cùng luật BE `AiRuntimeConfigService.blockReason` (tính ở FE
 * từ danh sách model/provider để hiện mờ trong dropdown chuỗi dự phòng). null = dùng được.
 */
export function modelBlockReason(m: AiModelInfo, providers: AiProviderInfo[]): AiModelBlockReason | null {
  if (!m.enabled) return 'MODEL_DISABLED';
  const p = providers.find((x) => x.id === m.providerId);
  if (!p?.enabled) return 'PROVIDER_DISABLED';
  if (!p.apiKeyMasked) return 'PROVIDER_KEY_MISSING';
  return null;
}

/** Chuỗi dự phòng gợi ý mặc định: 3 model Gemini theo thứ tự, rồi Claude khi Anthropic bật + có key. */
export const SUGGESTED_GEMINI_CHAIN = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];

/**
 * Model id của chuỗi gợi ý — chỉ lấy model ĐÃ có trong danh sách, đang dùng được; bỏ model chính.
 * Claude = model Anthropic bật đầu tiên (ưu tiên sonnet), chỉ khi provider Anthropic dùng được.
 */
export function suggestedFallbackChain(models: AiModelInfo[], providers: AiProviderInfo[], primaryId: string): string[] {
  const usable = models.filter((m) => m.id !== primaryId && modelBlockReason(m, providers) === null);
  const gemini = SUGGESTED_GEMINI_CHAIN
    .map((code) => usable.find((m) => m.providerCode === 'GOOGLE' && m.modelCode === code))
    .filter((m): m is AiModelInfo => !!m);
  const claudes = usable.filter((m) => m.providerCode === 'ANTHROPIC');
  const claude = claudes.find((m) => m.modelCode.includes('sonnet')) ?? claudes[0];
  return [...gemini, ...(claude ? [claude] : [])].map((m) => m.id).slice(0, MAX_FALLBACKS);
}

export const aiFallbackText = (lang: Lang) => ({
  add: P(lang, '+ Thêm model dự phòng', '+ Add fallback model'),
  suggest: P(lang, 'Dùng gợi ý mặc định', 'Use default suggestion'),
  suggestHint: P(lang,
    'gemini-3.5-flash → gemini-3.1-flash-lite → gemini-2.5-flash → Claude (khi Anthropic bật và có key)',
    'gemini-3.5-flash → gemini-3.1-flash-lite → gemini-2.5-flash → Claude (when Anthropic is on with a key)'),
  suggestEmpty: P(lang, 'Chưa có model nào của chuỗi gợi ý trong danh sách model đang dùng được',
    'None of the suggested models are in the usable model list'),
  chainHint: P(lang, 'Thử lần lượt từ trên xuống khi model chính lỗi, quá tải hoặc hết quota.',
    'Tried top to bottom when the primary model fails, is overloaded or out of quota.'),
  max: P(lang, `Tối đa ${MAX_FALLBACKS} model dự phòng`, `Up to ${MAX_FALLBACKS} fallback models`),
  up: P(lang, 'Lên', 'Move up'),
  down: P(lang, 'Xuống', 'Move down'),
  remove: P(lang, 'Bỏ khỏi chuỗi', 'Remove'),
  answeredBy: (routed: string) => P(lang, `dự phòng cho ${routed}`, `fallback for ${routed}`),
});

export async function getAiStatus(): Promise<AiEffectiveStatus> {
  const { data } = await client.get<ApiResponse<AiEffectiveStatus>>('/admin/ai/status');
  return data.result;
}

// ===== Sử dụng & chi phí =====

export interface AiUsageRow {
  id: string;
  userEmail: string | null;
  taskCode: AiTaskCode;
  providerCode: AiProviderCode;
  /** Model THỰC SỰ trả lời (có thể là dự phòng) — chi phí tính theo model này. */
  modelCode: string;
  /** Model chính theo định tuyến; khác modelCode = dự phòng đã trả lời. null = đường env / row cũ. */
  routedModelCode: string | null;
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
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'TEST_CONNECTION' | 'SYNC_MODELS' | 'RESET_MODEL_HEALTH';
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
    SYNC_MODELS: P(lang, 'Đồng bộ model', 'Model sync'),
    RESET_MODEL_HEALTH: P(lang, 'Reset trạng thái model', 'Model status reset'),
  })[action] ?? action;

/** Lý do model không dùng được trong định tuyến (tooltip icon cảnh báo). */
export const aiBlockReasonLabel = (lang: Lang, reason: AiModelBlockReason): string =>
  ({
    MODEL_DELETED: P(lang, 'Model đã bị xóa', 'Model deleted'),
    MODEL_DISABLED: P(lang, 'Model đang tắt', 'Model disabled'),
    PROVIDER_DISABLED: P(lang, 'Nhà cung cấp đang tắt', 'Provider disabled'),
    PROVIDER_KEY_MISSING: P(lang, 'Nhà cung cấp chưa có API key', 'Provider has no API key'),
  })[reason] ?? reason;

export const fmtAiDateTime = (iso: string | null): string =>
  iso ? iso.slice(0, 16).replace('T', ' ') : '—';
