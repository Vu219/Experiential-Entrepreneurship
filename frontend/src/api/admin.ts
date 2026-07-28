import type { Lang } from '../types';
import type { Tone } from '../components/admin/StatusBadge';
import client, { type ApiError, type ApiResponse, type PageResponse } from './apiClient';

// 2026-07-12: Quản lý người dùng (FR-80) nối BE thật hoàn toàn — list/stats/detail/create/update/
// đổi gói/khoá-mở/đặt lại mật khẩu. Lọc/tìm/phân trang server-side. Các module khác (bài lỗi,
// system status, logs) đã nối BE từ trước. Gói dịch vụ nối BE thật ở api/plans.ts.
// 2026-07-20: Doanh thu nối BE thật ở api/revenue.ts (bảng `payments`) — mock đã gỡ.
// Còn MOCK: platform versions.

// Giả lập độ trễ mạng cho module còn mock (platform versions).
const delay = <T>(value: T, ms = 450): Promise<T> => new Promise((r) => setTimeout(() => r(value), ms));

const P = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);
/** Chữ cái đầu làm avatar dự phòng khi user chưa có ảnh — dùng chung cho mọi bảng quản trị. */
export const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(-2).join('').toUpperCase();

export const formatVND = (n: number) => n.toLocaleString('vi-VN') + '₫';

// ===== Quản lý người dùng (FR-80) =====
export type UserRole = 'USER' | 'ADMIN';
// Khớp enum BE (UserStatus): ACTIVE / LOCKED / PENDING_DELETE.
export type UserStatus = 'ACTIVE' | 'LOCKED' | 'PENDING_DELETE';
export type UserPlan = 'FREE' | 'PLUS' | 'PRO';
export type AuthProvider = 'EMAIL' | 'GOOGLE';

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  plan: UserPlan;
  authProvider: AuthProvider;
  avatarUrl?: string;
  initials: string;
  createdAt: string; // 'YYYY-MM-DD'
  /** 'YYYY-MM-DD HH:mm' — null = chưa đăng nhập lần nào. */
  lastLoginAt: string | null;
  /** Số kênh MXH đã kết nối — chỉ có khi lấy chi tiết (GET /users/{id}). */
  connectedChannels?: number;
  /** Hạn xóa vĩnh viễn (ISO) — chỉ có khi status = PENDING_DELETE. */
  deletionDate?: string;
}

// Mã lỗi guard phía BE (đồng bộ ErrorCode) — UI xử lý theo code.
export const ADMIN_ERR = {
  ADMIN_PROTECTED: 1972,
  CANNOT_DEMOTE_SELF: 1974,
  EMAIL_LOCKED_GOOGLE: 1975,
  GOOGLE_NO_PASSWORD: 1976,
  EMAIL_EXISTED: 1003,
} as const;
const ERR_USER_LIST_EMPTY = 1018;

// Shape UserResponse của backend (GET /users, admin).
interface BeUser {
  id: string;
  username: string | null;
  fullName: string | null;
  email: string;
  phone: string | null;
  status: UserStatus;
  plan: UserPlan | null;
  provider: AuthProvider | null;
  avatarUrl: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  deletionDate: string | null;
  connectedChannels: number | null;
  role: { roleName: UserRole } | null;
}

const beDateTime = (iso: string | null): string | null => (iso ? iso.slice(0, 16).replace('T', ' ') : null);

const toRow = (u: BeUser): AdminUserRow => ({
  id: u.id,
  name: u.fullName || u.email,
  email: u.email,
  phone: u.phone ?? undefined,
  role: u.role?.roleName === 'ADMIN' ? 'ADMIN' : 'USER',
  status: u.status,
  plan: u.plan ?? 'FREE',
  authProvider: u.provider === 'GOOGLE' ? 'GOOGLE' : 'EMAIL',
  avatarUrl: u.avatarUrl ?? undefined,
  initials: initials(u.fullName || u.email),
  createdAt: (u.createdAt ?? '').slice(0, 10),
  lastLoginAt: beDateTime(u.lastActiveAt),
  connectedChannels: u.connectedChannels ?? undefined,
  deletionDate: u.deletionDate ?? undefined,
});

