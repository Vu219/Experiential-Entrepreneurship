import { CalendarX, CheckCircle2, CreditCard, Lightbulb, PlugZap, ShieldAlert, TriangleAlert, XCircle, type LucideIcon } from 'lucide-react';
import type { NotificationType } from '../api/notifications';
import type { Route } from '../types';

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
  PAYMENT_SUCCEEDED: 'billing',
  PLAN_EXPIRED: 'billing',
  // Cảnh báo vận hành chỉ gửi cho admin → trang Đơn hàng, nơi có sẵn badge "webhook bị từ
  // chối 24h" và hàng đợi đơn cần đối soát.
  PAYMENT_WEBHOOK_ALERT: 'adminPayments',
};

export const TYPE_META: Record<NotificationType, { icon: LucideIcon; color: string; bg: string }> = {
  POST_PUBLISHED: { icon: CheckCircle2, color: '#16a34a', bg: '#eafbf1' },
  POST_FAILED: { icon: XCircle, color: '#e23d6e', bg: '#fdecf1' },
  REVIEW_NEEDED: { icon: ShieldAlert, color: '#d97706', bg: '#fdf4e5' },
  RECONNECT_NEEDED: { icon: PlugZap, color: '#ea580c', bg: '#fdefe6' },
  NEW_INSIGHT: { icon: Lightbulb, color: '#7c3aed', bg: '#f3edfd' },
  PAYMENT_SUCCEEDED: { icon: CreditCard, color: '#16a34a', bg: '#eafbf1' },
  PLAN_EXPIRED: { icon: CalendarX, color: '#d97706', bg: '#fdf4e5' },
  PAYMENT_WEBHOOK_ALERT: { icon: TriangleAlert, color: '#e23d6e', bg: '#fdecf1' },
};
