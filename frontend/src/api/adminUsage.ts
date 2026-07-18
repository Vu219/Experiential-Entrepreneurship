import client, { type ApiResponse, type PageResponse } from './apiClient';
import type { UserUsage } from './usage';
import type { AiTaskCode } from './adminAi';

// Trang admin "Token & hạn mức" (/admin/usage) — usage token đối chiếu hạn mức gói,
// gộp từ event log ai_usage phía backend. Hạn mức vẫn sửa ở trang Quản lý gói;
// cấp thêm/reset ghi audit append-only vào usage_adjustments.

export interface PlanUsage {
  planId: string;
  planCode: string;
  planNameVi: string;
  planNameEn: string;
  isActive: boolean;
  /** Hạn mức MỖI user/kỳ; null = không giới hạn. */
  monthlyTokenLimit: number | null;
  userCount: number;
  totalTokens: number;
  estimatedCost: number | null;
}

export interface AdminUserUsageRow {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  planCode: string;
  used: number;
  limit: number | null;
}

/** '' = tất cả; warning = ≥80% chưa vượt; exceeded = ≥100%. */
export type UsageThresholdFilter = '' | 'warning' | 'exceeded';

export interface UsageAdjustment {
  id: string;
  type: 'GRANT' | 'RESET';
  source: 'ADMIN_GRANT' | 'PURCHASE' | 'PROMO';
  deltaTokens: number | null;
  reason: string | null;
  actorEmail: string | null;
  billingPeriod: string;
  createdAt: string;
}

export interface AdminUserUsageDetail {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  usage: UserUsage;
  /** Phần vượt hạn mức mà credit KHÔNG đủ trả kỳ này — lượng "rò" qua chỗ chặn (cho phép âm, không rollback). */
  creditShortfall: number | null;
  adjustments: UsageAdjustment[];
}

export async function getUsageByPlan(): Promise<PlanUsage[]> {
  const { data } = await client.get<ApiResponse<PlanUsage[]>>('/admin/usage/by-plan');
  return data.result;
}

export async function getUsageByUser(params: {
  filter?: UsageThresholdFilter;
  q?: string;
  page: number;
  size?: number;
}): Promise<PageResponse<AdminUserUsageRow>> {
  const { data } = await client.get<ApiResponse<PageResponse<AdminUserUsageRow>>>('/admin/usage/by-user', {
    params: {
      filter: params.filter || undefined,
      q: params.q?.trim() || undefined,
      page: params.page,
      size: params.size ?? 10,
    },
  });
  return data.result;
}

export async function getUserUsageDetail(userId: string): Promise<AdminUserUsageDetail> {
  const { data } = await client.get<ApiResponse<AdminUserUsageDetail>>(`/admin/usage/users/${userId}`);
  return data.result;
}

export async function grantTokens(userId: string, tokens: number, reason?: string): Promise<UsageAdjustment> {
  const { data } = await client.post<ApiResponse<UsageAdjustment>>(`/admin/usage/users/${userId}/grant`, {
    tokens,
    reason: reason?.trim() || undefined,
  });
  return data.result;
}

export async function resetUsage(userId: string, reason?: string): Promise<UsageAdjustment> {
  const { data } = await client.post<ApiResponse<UsageAdjustment>>(`/admin/usage/users/${userId}/reset`, {
    reason: reason?.trim() || undefined,
  });
  return data.result;
}

/** Dựng lại cache users.tokens_used từ event log — trả số user được cập nhật. */
export async function reconcileUsage(): Promise<number> {
  const { data } = await client.post<ApiResponse<number>>('/admin/usage/reconcile');
  return data.result;
}

// ===== Tab Tổng quan (đọc từ rollup usage_hourly, kỳ = tháng lịch) =====

export interface UsageTaskStat {
  taskCode: AiTaskCode;
  totalTokens: number;
  requests: number;
  errors: number;
  costUsd: number | null;
}

export interface UsageModelStat {
  providerCode: string;
  modelCode: string;
  totalTokens: number;
  costUsd: number | null;
}

export interface UsageTopUser {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  totalTokens: number;
  costUsd: number | null;
}

export interface UsageOverview {
  periodStart: string;
  periodEnd: string;
  totalTokens: number;
  billableUnits: number;
  creditUnits: number;
  costUsd: number | null;
  requests: number;
  errors: number;
  prevTotalTokens: number | null;
  /** null = kỳ trước không có dữ liệu để so. */
  tokenDeltaPct: number | null;
  topFeatures: UsageTaskStat[];
  topModels: UsageModelStat[];
  topUsers: UsageTopUser[];
}