export interface UserQuery {
  page: number; // 0-based (Spring Pageable)
  size: number;
  q?: string;
  role?: UserRole;
  status?: UserStatus;
  plan?: UserPlan;
  sort?: string; // vd 'createdAt,desc'
}
export interface UsersPage { rows: AdminUserRow[]; total: number; pageCount: number; page: number; }

// GET /users — phân trang + lọc server-side (FR-80).
export async function getAdminUsers(query: UserQuery): Promise<UsersPage> {
  try {
    const { data } = await client.get<ApiResponse<PageResponse<BeUser>>>('/users', {
      params: {
        page: query.page,
        size: query.size,
        sort: query.sort ?? 'createdAt,desc',
        q: query.q?.trim() || undefined,
        role: query.role,
        status: query.status,
        plan: query.plan,
      },
    });
    const p = data.result;
    return { rows: p.content.map(toRow), total: p.totalElements, pageCount: p.totalPages, page: p.page };
  } catch (e) {
    // BE trả 1018 khi kết quả rỗng (kể cả khi lọc không khớp) → coi như trang rỗng.
    if ((e as ApiError).code === ERR_USER_LIST_EMPTY) return { rows: [], total: 0, pageCount: 0, page: 0 };
    throw e;
  }
}

export interface UserStats { total: number; active: number; locked: number; newThisMonth: number; }

// GET /users/stats — 4 số cho stat card (server-side nên không tính từ mảng client).
export async function getUserStats(): Promise<UserStats> {
  const { data } = await client.get<ApiResponse<UserStats>>('/users/stats');
  return data.result;
}

// GET /users/{id} — chi tiết (kèm connectedChannels).
export async function getAdminUser(id: string): Promise<AdminUserRow> {
  const { data } = await client.get<ApiResponse<BeUser>>(`/users/${id}`);
  return toRow(data.result);
}

export interface AdminUserPatch {
  name?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  plan?: UserPlan;
  status?: UserStatus;
  avatarUrl?: string;
}

// PATCH /users/{id} — admin cập nhật (partial). Đổi gói riêng cũng đi qua đây.
export async function updateAdminUser(id: string, patch: AdminUserPatch): Promise<AdminUserRow> {
  const { data } = await client.patch<ApiResponse<BeUser>>(`/users/${id}`, {
    fullName: patch.name,
    email: patch.email,
    phone: patch.phone,
    role: patch.role,
    plan: patch.plan,
    status: patch.status,
    avatarUrl: patch.avatarUrl,
  });
  return toRow(data.result);
}

// Đổi gói (dùng chung endpoint partial) — tách hàm để confirm + audit rõ ràng.
export const changeUserPlan = (id: string, plan: UserPlan) => updateAdminUser(id, { plan });

// POST /users — admin tạo tài khoản thủ công (mặc định FREE).
export async function createAdminUser(input: {
  name: string; email: string; password: string; phone?: string; role: UserRole; plan: UserPlan;
}): Promise<AdminUserRow> {
  const { data } = await client.post<ApiResponse<BeUser>>('/users', {
    fullName: input.name,
    email: input.email,
    password: input.password,
    phone: input.phone,
    role: input.role,
    plan: input.plan,
  });
  return toRow(data.result);
}

// PATCH /users/{id}/status — khoá/mở khoá (ADMIN được BE bảo vệ → mã 1972).
export async function setUserLocked(id: string, locked: boolean): Promise<{ id: string; status: UserStatus }> {
  try {
    const { data } = await client.patch<ApiResponse<BeUser>>(`/users/${id}/status`, {
      status: locked ? 'LOCKED' : 'ACTIVE',
    });
    return { id, status: data.result.status };
  } catch (e) {
    if ((e as ApiError).code === ADMIN_ERR.ADMIN_PROTECTED) throw new Error('ADMIN_PROTECTED');
    throw e;
  }
}

