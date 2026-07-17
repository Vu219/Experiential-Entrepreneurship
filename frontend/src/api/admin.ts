import type { Lang } from '../types';
import type { Tone } from '../components/admin/StatusBadge';
import client, { type ApiError, type ApiResponse, type PageResponse } from './apiClient';

// 2026-07-12: Quản lý người dùng (FR-80) nối BE thật hoàn toàn — list/stats/detail/create/update/
// đổi gói/khoá-mở/đặt lại mật khẩu. Lọc/tìm/phân trang server-side. Các module khác (bài lỗi,
// system status, logs) đã nối BE từ trước. Gói dịch vụ nối BE thật ở api/plans.ts.
// Còn MOCK: platform versions & Revenue (chưa có billing BE).

// Giả lập độ trễ mạng cho các module còn mock (Revenue / platform versions).
const delay = <T>(value: T, ms = 450): Promise<T> => new Promise((r) => setTimeout(() => r(value), ms));

const P = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);
const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(-2).join('').toUpperCase();

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

// ===== Bài đăng lỗi & bị từ chối (FR-82 + FR-83) — GET /admin/posts/problems =====
export type PostProblemKind = 'rejected' | 'system';
export interface AdminPostProblem {
  id: string;
  user: string;
  platform: 'FB' | 'IG' | 'TH';
  kind: PostProblemKind;
  reason: string;
  platformError: string; // mã/thông điệp nền tảng trả về
  content: string;
  date: string;
}

// BE thật: shape AdminFailedPostResponse (GET /admin/posts/failed).
interface BeFailedPost {
  id: string;
  platformName: 'FACEBOOK' | 'INSTAGRAM' | 'THREADS';
  accountName: string | null;
  ownerEmail: string | null;
  caption: string | null;
  errorType: 'TEMPORARY' | 'PERMANENT' | 'POLICY_VIOLATION' | null;
  errorCode: string | null;
  errorMessage: string | null;
  failedAt: string | null;
}

const BE_PLATFORM_TAG: Record<BeFailedPost['platformName'], 'FB' | 'IG' | 'TH'> =
  { FACEBOOK: 'FB', INSTAGRAM: 'IG', THREADS: 'TH' };

// GET /admin/posts/failed (ADMIN, FR-82/FR-83) — vi phạm chính sách = 'rejected', còn lại 'system'.
export async function getPostProblems(lang: Lang): Promise<AdminPostProblem[]> {
  const { data } = await client.get<ApiResponse<PageResponse<BeFailedPost>>>('/admin/posts/failed', {
    params: { size: 50 },
  });
  return data.result.content.map((p) => ({
    id: p.id,
    user: p.ownerEmail ?? '—',
    platform: BE_PLATFORM_TAG[p.platformName] ?? 'FB',
    kind: p.errorType === 'POLICY_VIOLATION' ? 'rejected' : 'system',
    reason: p.errorType === 'POLICY_VIOLATION'
      ? P(lang, 'Nền tảng từ chối do vi phạm chính sách', 'Rejected by the platform for policy violation')
      : p.errorType === 'TEMPORARY'
        ? P(lang, 'Lỗi tạm thời — đã hết lượt thử lại', 'Temporary error — retries exhausted')
        : P(lang, 'Lỗi đăng bài vĩnh viễn', 'Permanent publishing error'),
    platformError: `${p.errorCode ?? '—'}: ${p.errorMessage ?? ''}`.trim(),
    content: p.caption ?? '',
    date: beDateTime(p.failedAt) ?? '—',
  }));
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

// ===== Quản lý doanh thu — GET /admin/revenue?period= =====
export type RevenuePeriod = '1m' | '3m' | '12m';
export interface RevenueData {
  total: number;
  orders: number;
  growth: string;
  series: { label: string; value: number }[];
  transactions: { id: string; customer: string; plan: string; amount: number; tone: Tone; status: string; date: string }[];
}

export async function getRevenue(period: RevenuePeriod, lang: Lang): Promise<RevenueData> {
  const paid = P(lang, 'Đã thanh toán', 'Paid');
  const pending = P(lang, 'Chờ xử lý', 'Pending');
  const refunded = P(lang, 'Hoàn tiền', 'Refunded');
  const series: Record<RevenuePeriod, { label: string; value: number }[]> = {
    '1m': Array.from({ length: 30 }, (_, i) => ({ label: String(i + 1), value: 8 + Math.round(6 * Math.sin(i / 3) + i / 4) })),
    '3m': Array.from({ length: 12 }, (_, i) => ({ label: 'W' + (i + 1), value: 60 + Math.round(30 * Math.sin(i / 2) + i * 2) })),
    '12m': (lang === 'en' ? ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
      .map((label, i) => ({ label, value: 220 + Math.round(120 * Math.sin(i / 2) + i * 12) })),
  };
  const totals: Record<RevenuePeriod, [number, number, string]> = {
    '1m': [48_600_000, 312, '+11.2%'],
    '3m': [151_400_000, 968, '+8.7%'],
    '12m': [612_900_000, 4128, '+24.3%'],
  };
  const [total, orders, growth] = totals[period];
  const transactions = [
    { id: 'INV-0612', customer: 'David Chen', plan: 'Plus', amount: 499_000, tone: 'success' as Tone, status: paid, date: '2026-06-22' },
    { id: 'INV-0611', customer: 'Sophie Tran', plan: 'Pro', amount: 1_990_000, tone: 'success' as Tone, status: paid, date: '2026-06-22' },
    { id: 'INV-0610', customer: 'Mai Chi', plan: 'Plus', amount: 499_000, tone: 'warning' as Tone, status: pending, date: '2026-06-21' },
    { id: 'INV-0609', customer: 'Hoàng Long', plan: 'Plus', amount: 499_000, tone: 'success' as Tone, status: paid, date: '2026-06-21' },
    { id: 'INV-0608', customer: 'Quang Huy', plan: 'Pro', amount: 1_990_000, tone: 'danger' as Tone, status: refunded, date: '2026-06-20' },
    { id: 'INV-0607', customer: 'Diệu Linh', plan: 'Plus', amount: 499_000, tone: 'success' as Tone, status: paid, date: '2026-06-20' },
  ];
  return delay({ total, orders, growth, series: series[period], transactions });
}

// Gói dịch vụ: đã chuyển sang API thật /admin/plans — xem api/plans.ts (mock cũ đã gỡ).