export interface HeatmapPoint {
  /** Bucket giờ theo GIỜ VN. */
  bucket: string;
  totalTokens: number;
  requests: number;
  errors: number;
  costUsd: number | null;
  /** Trung bình đã LOẠI event không đo được; null = không có số. */
  latencyAvgMs: number | null;
}

export async function getUsageOverview(): Promise<UsageOverview> {
  const { data } = await client.get<ApiResponse<UsageOverview>>('/admin/usage/overview');
  return data.result;
}

export async function getUsageHeatmap(params?: { days?: number; userId?: string }): Promise<HeatmapPoint[]> {
  const { data } = await client.get<ApiResponse<HeatmapPoint[]>>('/admin/usage/heatmap', {
    params: { days: params?.days ?? 7, userId: params?.userId || undefined },
  });
  return data.result;
}

// ===== Tab Nhật ký sử dụng (event ai_usage — cursor pagination, KHÔNG offset) =====
// Retention BE: SUCCESS 90 ngày, ERROR/TIMEOUT 180 ngày (UsageRetentionJob) — UI phải nói rõ.

export type AiUsageEventStatus = 'SUCCESS' | 'ERROR' | 'TIMEOUT';

export interface UsageEvent {
  id: string;
  createdAt: string;
  userEmail: string | null;
  userFullName: string | null;
  taskCode: AiTaskCode;
  providerCode: string;
  modelCode: string;
  /** null = "không biết" (event lỗi / provider không báo) — KHÁC 0. */
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  totalTokens: number;
  /** null (row cũ) → hiển thị totalTokens. */
  billableUnits: number | null;
  creditUnits: number | null;
  latencyMs: number | null;
  estimatedCost: number | null;
  status: AiUsageEventStatus;
  requestId: string | null;
}

/** IP/UA lấy RIÊNG theo event — BE ghi audit mỗi lần gọi (dữ liệu cá nhân). */
export interface UsageEventMeta {
  clientIp: string | null;
  userAgent: string | null;
}

export interface CursorPage<T> {
  items: T[];
  /** null = hết dữ liệu; truyền lại nguyên văn để lấy trang kế. */
  nextCursor: string | null;
}

export interface UsageEventFilter {
  /** ISO datetime (BE lọc theo giờ VN — cùng quy ước created_at). */
  from?: string;
  to?: string;
  userId?: string;
  taskCode?: AiTaskCode | '';
  model?: string;
  status?: AiUsageEventStatus | '';
  minTokens?: number;
  minCost?: number;
}

const eventParams = (f: UsageEventFilter) => ({
  from: f.from || undefined,
  to: f.to || undefined,
  userId: f.userId || undefined,
  taskCode: f.taskCode || undefined,
  model: f.model?.trim() || undefined,
  status: f.status || undefined,
  minTokens: f.minTokens || undefined,
  minCost: f.minCost || undefined,
});

export async function getUsageEvents(f: UsageEventFilter, cursor: string | null, size = 25): Promise<CursorPage<UsageEvent>> {
  const { data } = await client.get<ApiResponse<CursorPage<UsageEvent>>>('/admin/usage/events', {
    params: { ...eventParams(f), cursor: cursor || undefined, size },
  });
  return data.result;
}

export async function getEventMeta(eventId: string): Promise<UsageEventMeta> {
  const { data } = await client.get<ApiResponse<UsageEventMeta>>(`/admin/usage/events/${eventId}/meta`);
  return data.result;
}

export async function countUsageEvents(f: UsageEventFilter): Promise<number> {
  const { data } = await client.get<ApiResponse<number>>('/admin/usage/events/count', { params: eventParams(f) });
  return data.result;
}

/** CSV dạng chuỗi — FE tự tạo Blob tải về. Vượt 50K dòng → lỗi 2031 (FE báo kèm số từ count). */
export async function exportUsageEvents(f: UsageEventFilter): Promise<string> {
  const { data } = await client.get<ApiResponse<string>>('/admin/usage/events/export', { params: eventParams(f) });
  return data.result;
}

// ===== Cảnh báo bất thường (usage_alerts — pha 5A alert-only) =====

export type UsageAlertRule =
  | 'HIGH_REQUEST_RATE' | 'QUOTA_BURST' | 'DAILY_SPIKE' | 'MULTI_CLIENT'
  | 'SYSTEM_ERROR_RATE' | 'USER_COST' | 'CREDIT_SHORTFALL' | 'ADMIN_GRANT_ANOMALY' | 'SYSTEM_COST';

