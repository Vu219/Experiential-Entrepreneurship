import type { Lang } from '../types';
import type { Tone } from '../components/admin/StatusBadge';
import client, { type ApiError, type ApiResponse, type PageResponse } from './apiClient';

// 2026-07-11: users (list/lock/unlock), bài thất bại (FR-82/83), system status (FR-81) và
// logs (FR-84) đã nối BE thật — GIỮ NGUYÊN chữ ký hàm nên các trang admin không phải đổi.
// Còn MOCK: tạo/sửa/xóa user thủ công (chưa có endpoint BE) và Revenue (chưa có billing BE).

// Giả lập độ trễ mạng để các trang thể hiện đúng trạng thái loading.
const delay = <T>(value: T, ms = 450): Promise<T> => new Promise((r) => setTimeout(() => r(value), ms));

const P = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);
const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(-2).join('').toUpperCase();

export const formatVND = (n: number) => n.toLocaleString('vi-VN') + '₫';

// ===== Quản lý người dùng (FR-80) — GET /admin/users =====
export type UserRole = 'USER' | 'ADMIN';
// PENDING_ACTIVATION: tài khoản vừa tạo, chờ user kích hoạt qua email mời (chưa đăng nhập lần nào).
export type UserStatus = 'ACTIVE' | 'LOCKED' | 'PENDING_ACTIVATION' | 'PENDING_DELETE';
export type UserPlan = 'free' | 'plus' | 'pro';
export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  initials: string;
  plan: UserPlan;
  channelsUsed: number;
  channelsLimit: number;
  tokenUsagePercent: number;
  /** 'YYYY-MM-DD HH:mm' — null = chưa đăng nhập lần nào. */
  lastLoginAt: string | null;
  /** SĐT (tuỳ chọn) — undefined nếu người dùng chưa cung cấp. */
  phone?: string;
}

/** Giới hạn kênh kết nối theo gói (mock, khớp quyền lợi gói). */
export const PLAN_LIMITS: Record<UserPlan, number> = { free: 1, plus: 2, pro: 4 };

const USERS_RAW: [string, string, string, UserRole, UserStatus, string, UserPlan, number, number, string | null, string | null][] = [
  // [id, tên, email, vai trò, trạng thái, ngày tạo, gói, kênh đang dùng, % token, đăng nhập gần nhất, SĐT]
  ['u01', 'Lan Phương', 'lan.phuong@gmail.com', 'USER', 'ACTIVE', '2026-01-12', 'pro', 3, 62, '2026-07-02 09:15', '0901234567'],
  ['u02', 'Minh Tuấn', 'tuan.minh@aima.io', 'ADMIN', 'ACTIVE', '2025-11-03', 'pro', 4, 45, '2026-07-02 07:40', '0902345001'],
  ['u03', 'Thu Hà', 'ha.thu@brandco.vn', 'USER', 'LOCKED', '2026-02-28', 'free', 1, 96, '2026-05-19 14:02', '0903120945'],
  ['u04', 'David Chen', 'david.chen@startup.co', 'USER', 'ACTIVE', '2026-03-15', 'plus', 2, 88, '2026-07-01 22:10', null],
  ['u05', 'Ngọc Anh', 'anh.ngoc@gmail.com', 'USER', 'PENDING_DELETE', '2026-06-18', 'free', 0, 5, '2026-05-25 08:00', '0905667788'],
  ['u06', 'Hoàng Long', 'long.hoang@smes.vn', 'USER', 'ACTIVE', '2026-04-02', 'plus', 1, 73, '2026-06-30 18:45', '0906778899'],
  ['u07', 'Mai Chi', 'chi.mai@creator.vn', 'USER', 'ACTIVE', '2026-05-21', 'pro', 2, 91, '2026-07-02 06:05', '0907889900'],
  ['u08', 'Bảo Nam', 'nam.bao@gmail.com', 'USER', 'LOCKED', '2026-01-30', 'free', 1, 34, '2026-04-27 10:30', '0908990011'],
  ['u09', 'Sophie Tran', 'sophie@agency.co', 'ADMIN', 'ACTIVE', '2025-12-09', 'pro', 3, 28, '2026-07-01 16:20', null],
  ['u10', 'Quang Huy', 'huy.quang@shop.vn', 'USER', 'ACTIVE', '2026-06-01', 'plus', 2, 79, '2026-06-29 21:00', '0910112233'],
  ['u11', 'Diệu Linh', 'linh.dieu@gmail.com', 'USER', 'ACTIVE', '2026-03-26', 'free', 1, 55, '2026-06-28 12:40', '0911223344'],
  ['u12', 'Trung Kiên', 'kien.trung@biz.vn', 'USER', 'PENDING_DELETE', '2026-05-08', 'free', 0, 12, '2026-05-30 09:25', '0912334455'],
  ['u13', 'Khánh Vy', 'vy.khanh@studio.vn', 'USER', 'PENDING_ACTIVATION', '2026-07-01', 'plus', 0, 0, null, '0913445566'],
  ['u14', 'Tuấn Anh', 'anh.tuan@freelance.vn', 'USER', 'ACTIVE', '2026-07-02', 'free', 0, 0, null, null],
];

