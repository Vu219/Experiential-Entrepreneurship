import client, { type ApiResponse } from './apiClient';
import type { PlatformEnum } from './connections';

// Khoá / mở liên kết nền tảng TOÀN HỆ THỐNG (backend V20, bảng platform_availability) + quyền dùng nền tảng theo gói.
// Quyền thực tế của user = nền tảng MỞ ở cấp hệ thống VÀ được gói cho phép (khoá hệ thống luôn thắng). FE chỉ hiển thị
// trạng thái — backend chặn ở mọi điểm (1835 kết nối, 2210 lên lịch/đăng, 2206 ngoài gói).

/** PLATFORM_DISABLED = admin khoá toàn hệ thống; PLAN_EXCLUDED = gói không gồm nền tảng. */
export type PlatformLockReason = 'PLATFORM_DISABLED' | 'PLAN_EXCLUDED';

/** Admin: trạng thái + mức ảnh hưởng nếu khoá. */
export interface PlatformAvailability {
  platform: PlatformEnum;
  connectionEnabled: boolean;
  reasonVi: string | null;
  reasonEn: string | null;
  updatedByEmail: string | null;
  statusChangedAt: string | null;
  /** Kênh đăng đang kết nối (không tính kết nối USER gốc). */
  connectedAccounts: number;
  /** Lịch chưa đăng (SCHEDULED / ON_HOLD). */
  pendingSchedules: number;
  /** Chỉ có trong response của lần khoá: số lịch vừa chuyển sang Tạm giữ. */
  heldSchedules?: number | null;
}

export interface PlatformAvailabilityPayload {
  enabled: boolean;
  reasonVi?: string;
  reasonEn?: string;
}

/** Quyền dùng một nền tảng của user hiện tại. */
export interface PlatformAccess {
  platform: PlatformEnum;
  systemEnabled: boolean;
  reasonVi: string | null;
  reasonEn: string | null;
  planAllowed: boolean;
  usable: boolean;
  lockReason: PlatformLockReason | null;
}

export interface PlatformAccessList {
  platforms: PlatformAccess[];
  /** Số kênh còn được kết nối thêm; null = không giới hạn. */
  remainingChannels: number | null;
  channelLimit: number | null;
  connectedChannels: number;
}

/** Lý do một kênh Meta trả về trong lần liên kết KHÔNG được thêm. */
export type OAuthSkipReason = 'CHANNEL_LIMIT' | 'PLAN_PLATFORM' | 'PLATFORM_DISABLED';

export interface OAuthResult {
  platform: PlatformEnum;
  connectedCount: number;
  skipped: { platform: PlatformEnum; accountName: string | null; reason: OAuthSkipReason }[];
}

/** GET /admin/platforms/availability */
export async function listPlatformAvailability(): Promise<PlatformAvailability[]> {
  const { data } = await client.get<ApiResponse<PlatformAvailability[]>>('/admin/platforms/availability');
  return data.result;
}

/** PUT /admin/platforms/{platform}/availability — khoá bắt buộc reasonVi + reasonEn. */
export async function updatePlatformAvailability(platform: PlatformEnum, payload: PlatformAvailabilityPayload): Promise<PlatformAvailability> {
  const { data } = await client.put<ApiResponse<PlatformAvailability>>(`/admin/platforms/${platform}/availability`, payload);
  return data.result;
}

/** GET /connections/platforms — quyền dùng từng nền tảng + số kênh còn lại. */
export async function getMyPlatforms(): Promise<PlatformAccessList> {
  const { data } = await client.get<ApiResponse<PlatformAccessList>>('/connections/platforms');
  return data.result;
}

/** GET /connections/oauth-results/{id} — kênh không được thêm ở lần liên kết vừa rồi (lưu 10 phút). */
export async function getOAuthResult(id: string): Promise<OAuthResult> {
  const { data } = await client.get<ApiResponse<OAuthResult>>(`/connections/oauth-results/${encodeURIComponent(id)}`);
  return data.result;
}

/** Lý do hiển thị theo ngôn ngữ (admin nhập VI + EN). */
export function lockReasonText(access: Pick<PlatformAccess, 'reasonVi' | 'reasonEn'>, lang: string): string | null {
  return (lang === 'en' ? access.reasonEn : access.reasonVi) || null;
}