export interface UsageAlert {
  id: string;
  ruleCode: UsageAlertRule;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  /** null = alert cấp hệ thống (R5/R9). */
  userId: string | null;
  userEmail: string | null;
  message: string;
  /** JSON số liệu lúc phát hiện. */
  data: string | null;
  status: 'OPEN' | 'ACKED';
  occurrenceCount: number;
  firstSeen: string;
  lastSeen: string;
  falsePositive: boolean | null;
  ackedByEmail: string | null;
  ackedAt: string | null;
}

export interface AlertRuleStat {
  ruleCode: UsageAlertRule;
  total: number;
  falsePositives: number;
  /** null khi total = 0. */
  falsePositivePct: number | null;
}

export async function getAlerts(params?: { status?: 'OPEN' | 'ACKED'; userId?: string }): Promise<UsageAlert[]> {
  const { data } = await client.get<ApiResponse<UsageAlert[]>>('/admin/usage/alerts', {
    params: { status: params?.status || undefined, userId: params?.userId || undefined },
  });
  return data.result;
}

/** ACK (đặt cooldown); falsePositive=true = đánh dấu báo nhầm — nuôi báo cáo FP. */
export async function ackAlert(alertId: string, falsePositive: boolean): Promise<UsageAlert> {
  const { data } = await client.post<ApiResponse<UsageAlert>>(`/admin/usage/alerts/${alertId}/ack`, { falsePositive });
  return data.result;
}

export async function getAlertStats(): Promise<AlertRuleStat[]> {
  const { data } = await client.get<ApiResponse<AlertRuleStat[]>>('/admin/usage/alerts/stats');
  return data.result;
}

export async function getAlertConfig(): Promise<Record<string, string>> {
  const { data } = await client.get<ApiResponse<Record<string, string>>>('/admin/usage/alert-config');
  return data.result;
}

/** Chỉ nhận key hợp lệ (whitelist BE); giá trị số không âm; 0 = tắt rule. */
export async function updateAlertConfig(changes: Record<string, string>): Promise<Record<string, string>> {
  const { data } = await client.put<ApiResponse<Record<string, string>>>('/admin/usage/alert-config', changes);
  return data.result;
}

// ===== Trang chi tiết user (/admin/usage/users/:id) =====

/** Audit cấp/reset TOÀN THỜI GIAN (không chỉ kỳ hiện tại). */
export async function getUserAdjustmentsAllTime(userId: string): Promise<UsageAdjustment[]> {
  const { data } = await client.get<ApiResponse<UsageAdjustment[]>>(`/admin/usage/users/${userId}/adjustments`);
  return data.result;
}

export interface UserSessions {
  activeSessionCount: number;
  recentClients: { clientIp: string; userAgent: string | null; requestCount: number; lastSeenAt: string }[];
}

/** Trả IP → BE ghi audit mỗi lần gọi. */
export async function getUserSessions(userId: string): Promise<UserSessions> {
  const { data } = await client.get<ApiResponse<UserSessions>>(`/admin/usage/users/${userId}/sessions`);
  return data.result;
}

// ===== Hệ số quy đổi hạn mức (billing_rates — tab "Hệ số quy đổi") =====
// KHÁC đơn giá USD nhà cung cấp (trang Sử dụng & chi phí): hệ số này quyết định
// billable_units trừ vào hạn mức gói của KHÁCH. Append-only versioning.

export interface BillingRate {
  id: string;
  /** null = mọi nghiệp vụ. */
  taskCode: AiTaskCode | null;
  /** null = mọi model. */
  modelCode: string | null;
  unitType: 'TOKEN_TOTAL' | 'TOKEN_IN' | 'TOKEN_OUT' | 'REQUEST' | 'IMAGE' | 'SECOND';
  multiplier: number;
  minCharge: number | null;
  effectiveFrom: string;
  /** null = đang hiệu lực. */
  effectiveTo: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

export async function getBillingRates(): Promise<BillingRate[]> {
  const { data } = await client.get<ApiResponse<BillingRate[]>>('/admin/usage/rates');
  return data.result;
}

/** Thêm VERSION mới (BE tự đóng version đang mở cùng scope). MVP chỉ dùng TOKEN_TOTAL. */
export async function createBillingRate(params: {
  taskCode: AiTaskCode | null;
  modelCode?: string;
  multiplier: number;
  minCharge?: number;
}): Promise<BillingRate> {
  const { data } = await client.post<ApiResponse<BillingRate>>('/admin/usage/rates', {
    taskCode: params.taskCode || undefined,
    modelCode: params.modelCode?.trim() || undefined,
    unitType: 'TOKEN_TOTAL',
    multiplier: params.multiplier,
    minCharge: params.minCharge ?? undefined,
  });
  return data.result;
}