// Trạng thái mock giữ trong module để lock/xoá/tạo phản ánh qua các lần getAdminUsers
// trong cùng phiên (mô phỏng DB) — reload trang sẽ seed lại.
let USERS: AdminUserRow[] | null = null;
const seedUsers = (): AdminUserRow[] =>
  USERS_RAW.map((u) => ({
    id: u[0], name: u[1], email: u[2], role: u[3], status: u[4], createdAt: u[5], initials: initials(u[1]),
    plan: u[6], channelsUsed: u[7], channelsLimit: PLAN_LIMITS[u[6]], tokenUsagePercent: u[8], lastLoginAt: u[9],
    phone: u[10] ?? undefined,
  }));
const users = (): AdminUserRow[] => (USERS ??= seedUsers());

// ==== BE thật: shape UserResponse của backend (GET /users, admin) ====
interface BeUserResponse {
  id: string;
  username: string | null;
  fullName: string | null;
  email: string;
  phone: string | null;
  status: UserStatus;
  avatarUrl: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  role: { roleName: UserRole } | null;
}

const ERR_USER_LIST_EMPTY = 1018;
const ERR_ADMIN_PROTECTED = 1972;

const beDateTime = (iso: string | null): string | null => (iso ? iso.slice(0, 16).replace('T', ' ') : null);

// Gói/kênh/token là khái niệm billing chưa có ở BE — hiển thị mặc định Free/0.
const toAdminRow = (u: BeUserResponse): AdminUserRow => ({
  id: u.id,
  name: u.fullName || u.email,
  email: u.email,
  role: u.role?.roleName === 'ADMIN' ? 'ADMIN' : 'USER',
  status: u.status,
  createdAt: (u.createdAt ?? '').slice(0, 10),
  initials: initials(u.fullName || u.email),
  plan: 'free',
  channelsUsed: 0,
  channelsLimit: PLAN_LIMITS.free,
  tokenUsagePercent: 0,
  lastLoginAt: beDateTime(u.lastActiveAt),
  phone: u.phone ?? undefined,
});

// GET /users (ADMIN, FR-80) — trang admin lọc/tìm client-side nên lấy một trang lớn.
export async function getAdminUsers(): Promise<AdminUserRow[]> {
  try {
    const { data } = await client.get<ApiResponse<PageResponse<BeUserResponse>>>('/users', {
      params: { size: 200 },
    });
    USERS = data.result.content.map(toAdminRow);
    return USERS.map((u) => ({ ...u }));
  } catch (e) {
    if ((e as ApiError).code === ERR_USER_LIST_EMPTY) {
      USERS = [];
      return [];
    }
    throw e;
  }
}