// POST /users/{id}/reset-password — BE gửi OTP đặt lại mật khẩu tới email user (admin không thấy mật khẩu).
export async function adminResetPassword(id: string): Promise<void> {
  await client.post<ApiResponse<string>>(`/users/${id}/reset-password`);
}

// DELETE /users/{id} — xóa CỨNG tài khoản + cascade toàn bộ dữ liệu liên quan (ADMIN được BE bảo vệ → 1972).
export async function deleteAdminUser(id: string): Promise<void> {
  try {
    await client.delete<ApiResponse<string>>(`/users/${id}`);
  } catch (e) {
    if ((e as ApiError).code === ADMIN_ERR.ADMIN_PROTECTED) throw new Error('ADMIN_PROTECTED');
    throw e;
  }
}

export const userStatusMeta = (lang: Lang, s: UserStatus): { tone: Tone; label: string } =>
  s === 'ACTIVE' ? { tone: 'success', label: P(lang, 'Hoạt động', 'Active') }
  : s === 'LOCKED' ? { tone: 'danger', label: P(lang, 'Đã khoá', 'Locked') }
  : { tone: 'warning', label: P(lang, 'Chờ xoá', 'Pending deletion') };

export const userPlanMeta = (p: UserPlan): { tone: Tone; label: string } =>
  p === 'FREE' ? { tone: 'neutral', label: 'Free' } : p === 'PLUS' ? { tone: 'info', label: 'Plus' } : { tone: 'purple', label: 'Pro' };

/** Thời gian tương đối cho "Lần đăng nhập gần nhất". */
export function timeAgo(lang: Lang, iso: string | null): string {
  if (!iso) return P(lang, 'Chưa đăng nhập', 'Never');
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso.replace(' ', 'T')).getTime()) / 60000));
  if (mins < 1) return P(lang, 'Vừa xong', 'Just now');
  if (mins < 60) return P(lang, `${mins} phút trước`, `${mins}m ago`);
  const hours = Math.round(mins / 60);
  if (hours < 24) return P(lang, `${hours} giờ trước`, `${hours}h ago`);
  const days = Math.round(hours / 24);
  if (days < 30) return P(lang, `${days} ngày trước`, `${days}d ago`);
  const months = Math.round(days / 30);
  return P(lang, `${months} tháng trước`, `${months}mo ago`);
}

// ===== Bài đăng lỗi & bị từ chối (FR-82 + FR-83) — /admin/posts/failed =====
// Hai tab của trang: 'rejected' = bị nền tảng từ chối vì vi phạm chính sách (FR-82),
// 'system' = lỗi kỹ thuật khi đăng (FR-83). Lọc/tìm/sắp xếp/phân trang ĐỀU server-side —
// FE không tự cắt mảng, và KHÔNG tự đếm badge tab (số lấy từ summary bên dưới).

export type PostProblemKind = 'rejected' | 'system';
/** Khớp enum PublishErrorType phía backend. */
export type PublishErrorType = 'TEMPORARY' | 'PERMANENT' | 'POLICY_VIOLATION';
/** Nền tảng trong scope MVP (CLAUDE.md §2) — cùng tag với PLATFORM_BG ở theme.ts. */
export type AdminPostPlatform = 'FB' | 'IG' | 'TH';

export interface AdminPostProblem {
  id: string;
  /** Email chủ bài — null phía BE khi user đã bị xoá. */
  user: string;
  accountName: string | null;
  platform: AdminPostPlatform;
  kind: PostProblemKind;
  errorType: PublishErrorType | null;
  /** Mã lỗi GỐC từ nền tảng (FR-35), vd '368' / '190'. */
  errorCode: string | null;
  errorMessage: string | null;
  /** Số lần đã thử lại (FR-56) — chỉ có ý nghĩa ở tab lỗi hệ thống. */
  retryCount: number | null;
  /** 'YYYY-MM-DD HH:mm' — lần thử lại kế tiếp, null khi đã hết lượt. */
  nextRetryAt: string | null;
  content: string;
  /** 'YYYY-MM-DD HH:mm' thời điểm thất bại chung cuộc. */
  date: string;
}

