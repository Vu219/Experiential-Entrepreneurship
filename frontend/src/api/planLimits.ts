import client, { type ApiResponse } from './apiClient';
import type { PlatformEnum } from './connections';

// Giới hạn theo gói (backend Flyway V15/V18/V20, enum PlanLimitKey). Admin cấu hình ở "Quản lý gói"; backend chặn
// tại service (mã 2205 PLAN_LIMIT_REACHED / 2206 PLAN_FEATURE_NOT_INCLUDED, HTTP 403, result = PlanLimitViolation).
// FE chỉ hiển thị trạng thái khoá + chặn trước cho đỡ thao tác thừa — không tự quyết định cho phép hay không.

export type {
  PlanLimitKey, PlanLimitType, PlanFeatureLimits, PlanLimitGroup, PlanLimitUnit, PlanLimitField,
} from './planLimitCatalog';
export { PLAN_LIMIT_FIELDS, PLAN_LIMIT_GROUPS, ALL_PLATFORMS, planLimitField } from './planLimitCatalog';
import type { PlanLimitKey, PlanLimitType } from './planLimitCatalog';

// Mã lỗi + câu báo nằm ở utils/planLimitText (apiClient dùng — tách để không import vòng qua client).
export { PLAN_LIMIT_REACHED, PLAN_FEATURE_NOT_INCLUDED, planLimitLabel, planLimitMessage } from '../utils/planLimitText';

/** `result` của lỗi 2205/2206. */
export interface PlanLimitViolation {
  limitKey: PlanLimitKey;
  /** Hạn mức hiệu lực (0 = không có trong gói). */
  limit: number | null;
  used: number | null;
  planCode: string | null;
  /** Chỉ ALLOWED_PLATFORMS: nền tảng bị từ chối. */
  platform?: PlatformEnum | null;
}

export interface PlanUsageItem {
  key: PlanLimitKey;
  type: PlanLimitType;
  /** null = không giới hạn / đang bật; 0 = tắt. SET: số nền tảng được phép. */
  limit: number | null;
  /** null = không đếm ở cấp tài khoản (CAP, FLAG, SET, theo từng thương hiệu). */
  used: number | null;
  included: boolean;
  /** SET: nền tảng gói cho phép. */
  platforms?: PlatformEnum[] | null;
  /** Đếm theo phạm vi (STRATEGIES_PER_BRAND: theo từng thương hiệu). */
  scopes?: { scopeId: string; scopeName: string; used: number }[] | null;
}

export interface PlanUsage {
  planCode: string | null;
  periodStart: string;
  periodEnd: string;
  items: PlanUsageItem[];
}

/** GET /users/me/plan-usage — giới hạn của gói hiện tại + mức đã dùng trong kỳ (chu kỳ thanh toán). */
export async function getPlanUsage(): Promise<PlanUsage> {
  const { data } = await client.get<ApiResponse<PlanUsage>>('/users/me/plan-usage');
  return data.result;
}