export const userStatusMeta = (lang: Lang, s: UserStatus): { tone: Tone; label: string } =>
  s === 'ACTIVE' ? { tone: 'success', label: P(lang, 'Hoạt động', 'Active') }
  : s === 'LOCKED' ? { tone: 'danger', label: P(lang, 'Đã khoá', 'Locked') }
  : s === 'PENDING_ACTIVATION' ? { tone: 'info', label: P(lang, 'Chờ kích hoạt', 'Pending activation') }
  : { tone: 'warning', label: P(lang, 'Chờ xoá', 'Pending deletion') };

export const userPlanMeta = (p: UserPlan): { tone: Tone; label: string } =>
  p === 'free' ? { tone: 'neutral', label: 'Free' } : p === 'plus' ? { tone: 'info', label: 'Plus' } : { tone: 'purple', label: 'Pro' };

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

/** Số ngày kể từ lần đăng nhập cuối (Infinity nếu chưa từng đăng nhập). */
export const daysSinceLogin = (iso: string | null): number =>
  iso ? Math.floor((Date.now() - new Date(iso.replace(' ', 'T')).getTime()) / 86_400_000) : Infinity;

// PATCH /admin/users/{id}/lock | /unlock
// Guard phía "server" mock: tài khoản ADMIN không thể bị khoá (SEC — bảo vệ quản trị).
export async function setUserLocked(id: string, locked: boolean): Promise<{ id: string; status: UserStatus }> {
  const u = users().find((x) => x.id === id);
  if (u?.role === 'ADMIN') return Promise.reject(new Error('ADMIN_PROTECTED'));
  if (u) u.status = locked ? 'LOCKED' : 'ACTIVE';
  return delay({ id, status: locked ? 'LOCKED' : 'ACTIVE' });
}

// PATCH /admin/users/lock-bulk { ids, locked } — tự loại trừ ADMIN, trả về số bị bỏ qua.
export async function setUsersLocked(ids: string[], locked: boolean): Promise<{ updated: string[]; skippedAdmins: number }> {
  const targets = users().filter((u) => ids.includes(u.id));
  const eligible = targets.filter((u) => u.role !== 'ADMIN');
  eligible.forEach((u) => { u.status = locked ? 'LOCKED' : 'ACTIVE'; });
  return delay({ updated: eligible.map((u) => u.id), skippedAdmins: targets.length - eligible.length });
}

// DELETE /admin/users/{id} — guard: ADMIN không thể bị xoá.
export async function deleteAdminUser(id: string): Promise<{ id: string }> {
  const u = users().find((x) => x.id === id);
  if (u?.role === 'ADMIN') return Promise.reject(new Error('ADMIN_PROTECTED'));
  USERS = users().filter((x) => x.id !== id);
  return delay({ id });
}

// POST /admin/users — tạo user thủ công (mock: thêm vào đầu danh sách).
// status: ACTIVE (đặt mật khẩu thủ công) | PENDING_ACTIVATION (gửi email mời kích hoạt).
export async function createAdminUser(input: {
  name: string; email: string; role: UserRole; plan: UserPlan; phone?: string; status?: UserStatus;
}): Promise<AdminUserRow> {
  const row: AdminUserRow = {
    id: 'u' + Date.now().toString(36),
    name: input.name, email: input.email, role: input.role, status: input.status ?? 'ACTIVE',
    createdAt: new Date().toISOString().slice(0, 10), initials: initials(input.name),
    plan: input.plan, channelsUsed: 0, channelsLimit: PLAN_LIMITS[input.plan], tokenUsagePercent: 0, lastLoginAt: null,
    phone: input.phone,
  };
  users().unshift(row);
  return delay({ ...row });
}

