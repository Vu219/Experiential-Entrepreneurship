import client, { type ApiResponse, type PageResponse } from "./apiClient";

// Thông báo in-app (FR-75..FR-79) — backend NotificationController (/notifications).

export type NotificationType =
  | "POST_PUBLISHED"
  | "POST_FAILED"
  | "REVIEW_NEEDED"
  | "RECONNECT_NEEDED"
  | "NEW_INSIGHT";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  /** Id đối tượng liên quan (post/content item/connection) để điều hướng. */
  refId: string | null;
  /** null = chưa đọc. */
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListParams {
  unreadOnly?: boolean;
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
