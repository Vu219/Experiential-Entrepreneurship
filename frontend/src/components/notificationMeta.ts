import { CalendarX, CheckCircle2, CreditCard, Lightbulb, PlugZap, ShieldAlert, TriangleAlert, XCircle, type LucideIcon } from 'lucide-react';
import type { NotificationType } from '../api/notifications';
import type { Route } from '../types';
import { C } from '../styles/colors';

/**
 * Điều hướng + biểu tượng theo loại thông báo, dùng chung cho chuông thông báo (NotificationBell)
 * và timeline "Hoạt động gần đây" trên Bảng điều khiển — hai nơi hiển thị cùng một nguồn dữ liệu
 * (GET /notifications) nên phải cùng icon/màu/đích đến.
 */

// Bài đăng → lịch, đăng lỗi → trang Bài lỗi & cần xử lý (FR-38, nhảy thẳng vào trung tâm hồi phục),
// cần duyệt → nội dung, kết nối lại → cài đặt, insight → phân tích.
export const ROUTE_BY_TYPE: Record<NotificationType, Route> = {
  POST_PUBLISHED: 'calendar',
  POST_FAILED: 'failedPosts',
  REVIEW_NEEDED: 'create',
  RECONNECT_NEEDED: 'settings',
  NEW_INSIGHT: 'analytics',
  SCHEDULE_OVERDUE: 'calendar',
  PAYMENT_SUCCEEDED: 'billing',
  PLAN_EXPIRED: 'billing',
  // Cảnh báo vận hành chỉ gửi cho admin → trang Đơn hàng, nơi có sẵn badge "webhook bị từ
  // chối 24h" và hàng đợi đơn cần đối soát.
  PAYMENT_WEBHOOK_ALERT: 'adminPayments',
};

// Màu = token sáng/tối (styles/colors.ts); mã hex ở comment = giá trị sáng.
export const TYPE_META: Record<NotificationType, { icon: LucideIcon; color: string; bg: string }> = {
  POST_PUBLISHED: { icon: CheckCircle2, color: C.success, bg: C.successTint }, // #16a34a / #eafbf1
  POST_FAILED: { icon: XCircle, color: C.rose, bg: C.roseSoft }, // #e23d6e / #fdecf1
  REVIEW_NEEDED: { icon: ShieldAlert, color: C.warning, bg: C.amberSoft }, // #d97706 / #fdf4e5
  RECONNECT_NEEDED: { icon: PlugZap, color: C.orange2, bg: C.orangeTint }, // #ea580c / #fdefe6
  NEW_INSIGHT: { icon: Lightbulb, color: C.primary, bg: C.purpleTint }, // #7c3aed / #f3edfd
  SCHEDULE_OVERDUE: { icon: CalendarX, color: C.warning, bg: C.amberSoft }, // #d97706 / #fdf4e5
  PAYMENT_SUCCEEDED: { icon: CreditCard, color: C.success, bg: C.successTint }, // #16a34a / #eafbf1
  PLAN_EXPIRED: { icon: CalendarX, color: C.warning, bg: C.amberSoft }, // #d97706 / #fdf4e5
  PAYMENT_WEBHOOK_ALERT: { icon: TriangleAlert, color: C.rose, bg: C.roseSoft }, // #e23d6e / #fdecf1
};
