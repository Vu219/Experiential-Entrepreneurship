import client, { type ApiResponse, type PageResponse } from "./apiClient";

// Thông báo in-app (FR-75..FR-79) — backend NotificationController (/notifications). Cập nhật trực tiếp qua luồng
// realtime (realtime/events.ts: notification.created / .read / .deleted).

/** Khớp enum backend `NotificationType` — thêm giá trị phải sửa cả notificationMeta.ts + khoá i18n ntf_<TYPE>_*. */
export type NotificationType =
  | "POST_PUBLISHED"
  | "POST_FAILED"
  /** Bài AIMA không còn trên nền tảng (webhook remove — tự xoá hoặc bị gỡ). */
  | "POST_REMOVED_BY_PLATFORM"
  /** Lịch đang tạm giữ đã qua giờ đăng — sẽ không tự đăng, cần chọn giờ mới. */
  | "SCHEDULE_OVERDUE"
  /** Lịch chưa đăng bị giữ vì nền tảng khoá toàn hệ thống / ngoài gói / gói tắt lên lịch (params.variant = lý do). */
  | "SCHEDULE_HELD"
  | "RECONNECT_NEEDED"
  | "TOKEN_EXPIRING"
  | "REVIEW_NEEDED"
  | "CONTENT_GENERATION_FAILED"
  | "TREND_RESEARCH_DONE"
  | "TREND_RESEARCH_FAILED"
  | "NEW_INSIGHT"
  | "PAYMENT_SUCCEEDED"
  | "PLAN_EXPIRING"
  | "PLAN_EXPIRED"
  | "AI_QUOTA_WARNING"
  | "AI_QUOTA_EXHAUSTED"
  | "SCHEDULE_UPCOMING"
  /** Chỉ admin nhận. */
  | "PAYMENT_WEBHOOK_ALERT"
  | "ADMIN_USAGE_ALERT"
  | "ADMIN_AI_DEGRADED"
  | "ADMIN_API_VERSION";

/** Khớp enum backend `NotificationCategory` — đơn vị của cài đặt kênh. */
export type NotificationCategory =
  | "PUBLISH_ISSUES"
  | "ACCOUNTS"
  | "PUBLISHING"
  | "AI_CONTENT"
  | "BILLING"
  | "REMINDERS"
  | "ADMIN";

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "PUBLISH_ISSUES", "ACCOUNTS", "PUBLISHING", "AI_CONTENT", "BILLING", "REMINDERS", "ADMIN",
];

export type NotificationRefType =
  | "POST" | "SCHEDULE" | "CONTENT_ITEM" | "PLATFORM_ACCOUNT" | "STRATEGY" | "PAYMENT" | "SUBSCRIPTION"
  | "TREND_SESSION" | "GENERATION_JOB" | "PLATFORM";

export interface AppNotification {
  id: string;
  type: NotificationType;
  /** Câu tiếng Việt dự phòng (bản ghi trước V17 / không có params). Hiển thị qua notifications/text.ts. */
  title: string;
  message: string | null;
  /** Id đối tượng liên quan (post/content item/connection) để điều hướng. */
  refId: string | null;
  /** null = chưa đọc. */
  readAt: string | null;
  createdAt: string;
  category?: NotificationCategory | null;
  refType?: NotificationRefType | null;
  /** Tham số dựng câu theo ngôn ngữ (null với bản ghi cũ). */
  params?: Record<string, unknown> | null;
}

export interface NotificationListParams {
  /** "all" | "unread" — mặc định all. */
  status?: "all" | "unread";
  category?: NotificationCategory;
  page?: number;
  size?: number;
}

// GET /notifications — mới nhất trước, phân trang server-side.
export async function listNotifications(
  params: NotificationListParams = {}
): Promise<PageResponse<AppNotification>> {
  const { data } = await client.get<ApiResponse<PageResponse<AppNotification>>>("/notifications", { params });
  return data.result;
}

// GET /notifications/unread-count — badge chuông trên header.
export async function getUnreadCount(): Promise<number> {
  const { data } = await client.get<ApiResponse<number>>("/notifications/unread-count");
  return data.result;
}

// PATCH /notifications/{id}/read
export async function markNotificationRead(id: string): Promise<AppNotification> {
  const { data } = await client.patch<ApiResponse<AppNotification>>(`/notifications/${id}/read`);
  return data.result;
}

// PATCH /notifications/read-all — trả về số thông báo vừa được cập nhật.
export async function markAllNotificationsRead(): Promise<number> {
  const { data } = await client.patch<ApiResponse<number>>("/notifications/read-all");
  return data.result;
}

// DELETE /notifications/{id} — xoá mềm.
export async function deleteNotification(id: string): Promise<void> {
  await client.delete<ApiResponse<void>>(`/notifications/${id}`);
}

// DELETE /notifications?read=true — xoá mọi thông báo đã đọc; trả số bản ghi.
export async function deleteReadNotifications(): Promise<number> {
  const { data } = await client.delete<ApiResponse<number>>("/notifications", { params: { read: true } });
  return data.result;
}