// PATCH /admin/users/{id} — cập nhật thông tin tài khoản (mock). Đổi gói → cập nhật lại giới hạn kênh.
export async function updateAdminUser(id: string, patch: {
  name: string; email: string; phone?: string; role: UserRole; plan: UserPlan; status: UserStatus;
}): Promise<AdminUserRow> {
  const u = users().find((x) => x.id === id);
  if (!u) return Promise.reject(new Error('NOT_FOUND'));
  u.name = patch.name;
  u.email = patch.email;
  u.phone = patch.phone;
  u.role = patch.role;
  u.plan = patch.plan;
  u.channelsLimit = PLAN_LIMITS[patch.plan];
  u.status = patch.status;
  u.initials = initials(patch.name);
  return delay({ ...u });
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

export async function getPostProblems(lang: Lang): Promise<AdminPostProblem[]> {
  const rows: AdminPostProblem[] = [
    { id: 'p01', user: 'Lan Phương', platform: 'FB', kind: 'rejected', reason: P(lang, 'Vi phạm chính sách quảng cáo', 'Ad policy violation'), platformError: 'GraphAPI #368: Temporarily blocked for policies violations', content: P(lang, 'Giảm giá 50% toàn bộ khoá học...', '50% off all courses...'), date: '2026-06-22 09:14' },
    { id: 'p02', user: 'David Chen', platform: 'IG', kind: 'rejected', reason: P(lang, 'Nội dung bị gắn cờ bản quyền', 'Flagged for copyright'), platformError: 'IG Media #2207026: Copyrighted audio detected', content: P(lang, 'Reel nhạc nền trending...', 'Reel with trending audio...'), date: '2026-06-22 08:02' },
    { id: 'p03', user: 'Mai Chi', platform: 'TH', kind: 'system', reason: P(lang, 'Hết thời gian chờ khi gọi API', 'API call timeout'), platformError: 'ETIMEDOUT: upstream did not respond within 30s', content: P(lang, 'Thread: 5 mẹo marketing...', 'Thread: 5 marketing tips...'), date: '2026-06-21 20:41' },
    { id: 'p04', user: 'Hoàng Long', platform: 'FB', kind: 'system', reason: P(lang, 'Định dạng media không hợp lệ', 'Invalid media format'), platformError: 'GraphAPI #324: Missing or invalid image file', content: P(lang, 'Bài viết kèm ảnh sản phẩm...', 'Post with product image...'), date: '2026-06-21 16:25' },
    { id: 'p05', user: 'Quang Huy', platform: 'IG', kind: 'rejected', reason: P(lang, 'Tài khoản bị hạn chế đăng bài', 'Account restricted from posting'), platformError: 'IG #190: This account is restricted', content: P(lang, 'Carousel ra mắt bộ sưu tập...', 'Carousel: new collection launch...'), date: '2026-06-21 11:08' },
    { id: 'p06', user: 'Diệu Linh', platform: 'TH', kind: 'system', reason: P(lang, 'Lỗi máy chủ nội bộ', 'Internal server error'), platformError: 'HTTP 500: scheduler worker crashed', content: P(lang, 'Thread: hậu trường thương hiệu...', 'Thread: brand behind-the-scenes...'), date: '2026-06-20 22:13' },
  ];
  return delay(rows);
}

// ===== Trạng thái hệ thống (FR-81) — GET /admin/system/status =====
export type ServiceStatus = 'operational' | 'degraded' | 'down';
export interface SystemStatus {
  services: { name: string; status: ServiceStatus; uptime: string }[];
  load: number[]; // % tải 24 mốc (mỗi giờ)
  alerts: { id: string; tone: Tone; level: string; message: string; time: string }[];
}

export async function getSystemStatus(lang: Lang): Promise<SystemStatus> {
  return delay({
    services: [
      { name: P(lang, 'Cơ sở dữ liệu (PostgreSQL)', 'Database (PostgreSQL)'), status: 'operational', uptime: '99.98%' },
      { name: P(lang, 'API nền tảng (Facebook)', 'Platform API (Facebook)'), status: 'operational', uptime: '99.92%' },
      { name: P(lang, 'API nền tảng (Instagram)', 'Platform API (Instagram)'), status: 'degraded', uptime: '98.40%' },
      { name: P(lang, 'API nền tảng (Threads)', 'Platform API (Threads)'), status: 'operational', uptime: '99.81%' },
      { name: P(lang, 'Hàng đợi tác vụ', 'Job queue'), status: 'operational', uptime: '99.95%' },
      { name: P(lang, 'Bộ máy AI', 'AI engine'), status: 'operational', uptime: '99.70%' },
    ],
    load: [32, 28, 24, 22, 26, 30, 44, 58, 67, 72, 70, 64, 60, 66, 74, 82, 88, 79, 71, 63, 55, 48, 40, 35],
    alerts: [
      { id: 'a1', tone: 'warning', level: 'WARN', message: P(lang, 'Instagram API phản hồi chậm (>2s) trong 15 phút qua', 'Instagram API latency high (>2s) for the last 15 min'), time: '2026-06-23 10:12' },
    ],
  });
}

// ===== Log hệ thống (FR-84) — GET /admin/logs =====
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
export interface SystemLog {
  id: string;
  time: string; // ISO-ish, dùng cho lọc theo ngày (lấy 10 ký tự đầu)
  level: LogLevel;
  module: string;
  message: string;
}

export const logLevelTone = (level: LogLevel): Tone =>
  level === 'ERROR' ? 'danger' : level === 'WARN' ? 'warning' : level === 'INFO' ? 'info' : 'neutral';

export async function getSystemLogs(): Promise<SystemLog[]> {
  const rows: SystemLog[] = [
    { id: 'l01', time: '2026-06-23 10:12:04', level: 'WARN', module: 'platform.instagram', message: 'Rate limit approaching: 480/500 calls in current window' },
    { id: 'l02', time: '2026-06-23 09:48:31', level: 'ERROR', module: 'scheduler.worker', message: 'Job #88213 failed: ETIMEDOUT calling Threads publish endpoint' },
    { id: 'l03', time: '2026-06-23 09:05:17', level: 'INFO', module: 'auth.session', message: 'User u09 signed in from 113.161.* (Chrome/Win)' },
    { id: 'l04', time: '2026-06-23 08:22:50', level: 'ERROR', module: 'platform.facebook', message: 'GraphAPI #324 invalid media for post #44021' },
    { id: 'l05', time: '2026-06-22 23:41:09', level: 'DEBUG', module: 'ai.generate', message: 'Prompt tokens=1820 completion=642 latency=3.1s' },
    { id: 'l06', time: '2026-06-22 20:41:33', level: 'WARN', module: 'queue.retry', message: 'Post #43980 scheduled retry 2/3 in 15m (temporary error)' },
    { id: 'l07', time: '2026-06-22 18:30:02', level: 'INFO', module: 'billing.invoice', message: 'Invoice INV-2026-0612 paid by customer u04' },
    { id: 'l08', time: '2026-06-22 14:10:55', level: 'ERROR', module: 'db.pool', message: 'Connection pool exhausted (20/20), 3 queries queued' },
    { id: 'l09', time: '2026-06-21 11:08:12', level: 'WARN', module: 'platform.instagram', message: 'Account u10 restricted — posting blocked by platform' },
    { id: 'l10', time: '2026-06-21 07:55:44', level: 'INFO', module: 'analytics.collector', message: 'Collected 7d metrics for 142 posts' },
    { id: 'l11', time: '2026-06-20 22:13:20', level: 'ERROR', module: 'scheduler.worker', message: 'HTTP 500 worker crashed, auto-restarted in 4s' },
    { id: 'l12', time: '2026-06-20 16:02:38', level: 'DEBUG', module: 'cache.redis', message: 'Cache miss ratio 12.4% over last hour' },
  ];
  return delay(rows);
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

// GET/PUT/POST /admin/plans — cấu hình giá gói
export interface PricingPlan {
  id: string;
  name: string;
  price: number; // đ/tháng
  active: boolean;
}

export async function getPlans(): Promise<PricingPlan[]> {
  return delay([
    { id: 'free', name: 'Free', price: 0, active: true },
    { id: 'plus', name: 'Plus', price: 499_000, active: true },
    { id: 'pro', name: 'Pro', price: 1_990_000, active: true },
  ]);
}

// TODO(backend): PUT /admin/plans/{id} & POST /admin/plans — hiện chỉ trả lại payload.
export async function savePlan(plan: PricingPlan): Promise<PricingPlan> {
  return delay(plan);
}