export type PostProblemSort = 'newest' | 'oldest';

export interface PostProblemFilter {
  kind: PostProblemKind;
  platform?: AdminPostPlatform;
  errorType?: PublishErrorType;
  /** 'YYYY-MM-DD'; `to` BAO GỒM cả ngày đó (cùng quy ước log hoạt động). */
  from?: string;
  to?: string;
  q?: string;
}

export interface PostProblemQuery extends PostProblemFilter {
  sort: PostProblemSort;
  page: number; // 0-based (Spring Pageable)
  size: number;
}

export interface PostProblemPage {
  rows: AdminPostProblem[];
  total: number;
  pageCount: number;
  page: number;
}

// BE thật: shape AdminFailedPostResponse (GET /admin/posts/failed).
interface BeFailedPost {
  id: string;
  platformName: 'FACEBOOK' | 'INSTAGRAM' | 'THREADS';
  accountName: string | null;
  ownerEmail: string | null;
  caption: string | null;
  errorType: PublishErrorType | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number | null;
  nextRetryAt: string | null;
  failedAt: string | null;
}

const BE_PLATFORM_TAG: Record<BeFailedPost['platformName'], AdminPostPlatform> =
  { FACEBOOK: 'FB', INSTAGRAM: 'IG', THREADS: 'TH' };

const TAG_BE_PLATFORM: Record<AdminPostPlatform, BeFailedPost['platformName']> =
  { FB: 'FACEBOOK', IG: 'INSTAGRAM', TH: 'THREADS' };

/** Tab → enum FailedPostFilter phía BE (dùng lại enum sẵn có của /me/failed-posts). */
const KIND_FILTER: Record<PostProblemKind, 'POLICY' | 'TECHNICAL'> =
  { rejected: 'POLICY', system: 'TECHNICAL' };

/** Tham số lọc dùng chung cho list / summary / export — một nguồn, không lặp 3 lần. */
const problemParams = (f: PostProblemFilter) => ({
  filter: KIND_FILTER[f.kind],
  platform: f.platform ? TAG_BE_PLATFORM[f.platform] : undefined,
  errorType: f.errorType || undefined,
  from: f.from || undefined,
  to: f.to || undefined,
  q: f.q?.trim() || undefined,
});

const toProblem = (p: BeFailedPost): AdminPostProblem => ({
  id: p.id,
  user: p.ownerEmail ?? '—',
  accountName: p.accountName,
  platform: BE_PLATFORM_TAG[p.platformName] ?? 'FB',
  kind: p.errorType === 'POLICY_VIOLATION' ? 'rejected' : 'system',
  errorType: p.errorType,
  errorCode: p.errorCode,
  errorMessage: p.errorMessage,
  retryCount: p.retryCount,
  nextRetryAt: beDateTime(p.nextRetryAt),
  content: p.caption ?? '',
  date: beDateTime(p.failedAt) ?? '—',
});

// GET /admin/posts/failed (ADMIN, FR-82/FR-83).
export async function getPostProblems(query: PostProblemQuery): Promise<PostProblemPage> {
  const { data } = await client.get<ApiResponse<PageResponse<BeFailedPost>>>('/admin/posts/failed', {
    params: {
      ...problemParams(query),
      sort: query.sort === 'oldest' ? 'failedAt,asc' : 'failedAt,desc',
      page: query.page,
      size: query.size,
    },
  });
  const p = data.result;
  return { rows: p.content.map(toProblem), total: p.totalElements, pageCount: p.totalPages, page: p.page };
}

/**
 * Cách hiển thị ô "% thay đổi" — backend quyết định, FE không tự suy từ deltaPct null.
 * PERCENT = có mốc so sánh; NEW = kỳ trước 0 nhưng kỳ này có (hiện "Mới", không phải +∞%);
 * NONE = cả hai kỳ đều 0 (hiện "—", không mũi tên).
 */
