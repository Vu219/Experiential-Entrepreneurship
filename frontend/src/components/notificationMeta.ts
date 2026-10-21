import {
  AlarmClock, BadgeAlert, CalendarClock, CalendarX, CheckCircle2, CircleSlash, CreditCard, Gauge, Lightbulb, PlugZap,
  ServerCrash, ShieldAlert, Sparkles, TrendingUp, TriangleAlert, Unplug, XCircle, type LucideIcon,
} from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';
import type { NotificationType } from '../api/notifications';
import type { Route } from '../types';
import type { NotificationTarget } from '../notifications/links';
import { C } from '../styles/colors';

/**
 * Biểu tượng + màu theo loại thông báo, dùng chung cho chuông (NotificationBell), trang /notifications, toast realtime và
 * timeline "Hoạt động gần đây" trên Bảng điều khiển — cùng một nguồn dữ liệu (GET /notifications) nên phải cùng icon/màu.
 * Câu chữ: notifications/text.ts; đích khi bấm: notifications/links.ts.
 */

// Màu = token sáng/tối (styles/colors.ts); mã hex ở comment = giá trị sáng.
export const TYPE_META: Record<NotificationType, { icon: LucideIcon; color: string; bg: string }> = {
  POST_PUBLISHED: { icon: CheckCircle2, color: C.success, bg: C.successTint }, // #16a34a / #eafbf1
  POST_FAILED: { icon: XCircle, color: C.rose, bg: C.roseSoft }, // #e23d6e / #fdecf1
  POST_REMOVED_BY_PLATFORM: { icon: CircleSlash, color: C.rose, bg: C.roseSoft },
  SCHEDULE_OVERDUE: { icon: CalendarX, color: C.warning, bg: C.amberSoft }, // #d97706 / #fdf4e5
  SCHEDULE_HELD: { icon: CalendarX, color: C.warning, bg: C.amberSoft },
  RECONNECT_NEEDED: { icon: PlugZap, color: C.orange2, bg: C.orangeTint }, // #ea580c / #fdefe6
  TOKEN_EXPIRING: { icon: Unplug, color: C.orange2, bg: C.orangeTint },
  REVIEW_NEEDED: { icon: ShieldAlert, color: C.warning, bg: C.amberSoft },
  CONTENT_GENERATION_FAILED: { icon: BadgeAlert, color: C.rose, bg: C.roseSoft },
  TREND_RESEARCH_DONE: { icon: TrendingUp, color: C.primary, bg: C.purpleTint }, // #7c3aed / #f3edfd
  TREND_RESEARCH_FAILED: { icon: TrendingUp, color: C.rose, bg: C.roseSoft },
  NEW_INSIGHT: { icon: Lightbulb, color: C.primary, bg: C.purpleTint },
  PAYMENT_SUCCEEDED: { icon: CreditCard, color: C.success, bg: C.successTint },
  PLAN_EXPIRING: { icon: CalendarClock, color: C.warning, bg: C.amberSoft },
  PLAN_EXPIRED: { icon: CalendarX, color: C.warning, bg: C.amberSoft },
  AI_QUOTA_WARNING: { icon: Gauge, color: C.warning, bg: C.amberSoft },
  AI_QUOTA_EXHAUSTED: { icon: Gauge, color: C.rose, bg: C.roseSoft },
  SCHEDULE_UPCOMING: { icon: AlarmClock, color: C.primary, bg: C.purpleTint },
  // Cảnh báo vận hành chỉ gửi cho admin.
  PAYMENT_WEBHOOK_ALERT: { icon: TriangleAlert, color: C.rose, bg: C.roseSoft },
  ADMIN_USAGE_ALERT: { icon: TriangleAlert, color: C.warning, bg: C.amberSoft },
  ADMIN_AI_DEGRADED: { icon: ServerCrash, color: C.orange2, bg: C.orangeTint },
  ADMIN_API_VERSION: { icon: Sparkles, color: C.primary, bg: C.purpleTint },
};

/** Mở đích của một thông báo: route (giữ quy tắc profileOrigin của `go`) hoặc path đầy đủ. */
export function openNotificationTarget(
  target: NotificationTarget,
  go: (route: Route, search?: string) => void,
  navigate: NavigateFunction,
): void {
  if ('path' in target) {
    navigate(target.path);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  } else {
    go(target.route, target.search ?? '');
  }
}
