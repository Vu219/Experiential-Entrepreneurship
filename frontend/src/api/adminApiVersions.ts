import client, { ApiResponse } from './apiClient';

// ===== Types matching BE DTOs (ApiVersionResponse, ApiVersionHistoryResponse, UpdateVersionRequest) =====

export type PlatformEnum = 'FACEBOOK' | 'INSTAGRAM' | 'THREADS';
export type VersionStatus = 'UP_TO_DATE' | 'UPDATE_AVAILABLE' | 'DEPRECATING_SOON' | 'DEPRECATED';
export type VersionChangeType = 'MANUAL_UPDATE' | 'AUTO_DETECTED' | 'ROLLBACK';

export interface ApiVersionInfo {
  id: string;
  platform: PlatformEnum;
  currentVersion: string;
  latestVersion: string;
  minSupportedVersion: string | null;
  status: VersionStatus;
  currentVersionDeprecationDate: string | null;
  lastCheckedAt: string | null;
}

export interface ApiVersionHistory {
  id: string;
  fromVersion: string;
  toVersion: string;
  changeType: VersionChangeType;
  notes: string | null;
  changedByName: string | null;
  createdAt: string;
}

export interface UpdateVersionPayload {
  newVersion: string;
  notes?: string;
}

// ===== Platform enum → URL path segment =====
const PLATFORM_URL: Record<PlatformEnum, string> = {
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  THREADS: 'threads',
};

// ===== API functions (all require ADMIN role) =====

/**
 * GET /admin/api-versions
 * Danh sách version API của 3 nền tảng.
 */
export async function listApiVersions(): Promise<ApiVersionInfo[]> {
  const { data } = await client.get<ApiResponse<ApiVersionInfo[]>>('/admin/api-versions');
  return data.result;
}

/**
 * GET /admin/api-versions/{platform}/history
 * Lịch sử thay đổi version của một nền tảng.
 */
export async function getVersionHistory(platform: PlatformEnum): Promise<ApiVersionHistory[]> {
  const { data } = await client.get<ApiResponse<ApiVersionHistory[]>>(
    `/admin/api-versions/${PLATFORM_URL[platform]}/history`,
  );
  return data.result;
}

/**
 * POST /admin/api-versions/{platform}
 * Cập nhật version hiện hành (áp dụng tức thì, không cần restart).
 */
export async function updateVersion(
  platform: PlatformEnum,
  payload: UpdateVersionPayload,
): Promise<ApiVersionInfo> {
  const { data } = await client.post<ApiResponse<ApiVersionInfo>>(
    `/admin/api-versions/${PLATFORM_URL[platform]}`,
    payload,
  );
  return data.result;
}

/**
 * POST /admin/api-versions/check-now
 * Chạy kiểm tra version mới ngay lập tức (thay vì đợi cron weekly).
 */
export async function checkNow(): Promise<ApiVersionInfo[]> {
  const { data } = await client.post<ApiResponse<ApiVersionInfo[]>>(
    '/admin/api-versions/check-now',
  );
  return data.result;
}