export type KpiDeltaState = 'PERCENT' | 'NEW' | 'NONE';

export interface PostProblemKpi {
  value: number;
  /** Chỉ khác null khi deltaState = 'PERCENT'. */
  deltaPct: number | null;
  deltaState: KpiDeltaState;
  sparkline: number[];
}

export interface PostProblemSummary {
  kind: 'ALL' | 'POLICY' | 'TECHNICAL';
  /** Phạm vi theo tab: tab lỗi hệ thống chỉ đếm bài lỗi kỹ thuật. */
  total: PostProblemKpi;
  policyViolation: PostProblemKpi;
  technical: PostProblemKpi;
  temporary: PostProblemKpi;
  permanent: PostProblemKpi;
  /** Phạm vi theo tab, giống `total`. */
  affectedUsers: PostProblemKpi;
  /** Khoảng kỳ trước liền kề ('YYYY-MM-DD') — dựng nhãn "so với 06/07 - 12/07". */
  comparisonFrom: string;
  comparisonTo: string;
}

// GET /admin/posts/failed/summary — 4 thẻ KPI + badge số lượng tab.
// Badge 2 tab luôn đọc policyViolation/technical (không đổi theo `kind`) nên số không nhảy khi
// chuyển tab; chỉ `total` + `affectedUsers` mới thu hẹp theo tab đang xem.
export async function getPostProblemSummary(
  kind: PostProblemKind,
  range: { from: string; to: string },
): Promise<PostProblemSummary> {
  const { data } = await client.get<ApiResponse<PostProblemSummary>>('/admin/posts/failed/summary', {
    params: { kind: KIND_FILTER[kind], from: range.from, to: range.to },
  });
  return data.result;
}

// GET /admin/posts/failed/export — CSV dạng chuỗi theo ĐÚNG bộ lọc đang chọn;
// FE tự tạo Blob tải về (cùng quy ước export doanh thu / log hoạt động).
export async function exportPostProblems(filter: PostProblemFilter): Promise<string> {
  const { data } = await client.get<ApiResponse<string>>('/admin/posts/failed/export', {
    params: problemParams(filter),
  });
  return data.result;
}

// ===== Trạng thái hệ thống (FR-81) — GET /admin/system =====
export type ServiceStatus = 'operational' | 'degraded' | 'down';
export type ServiceKey = 'database' | 'redis' | 'aiService';

// Sức khỏe + chỉ số thật của một dependency (chỉ số không lấy được là null → FE ẩn).
export interface SvcHealth {
  key: ServiceKey | string;
  name: string;
  status: ServiceStatus;
  detail: string | null;
  latencyMs: number | null;
  activeConnections: number | null; // PostgreSQL (HikariCP)
  memoryUsed: string | null;        // Redis (human)
  hitRate: number | null;           // Redis (%)
}

export interface HostMetrics {
  cpuLoad: number | null; // % tiến trình
  memUsedMb: number;
  memMaxMb: number;
  diskFreeGb: number;
  diskTotalGb: number;
}

export interface SystemCounters {
  totalUsers: number;
  activeConnections: number;
  postedLast24h: number;
  failedLast24h: number;
  pendingSchedules: number;
}

export interface SystemStatus {
  services: SvcHealth[];
  counters: SystemCounters;
  alerts: { id: string; tone: Tone; level: LogLevel; message: string; time: string }[];
  host: HostMetrics | null;
}

interface BeSvc {
  name: string; status: 'UP' | 'DOWN'; detail: string | null;
  latencyMs: number | null; activeConnections: number | null; memoryUsed: string | null; hitRate: number | null;
}
interface BeSystemStatus {
  services: BeSvc[];
  totalUsers: number; activeConnections: number; postedLast24h: number; failedLast24h: number; pendingSchedules: number;
  alerts: { id: string; level: LogLevel; module: string; message: string; createdAt: string }[];
  host: HostMetrics | null;
}

