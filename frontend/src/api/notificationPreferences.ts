import client, { type ApiResponse } from "./apiClient";
import type { NotificationCategory } from "./notifications";

// Cài đặt thông báo (backend NotificationPreferenceController): email lỗi đăng bài + tài khoản là OPT-IN
// (docs/failed-posts-error-handling-plan.md §8 — C); kênh trong app / toast theo nhóm (ma trận Cài đặt → Thông báo).

export type EmailPromptStatus = "NOT_ASKED" | "ACCEPTED" | "DECLINED";

export interface NotificationChannel {
  category: NotificationCategory;
  inApp: boolean;
  toast: boolean;
  /** "Trong app" luôn bật — ô bị khoá. */
  mandatoryInApp: boolean;
  /** Có email (dùng chung `emailPublishErrors`). */
  emailCapable: boolean;
  adminOnly: boolean;
}

export interface NotificationPreferences {
  emailPublishErrors: boolean;
  emailPromptStatus: EmailPromptStatus;
  consentAt: string | null;
  /** Máy chủ có bật gửi email lỗi đăng bài không — tắt thì không hỏi người dùng. */
  emailAvailable: boolean;
  /** Đã áp mặc định, thứ tự cố định theo nhóm. */
  channels?: NotificationChannel[];
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

/** Đổi kênh của MỘT nhóm (trường bỏ trống = giữ nguyên). */
export async function updateNotificationChannel(
  category: NotificationCategory,
  change: { inApp?: boolean; toast?: boolean },
): Promise<NotificationPreferences> {
  const { data } = await client.put<ApiResponse<NotificationPreferences>>("/users/me/notification-preferences", {
    channels: { [category]: change },
  });
  return data.result;
}

/** Link huỷ nhận trong email (không cần đăng nhập) — token có chữ ký + hạn dùng. */
export async function unsubscribeEmail(token: string): Promise<void> {
  await client.post<ApiResponse<{ unsubscribed: boolean }>>("/notifications/unsubscribe", null, { params: { token } });
}
