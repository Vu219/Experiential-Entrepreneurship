import client, { type ApiResponse, type PageResponse } from "./apiClient";
import type { Platform } from "./brandProfile";
import { loadPublishingTimezone } from './schedules';
import { zonedTimestamp } from '../utils/publishingTime';

// Trang "Bài lỗi & cần xử lý" (FR-35..FR-39) — trung tâm hồi phục bài của CHÍNH user.
// Backend FailedPostController (/me/failed-posts). Khác admin (FR-82/83/84) và NotificationBell.

export type PublishErrorType = "TEMPORARY" | "PERMANENT" | "POLICY_VIOLATION" | "INTERNAL";

/** 3 tab: Tất cả / Vi phạm chính sách / Lỗi kỹ thuật (cách xử lý khác nhau). */
export type FailedPostFilter = "ALL" | "POLICY" | "TECHNICAL";

export interface FailedPost {
  id: string;
  /** Lịch của bài — dời giờ/hủy qua /schedules/{id}. */
  scheduleId: string;
  /** Bài gốc — sửa/tạo lại nội dung rồi đăng lại. */
  contentItemId: string | null;
  platformName: Platform;
  accountName: string | null;
  caption: string | null;
  /** POLICY_VIOLATION = vi phạm chính sách (không retry); còn lại = lỗi kỹ thuật. */
  errorType: PublishErrorType | null;
  /** Mã lỗi gốc từ nền tảng (FR-35), vd "368" / "190". */
  errorCode: string | null;
  errorMessage: string | null;
  failedAt: string | null;
}

export interface FailedPostListParams {
  filter?: FailedPostFilter;
  page?: number;
  size?: number;
}

// GET /me/failed-posts — bài lỗi của user, mới nhất trước, phân trang server-side.
export async function listFailedPosts(params: FailedPostListParams = {}): Promise<PageResponse<FailedPost>> {
  await loadPublishingTimezone();
  const { data } = await client.get<ApiResponse<PageResponse<FailedPost>>>("/me/failed-posts", {
    params: { filter: params.filter ?? "ALL", page: params.page ?? 0, size: params.size ?? 8 },
  });
  return { ...data.result, content: data.result.content.map(post => ({
    ...post, failedAt: post.failedAt ? zonedTimestamp(post.failedAt) : null,
  })) };
}