const SERVICE_LABEL = (lang: Lang): Record<string, string> => ({
  database: P(lang, 'Cơ sở dữ liệu (PostgreSQL)', 'Database (PostgreSQL)'),
  redis: 'Redis',
  aiService: P(lang, 'Bộ máy AI (AI service)', 'AI engine (AI service)'),
});

// GET /admin/system (ADMIN, FR-81) — health + chỉ số thật + tài nguyên container + ERROR alerts.
export async function getSystemStatus(lang: Lang): Promise<SystemStatus> {
  const { data } = await client.get<ApiResponse<BeSystemStatus>>('/admin/system');
  const s = data.result;
  return {
    services: s.services.map((sv) => ({
      key: sv.name,
      name: SERVICE_LABEL(lang)[sv.name] ?? sv.name,
      status: sv.status === 'UP' ? 'operational' : 'down',
      detail: sv.detail,
      latencyMs: sv.latencyMs,
      activeConnections: sv.activeConnections,
      memoryUsed: sv.memoryUsed,
      hitRate: sv.hitRate,
    })),
    counters: {
      totalUsers: s.totalUsers, activeConnections: s.activeConnections,
      postedLast24h: s.postedLast24h, failedLast24h: s.failedLast24h, pendingSchedules: s.pendingSchedules,
    },
    alerts: s.alerts.map((a) => ({
      id: a.id, tone: logLevelTone(a.level), level: a.level,
      message: `[${a.module}] ${a.message}`, time: beDateTime(a.createdAt) ?? '',
    })),
    host: s.host,
  };
}

// ===== Hoạt động hệ thống (biểu đồ theo khoảng) — GET /admin/system/activity =====
export type ActivityRange = '1h' | '24h' | '7d' | '30d' | '1y';
export interface ActivityBucket { time: string; posts: number; jobs: number; errors: number; total: number; }
export interface SystemActivity { range: string; granularity: string; buckets: ActivityBucket[]; }

export async function getSystemActivity(range: ActivityRange): Promise<SystemActivity> {
  const { data } = await client.get<ApiResponse<SystemActivity>>('/admin/system/activity', { params: { range } });
  return data.result;
}

// ===== Log hệ thống (FR-84) — GET /admin/logs (server-side) =====
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
export interface SystemLog {
  id: string;
  time: string; // 'YYYY-MM-DD HH:mm:ss'
  level: LogLevel;
  module: string;
  message: string;
  detail: string | null;
  count: number | null; // ×N khi gom nhóm; null ở chế độ thường
}

export interface SystemLogQuery {
  level?: LogLevel;
  date?: string;   // 'YYYY-MM-DD'
  q?: string;
  grouped?: boolean;
  page: number;    // 0-based
  size: number;
}
export interface SystemLogPage { rows: SystemLog[]; total: number; pageCount: number; page: number; }

export const logLevelTone = (level: LogLevel): Tone =>
  level === 'ERROR' ? 'danger' : level === 'WARN' ? 'warning' : level === 'INFO' ? 'info' : 'neutral';

interface BeLog {
  id: string; level: LogLevel; module: string; message: string;
  detail: string | null; createdAt: string; count: number | null;
}

// GET /admin/logs (ADMIN, FR-84) — lọc/tìm/gom nhóm/phân trang server-side (bảng system_logs).
export async function getSystemLogs(query: SystemLogQuery): Promise<SystemLogPage> {
  const { data } = await client.get<ApiResponse<PageResponse<BeLog>>>('/admin/logs', {
    params: {
      level: query.level,
      date: query.date || undefined,
      q: query.q?.trim() || undefined,
      grouped: query.grouped || undefined,
      page: query.page,
      size: query.size,
    },
  });
  const p = data.result;
  return {
    rows: p.content.map((l) => ({
      id: l.id,
      time: (l.createdAt ?? '').slice(0, 19).replace('T', ' '),
      level: l.level,
      module: l.module,
      message: l.message,
      detail: l.detail,
      count: l.count ?? null,
    })),
    total: p.totalElements,
    pageCount: p.totalPages,
    page: p.page,
  };
}

