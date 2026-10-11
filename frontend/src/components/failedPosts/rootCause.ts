import type { FailedPost } from '../../api/failedPosts.ts';
import type { PublishErrorCode } from '../../api/publishErrorCatalog.ts';

// Gom bài lỗi theo NGUYÊN NHÂN GỐC cấp tài khoản: nhiều bài cùng hỏng vì một tài khoản (token hết hạn, thiếu quyền,
// tài khoản bị chặn...) chỉ cần xử lý MỘT lần ("Kết nối lại một lần để xử lý tất cả"). Module thuần (chỉ import
// type) để test bằng `node --test` — xem tests/failedPostRootCause.test.ts.

/** Mã lỗi cấp tài khoản — khớp PublishErrorCode.isAccountLevel() phía backend. */
export const ACCOUNT_LEVEL_CODES: readonly PublishErrorCode[] = [
  'POLICY_TEMPORARY_BLOCK', 'AUTH_TOKEN_EXPIRED', 'AUTH_PASSWORD_CHANGED', 'AUTH_APP_REMOVED',
  'AUTH_PERMISSION_MISSING', 'AUTH_PAGE_ROLE_MISSING', 'ACCOUNT_CHECKPOINT', 'ACCOUNT_RESTRICTED',
  'ACCOUNT_DISCONNECTED',
];

export interface RootCauseGroup {
  key: string;
  code: PublishErrorCode;
  accountId: string;
  accountName: string | null;
  platformName: FailedPost['platformName'];
  /** Tài khoản đã kết nối lại (ACTIVE) → có thể "Thử lại tất cả" ngay. */
  accountReady: boolean;
  postIds: string[];
}

/**
 * Nhóm bài CẦN XỬ LÝ theo (mã cấp tài khoản, tài khoản). Chỉ trả nhóm có ít nhất {@code minSize} bài;
 * nhóm đông nhất trước.
 */
export function groupRootCauses(posts: FailedPost[], minSize = 2): RootCauseGroup[] {
  const groups = new Map<string, RootCauseGroup>();
  for (const p of posts) {
    if (p.state !== 'NEEDS_ACTION' || !p.accountId || !ACCOUNT_LEVEL_CODES.includes(p.code)) continue;
    const key = `${p.code}:${p.accountId}`;
    const group = groups.get(key) ?? {
      key, code: p.code, accountId: p.accountId, accountName: p.accountName, platformName: p.platformName,
      accountReady: p.accountReady, postIds: [],
    };
    group.postIds.push(p.id);
    group.accountReady = group.accountReady && p.accountReady;
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((g) => g.postIds.length >= minSize)
    .sort((a, b) => b.postIds.length - a.postIds.length);
}
