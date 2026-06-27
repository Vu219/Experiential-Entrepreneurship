import client, { ApiResponse } from './apiClient';

// ===== Types matching BE DTOs (PlatformConnectionResponse, ConnectionStatsResponse, AuthorizationUrlResponse) =====

export type PlatformEnum = 'FACEBOOK' | 'INSTAGRAM' | 'THREADS';
export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED' | 'ON_HOLD' | 'ACTIVE' | 'REVOKED' | 'ERROR' | 'PENDING';
export type PlatformAccountType = 'USER' | 'PAGE' | 'BUSINESS_ACCOUNT' | 'PERSONAL';
export type TokenType = 'USER_TOKEN' | 'PAGE_TOKEN' | 'LONG_LIVED_USER_TOKEN';

export interface PlatformConnection {
  id: string;
  platform: PlatformEnum;
  accountName: string;
  platformAccountId: string;
  platformUsername: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  accountType: PlatformAccountType;
  tokenType: TokenType;
  connectionStatus: ConnectionStatus;
  apiVersionUsed: string | null;
  tokenIssuedAt: string | null;
  tokenExpiredAt: string | null;
  lastValidatedAt: string | null;
  lastSyncAt: string | null;
  tokenDaysRemaining: number | null;
  parentConnectionId: string | null;
  createdAt: string;
}

export interface ConnectionStats {
  total: number;
  active: number;
  expired: number;
  error: number;
}

export interface AuthorizationUrl {
  authorizationUrl: string;
}

// ===== Platform enum ↔ URL path segment mapping =====
// BE controller uses @PathVariable and Platform.valueOf(platform.toUpperCase()),
// so URL segment must be the lowercase enum name.
// FE display tags (FB/IG/TH) are separate — see theme.ts PLATFORMS.

const PLATFORM_URL: Record<PlatformEnum, string> = {
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  THREADS: 'threads',
};

/** FE tag (FB/IG/TH) → BE enum (FACEBOOK/INSTAGRAM/THREADS) */
export const TAG_TO_PLATFORM: Record<string, PlatformEnum> = {
  FB: 'FACEBOOK',
  IG: 'INSTAGRAM',
  TH: 'THREADS',
};

/** BE enum → FE tag */
export const PLATFORM_TO_TAG: Record<PlatformEnum, string> = {
  FACEBOOK: 'FB',
  INSTAGRAM: 'IG',
  THREADS: 'TH',
};

// ===== API functions =====

/**
 * GET /connections/{platform}/authorize
 * Lấy URL OAuth dialog của Meta. FE sẽ redirect (window.location.href) tới URL này.
 */
export async function getAuthorizationUrl(platform: PlatformEnum): Promise<AuthorizationUrl> {
  const { data } = await client.get<ApiResponse<AuthorizationUrl>>(
    `/connections/${PLATFORM_URL[platform]}/authorize`,
  );
  return data.result;
}

/**
 * GET /connections
 * Danh sách tất cả kết nối MXH của người dùng hiện tại.
 */
export async function listConnections(): Promise<PlatformConnection[]> {
  const { data } = await client.get<ApiResponse<PlatformConnection[]>>('/connections');
  return data.result;
}

/**
 * GET /connections/stats
 * Tổng quan kết nối (total / active / expired / error).
 */
export async function getConnectionStats(): Promise<ConnectionStats> {
  const { data } = await client.get<ApiResponse<ConnectionStats>>('/connections/stats');
  return data.result;
}

/**
 * POST /connections/{id}/validate
 * Kiểm tra trạng thái một kết nối (ping /me trên nền tảng).
 */
export async function validateConnection(id: string): Promise<PlatformConnection> {
  const { data } = await client.post<ApiResponse<PlatformConnection>>(
    `/connections/${id}/validate`,
  );
  return data.result;
}

/**
 * POST /connections/{id}/refresh
 * Làm mới long-lived token của một kết nối.
 */
export async function refreshConnection(id: string): Promise<PlatformConnection> {
  const { data } = await client.post<ApiResponse<PlatformConnection>>(
    `/connections/${id}/refresh`,
  );
  return data.result;
}

/**
 * DELETE /connections/{id}
 * Ngắt kết nối: revoke token trên nền tảng + soft delete.
 */
export async function disconnectConnection(id: string): Promise<void> {
  await client.delete<ApiResponse<void>>(`/connections/${id}`);
}
