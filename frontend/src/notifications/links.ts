// Đích khi bấm một thông báo — dựng từ type + refType/refId (D9 + bảng mục 2.4 của đề xuất). Module thuần, test ở
// tests/notificationText.test.ts. Bản ghi cũ (không refType) rơi về trang theo loại như trước.
import type { AppNotification } from '../api/notifications.ts';
import type { Route } from '../types.ts';

export type NotificationTarget = { route: Route; search?: string } | { path: string };

const enc = encodeURIComponent;

export function notificationTarget(n: AppNotification): NotificationTarget {
  const ref = n.refId;
  switch (n.type) {
    case 'POST_PUBLISHED':
    case 'SCHEDULE_OVERDUE':
    case 'SCHEDULE_HELD':
    case 'SCHEDULE_UPCOMING':
    case 'POST_REMOVED_BY_PLATFORM':
      return ref && n.refType === 'SCHEDULE' ? { path: `/calendar/${enc(ref)}` } : { route: 'calendar' };
    case 'POST_FAILED':
      return ref && n.refType === 'POST' ? { route: 'failedPosts', search: `?post=${enc(ref)}` } : { route: 'failedPosts' };
    case 'RECONNECT_NEEDED':
    case 'TOKEN_EXPIRING':
      return { route: 'settings', search: '?tab=connections' };
    case 'REVIEW_NEEDED':
      return ref ? { route: 'create', search: `?view=${enc(ref)}` } : { route: 'create' };
    case 'CONTENT_GENERATION_FAILED':
      return ref ? { path: `/create/${enc(ref)}?step=2` } : { route: 'create' };
    case 'TREND_RESEARCH_DONE':
    case 'TREND_RESEARCH_FAILED':
      return { route: 'trends' };
    case 'NEW_INSIGHT':
      // refId = id chiến lược (kể cả bản ghi trước V17).
      return ref ? { route: 'brand', search: `?tab=strategy&strategy=${enc(ref)}` } : { route: 'brand', search: '?tab=strategy' };
    case 'PAYMENT_SUCCEEDED':
    case 'PLAN_EXPIRING':
    case 'PLAN_EXPIRED':
      return { route: 'billing' };
    case 'AI_QUOTA_WARNING':
    case 'AI_QUOTA_EXHAUSTED':
      return { route: 'usage' };
    case 'PAYMENT_WEBHOOK_ALERT':
      return { path: '/admin/revenue?tab=orders' };
    case 'ADMIN_USAGE_ALERT':
      return { route: 'adminUsage' };
    case 'ADMIN_AI_DEGRADED':
      return { route: 'adminSystem' };
    case 'ADMIN_API_VERSION':
      return { route: 'adminApiVersions' };
    default:
      return { route: 'dashboard' };
  }
}