// ===== Log hoạt động người dùng — GET /admin/logs/activity (bảng RIÊNG activity_logs) =====
// KHÁC log lỗi ở trên: đây là dấu vết NGHIỆP VỤ (đăng nhập, tạo/sửa/xoá nội dung, thao tác
// admin…). Retention 90 ngày (log lỗi 180) — LogRetentionJob phía backend.

/** Khớp enum ActivityActionGroup phía backend. */
export type ActivityActionGroup = 'AUTH' | 'ACCOUNT' | 'CONTENT' | 'BILLING' | 'ADMIN';

/** Khớp enum ActivityAction phía backend — enum ĐÓNG, thêm giá trị phải sửa cả hai đầu. */
export type ActivityAction =
  | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'PASSWORD_CHANGED' | 'PASSWORD_RESET'
  | 'ACCOUNT_REGISTERED' | 'PROFILE_UPDATED' | 'ACCOUNT_DELETE_REQUESTED' | 'ACCOUNT_RESTORED'
  | 'SOCIAL_CONNECTED' | 'SOCIAL_DISCONNECTED'
  | 'CONTENT_CREATED' | 'CONTENT_UPDATED' | 'CONTENT_DELETED' | 'CONTENT_STATUS_CHANGED'
  | 'SCHEDULE_CREATED' | 'SCHEDULE_UPDATED' | 'SCHEDULE_CANCELLED' | 'POST_PUBLISHED' | 'POST_FAILED'
  | 'PLAN_CHANGED' | 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED'
  | 'USER_CREATED' | 'USER_UPDATED' | 'USER_STATUS_CHANGED' | 'USER_DELETED' | 'USER_PASSWORD_RESET'
  | 'PLAN_CONFIG_UPDATED' | 'AI_CONFIG_UPDATED' | 'API_VERSION_UPDATED'
  | 'TOKENS_GRANTED' | 'USAGE_RESET' | 'BILLING_RATE_CREATED'
  | 'ALERT_ACKED' | 'ALERT_CONFIG_UPDATED' | 'USAGE_META_VIEWED' | 'USER_SESSIONS_VIEWED'
  | 'DEV_CREDIT_GRANTED' | 'DATA_EXPORTED';

export type ActivityResult = 'SUCCESS' | 'FAILURE';

/** Nhóm action theo group — nguồn duy nhất dựng optgroup của dropdown lọc. */
export const ACTIONS_BY_GROUP: Record<ActivityActionGroup, ActivityAction[]> = {
  AUTH: ['LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET'],
  ACCOUNT: ['ACCOUNT_REGISTERED', 'PROFILE_UPDATED', 'ACCOUNT_DELETE_REQUESTED', 'ACCOUNT_RESTORED',
    'SOCIAL_CONNECTED', 'SOCIAL_DISCONNECTED'],
  CONTENT: ['CONTENT_CREATED', 'CONTENT_UPDATED', 'CONTENT_DELETED', 'CONTENT_STATUS_CHANGED',
    'SCHEDULE_CREATED', 'SCHEDULE_UPDATED', 'SCHEDULE_CANCELLED', 'POST_PUBLISHED', 'POST_FAILED'],
  BILLING: ['PLAN_CHANGED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED'],
  ADMIN: ['USER_CREATED', 'USER_UPDATED', 'USER_STATUS_CHANGED', 'USER_DELETED', 'USER_PASSWORD_RESET',
    'PLAN_CONFIG_UPDATED', 'AI_CONFIG_UPDATED', 'API_VERSION_UPDATED', 'TOKENS_GRANTED', 'USAGE_RESET',
    'BILLING_RATE_CREATED', 'ALERT_ACKED', 'ALERT_CONFIG_UPDATED', 'USAGE_META_VIEWED',
    'USER_SESSIONS_VIEWED', 'DEV_CREDIT_GRANTED', 'DATA_EXPORTED'],
};

