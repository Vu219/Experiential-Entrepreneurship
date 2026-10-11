import { getDict } from '../../i18n.ts';
import { TONE_COLORS, type Tone } from '../../statusTokens.ts';
import type { FailedPost, FailedPostAttempt, FailureState } from '../../api/failedPosts.ts';
import type { Platform } from '../../api/brandProfile.ts';
import type { PublishErrorCategory, PublishErrorCode } from '../../api/publishErrorCatalog.ts';

// Helper dùng chung cho cụm component trang "Bài lỗi & cần xử lý" (master–detail).
// Màu lấy từ TONE_COLORS — không hardcode rời. Câu chữ của LỖI lấy từ api/publishErrorCatalog.ts.

export type FpDict = ReturnType<typeof getDict>;

/**
 * Tone của một bài lỗi: đỏ = chặn cứng (vi phạm chính sách, tài khoản/token hỏng — xử lý cho cả nhóm),
 * xanh = hệ thống đang tự xử lý (đang tự thử lại / lỗi tạm thời), cam = một bài cần người dùng xử lý.
 */
export function toneKeyOf(p: FailedPost): Tone {
  if (p.state === 'AUTO_RETRYING') return 'info';
  if (p.category === 'POLICY' || p.severity === 'CRITICAL') return 'danger';
  if (p.severity === 'WARNING') return 'info';
  return 'warning';
}

export const toneOf = (p: FailedPost) => TONE_COLORS[toneKeyOf(p)];

/** Badge vòng đời. */
export const STATE_TONE: Record<FailureState, Tone> = {
  NEEDS_ACTION: 'danger',
  AUTO_RETRYING: 'info',
  DISMISSED: 'neutral',
  RESOLVED: 'success',
};

export function stateLabel(state: FailureState, t: FpDict): string {
  switch (state) {
    case 'NEEDS_ACTION': return t.fpStateNeedsAction;
    case 'AUTO_RETRYING': return t.fpStateAutoRetrying;
    case 'DISMISSED': return t.fpStateDismissed;
    default: return t.fpStateResolved;
  }
}

/** Nhãn trạng thái của một lần thử đăng (timeline) — dùng cả ở trang admin. */
export function attemptStatusLabel(status: FailedPostAttempt['status'], t: FpDict): string {
  switch (status) {
    case 'SUCCESS': return t.fpAttSuccess;
    case 'FAILED': return t.fpAttFailed;
    case 'RETRYING': return t.fpAttRetrying;
    case 'RUNNING': return t.fpAttRunning;
    default: return t.fpAttPending;
  }
}

/**
 * Nhóm lớn cho biểu đồ tổng quan — gộp 12 nhóm của catalog thành 5 nhóm theo CÁCH XỬ LÝ để donut đọc được.
 */
export type OverviewGroup = 'POLICY' | 'ACCOUNT' | 'CONTENT' | 'PLATFORM' | 'SYSTEM';

export const OVERVIEW_GROUP_OF: Record<PublishErrorCategory, OverviewGroup> = {
  POLICY: 'POLICY',
  AUTH: 'ACCOUNT',
  PERMISSION: 'ACCOUNT',
  ACCOUNT: 'ACCOUNT',
  CONTENT: 'CONTENT',
  MEDIA: 'CONTENT',
  RATE_LIMIT: 'PLATFORM',
  NETWORK: 'PLATFORM',
  PLATFORM: 'PLATFORM',
  QUOTA: 'PLATFORM',
  INTERNAL: 'SYSTEM',
  UNKNOWN: 'SYSTEM',
};

export const OVERVIEW_GROUP_TONE: Record<OverviewGroup, Tone> = {
  POLICY: 'danger',
  ACCOUNT: 'purple',
  CONTENT: 'warning',
  PLATFORM: 'info',
  SYSTEM: 'neutral',
};

export function overviewGroupLabel(group: OverviewGroup, t: FpDict): string {
  switch (group) {
    case 'POLICY': return t.fpGroupPolicy;
    case 'ACCOUNT': return t.fpGroupAccount;
    case 'CONTENT': return t.fpGroupContent;
    case 'PLATFORM': return t.fpGroupPlatform;
    default: return t.fpGroupSystem;
  }
}

/** 'YYYY-MM-DDTHH:mm…' (giờ đăng bài đã quy đổi) → 'DD/MM/YYYY' và 'HH:mm'. */
export const fmtDate = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
export const fmtTime = (iso: string | null) => (iso ? iso.slice(11, 16) : '');

/** Bộ lọc phụ dưới hàng tab. Rỗng/ALL = không lọc. */
export interface FpFilters {
  platform: 'ALL' | Platform;
  /** id kết nối đích. */
  account: 'ALL' | string;
  category: 'ALL' | PublishErrorCategory;
  code: 'ALL' | PublishErrorCode;
  /** yyyy-MM-dd hoặc '' (không lọc). */
  from: string;
  to: string;
}

export const EMPTY_FILTERS: FpFilters = { platform: 'ALL', account: 'ALL', category: 'ALL', code: 'ALL', from: '', to: '' };

export const countActiveFilters = (f: FpFilters) =>
  (f.platform !== 'ALL' ? 1 : 0) + (f.account !== 'ALL' ? 1 : 0) + (f.category !== 'ALL' ? 1 : 0)
  + (f.code !== 'ALL' ? 1 : 0) + (f.from ? 1 : 0) + (f.to ? 1 : 0);

export function matchesFilters(p: FailedPost, f: FpFilters): boolean {
  if (f.platform !== 'ALL' && p.platformName !== f.platform) return false;
  if (f.account !== 'ALL' && p.accountId !== f.account) return false;
  if (f.category !== 'ALL' && p.category !== f.category) return false;
  if (f.code !== 'ALL' && p.code !== f.code) return false;
  const day = p.failedAt?.slice(0, 10) ?? '';
  if (f.from && day < f.from) return false;
  if (f.to && day > f.to) return false;
  return true;
}

/** Trang nền tảng để người dùng tự xử lý (checkpoint, hạn chế, vai trò Trang). */
export const PLATFORM_HOME: Record<Platform, string> = {
  FACEBOOK: 'https://www.facebook.com/',
  INSTAGRAM: 'https://www.instagram.com/',
  THREADS: 'https://www.threads.net/',
};
