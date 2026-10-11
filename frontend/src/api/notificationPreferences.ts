import client, { type ApiResponse } from "./apiClient";

// Email lỗi đăng bài là OPT-IN (docs/failed-posts-error-handling-plan.md §8 — C). Backend NotificationPreferenceController.

export type EmailPromptStatus = "NOT_ASKED" | "ACCEPTED" | "DECLINED";

export interface NotificationPreferences {
  emailPublishErrors: boolean;
  emailPromptStatus: EmailPromptStatus;
  consentAt: string | null;
  /** Máy chủ có bật gửi email lỗi đăng bài không — tắt thì không hỏi người dùng. */
  emailAvailable: boolean;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await client.get<ApiResponse<NotificationPreferences>>("/users/me/notification-preferences");
  return data.result;
}

/** Bật/tắt email lỗi đăng bài — cũng là câu trả lời cho banner hỏi một lần ở trang Bài lỗi. */
export async function updateEmailPublishErrors(emailPublishErrors: boolean): Promise<NotificationPreferences> {
  const { data } = await client.put<ApiResponse<NotificationPreferences>>("/users/me/notification-preferences", { emailPublishErrors });
  return data.result;
}

/** Link huỷ nhận trong email (không cần đăng nhập) — token có chữ ký + hạn dùng. */
export async function unsubscribeEmail(token: string): Promise<void> {
  await client.post<ApiResponse<{ unsubscribed: boolean }>>("/notifications/unsubscribe", null, { params: { token } });
}