export interface ActivityLog {
  id: string;
  createdAt: string;
  userId: string | null;
  userEmail: string | null;
  /** null khi user đã bị xoá — UI lùi về userEmail. */
  userFullName: string | null;
  userAvatarUrl: string | null;
  action: ActivityAction;
  actionGroup: ActivityActionGroup;
  targetType: string | null;
  targetId: string | null;
  result: ActivityResult;
  ip: string | null;
  userAgent: string | null;
  /** Chuỗi JSON (đã cắt nếu quá 4KB) — UI format lại khi hiển thị. */
  metadata: string | null;
}

export interface ActivityLogFilter {
  q?: string;
  action?: ActivityAction;
  userId?: string;
  result?: ActivityResult;
  from?: string; // 'YYYY-MM-DD'
  to?: string;   // 'YYYY-MM-DD', BAO GỒM cả ngày đó
}

export interface ActivityLogQuery extends ActivityLogFilter {
  page: number;  // 0-based
  size: number;
}

const activityParams = (f: ActivityLogFilter) => ({
  q: f.q?.trim() || undefined,
  action: f.action || undefined,
  userId: f.userId || undefined,
  result: f.result || undefined,
  from: f.from || undefined,
  to: f.to || undefined,
});

export async function getActivityLogs(query: ActivityLogQuery): Promise<PageResponse<ActivityLog>> {
  const { data } = await client.get<ApiResponse<PageResponse<ActivityLog>>>('/admin/logs/activity', {
    params: { ...activityParams(query), page: query.page, size: query.size },
  });
  return data.result;
}

export async function getActivityLog(id: string): Promise<ActivityLog> {
  const { data } = await client.get<ApiResponse<ActivityLog>>(`/admin/logs/activity/${id}`);
  return data.result;
}

/** CSV dạng chuỗi — FE tự tạo Blob tải về (cùng quy ước export nhật ký usage). */
export async function exportActivityLogs(filter: ActivityLogFilter): Promise<string> {
  const { data } = await client.get<ApiResponse<string>>('/admin/logs/activity/export', {
    params: activityParams(filter),
  });
  return data.result;
}

// ===== Version API nền tảng — GET /admin/platform-versions =====
export interface PlatformVersion {
  platform: 'FB' | 'IG' | 'TH';
  name: string;
  current: string;
  latest: string;
  history: { version: string; date: string; note: string }[];
}

export async function getPlatformVersions(lang: Lang): Promise<PlatformVersion[]> {
  return delay([
    { platform: 'FB', name: 'Facebook Graph API', current: 'v19.0', latest: 'v20.0', history: [
      { version: 'v19.0', date: '2026-02-01', note: P(lang, 'Đang dùng — ổn định', 'In use — stable') },
      { version: 'v18.0', date: '2025-09-12', note: P(lang, 'Ngừng hỗ trợ 2026-09', 'Deprecated 2026-09') },
    ] },
    { platform: 'IG', name: 'Instagram Graph API', current: 'v19.0', latest: 'v19.0', history: [
      { version: 'v19.0', date: '2026-02-01', note: P(lang, 'Đang dùng — mới nhất', 'In use — latest') },
      { version: 'v18.0', date: '2025-09-12', note: P(lang, 'Đã nâng cấp', 'Upgraded') },
    ] },
    { platform: 'TH', name: 'Threads API', current: 'v1.0', latest: 'v1.1', history: [
      { version: 'v1.0', date: '2025-11-20', note: P(lang, 'Đang dùng', 'In use') },
      { version: 'v0.9', date: '2025-08-04', note: P(lang, 'Bản beta', 'Beta') },
    ] },
  ]);
}

// PATCH /admin/platform-versions/{platform} { version }
export async function updatePlatformVersion(platform: string, version: string): Promise<{ platform: string; current: string }> {
  return delay({ platform, current: version });
}

// Quản lý doanh thu: đã chuyển sang API thật /admin/revenue — xem api/revenue.ts (mock cũ đã gỡ,
// nguồn dữ liệu là sổ cái `payments` phía BE).
// Gói dịch vụ: đã chuyển sang API thật /admin/plans — xem api/plans.ts (mock cũ đã gỡ).
