import client, { type ApiResponse, type PageResponse } from "./apiClient";
import type { Platform } from "./brandProfile";
import type { ConnectionStatus } from "./connections";
import { loadPublishingTimezone } from './schedules';
import { zonedTimestamp } from '../utils/publishingTime';
import type {
  PublishErrorAction, PublishErrorCategory, PublishErrorCode, PublishErrorOwner, PublishErrorSeverity,
} from './publishErrorCatalog';

// Trang "Bài lỗi & cần xử lý" (FR-35..FR-39) — trung tâm hồi phục bài của CHÍNH user.
// Backend FailedPostController (/me/failed-posts). Khác admin (FR-82/83/84) và NotificationBell.
// Backend chỉ gửi MÃ lỗi chuẩn hoá (`code`) — câu chữ thân thiện lấy từ api/publishErrorCatalog.ts;
// KHÔNG có (và không được hiển thị) message gốc của nền tảng.

export type PublishErrorType = "TEMPORARY" | "PERMANENT" | "POLICY_VIOLATION" | "INTERNAL";

/** Lọc theo phân loại thô của lần lỗi cuối (giữ cho tương thích): Tất cả / Vi phạm chính sách / Lỗi kỹ thuật. */
export type FailedPostFilter = "ALL" | "POLICY" | "TECHNICAL";

/** Vòng đời của một lần đăng lỗi (chiều suy ra, KHÔNG phải trạng thái bài). */
export type FailureState = "AUTO_RETRYING" | "NEEDS_ACTION" | "DISMISSED" | "RESOLVED";
/** Bộ lọc vòng đời của danh sách; mặc định backend = NEEDS_ACTION. */
export type FailedPostStateFilter = "NEEDS_ACTION" | "AUTO_RETRYING" | "DISMISSED" | "ACTIVE" | "ALL";

export interface FailedPost {
  id: string;
  /** Lịch của bài — dời giờ/hủy qua /schedules/{id}. */
  scheduleId: string;
  /** Bài gốc + bản nền tảng — "Sửa nội dung". */
  contentItemId: string | null;
  contentVersionId: string | null;
  platformName: Platform;
  accountId: string | null;
  accountName: string | null;
  /** Trạng thái kết nối đích HIỆN TẠI (EXPIRED/ERROR → phải kết nối lại trước khi thử lại). */
  accountStatus: ConnectionStatus | null;
  accountReady: boolean;
  caption: string | null;
  /** Phân loại thô cũ (POLICY_VIOLATION / TEMPORARY / PERMANENT / INTERNAL). */
  errorType: PublishErrorType | null;
  /** Mã gốc của nền tảng (FR-35), vd "190" — chỉ để đối chiếu, KHÔNG phải câu hiển thị. */
  errorCode: string | null;
  failedAt: string | null;
  /** Mã lỗi chuẩn AIMA → catalog. */
  code: PublishErrorCode;
  category: PublishErrorCategory;
  severity: PublishErrorSeverity;
  owner: PublishErrorOwner;
  autoRetry: boolean;
  /** Hành động khả dụng NGAY (backend đã lọc theo vòng đời / nội dung đã sửa). */
  actions: PublishErrorAction[];
  platformSubcode: string | null;
  /** Mã tham chiếu gửi hỗ trợ, vd ERR-3F9A1C. */
  referenceCode: string | null;
  state: FailureState;
  attempt: number;
  maxAttempts: number | null;
  nextRetryAt: string | null;
  contentChanged: boolean;
}

export interface FailedPostAttempt {
  retryCount: number;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "RETRYING";
  code: PublishErrorCode | null;
  platformCode: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  nextRetryAt: string | null;
  referenceCode: string | null;
  resolution: "DISMISSED" | "RETRIED" | "CANCELLED" | null;
}

export interface FailedPostDetail {
  post: FailedPost;
  attempts: FailedPostAttempt[];
}

export interface FailedPostRetryResult {
  postId: string;
  scheduleId: string;
  /** null khi lịch bị tạm giữ thay vì đăng (vd bài cần duyệt). */
  jobId: string | null;
  heldReason: string | null;
}

export type FailedPostBulkAction = "RETRY" | "DISMISS";

export interface FailedPostBulkResult {
  succeeded: number;
  failed: number;
  results: { postId: string; code: number; message: string; jobId: string | null }[];
}

export interface FailedPostListParams {
  filter?: FailedPostFilter;
  state?: FailedPostStateFilter;
  page?: number;
  size?: number;
}

const zoned = (iso: string | null) => (iso ? zonedTimestamp(iso) : null);

const toFailedPost = (post: FailedPost): FailedPost => ({
  ...post,
  actions: post.actions ?? [],
  failedAt: zoned(post.failedAt),
  nextRetryAt: zoned(post.nextRetryAt),
});

// GET /me/failed-posts — bài lỗi của user theo vòng đời, phân trang server-side (tối đa 100/trang).
export async function listFailedPosts(params: FailedPostListParams = {}): Promise<PageResponse<FailedPost>> {
  await loadPublishingTimezone();
  const { data } = await client.get<ApiResponse<PageResponse<FailedPost>>>("/me/failed-posts", {
    params: {
      filter: params.filter ?? "ALL",
      state: params.state ?? "NEEDS_ACTION",
      page: params.page ?? 0,
      size: params.size ?? 8,
    },
  });
  return { ...data.result, content: data.result.content.map(toFailedPost) };
}

// GET /me/failed-posts/{id} — chi tiết + timeline các lần thử.
export async function getFailedPost(postId: string): Promise<FailedPostDetail> {
  await loadPublishingTimezone();
  const { data } = await client.get<ApiResponse<FailedPostDetail>>(`/me/failed-posts/${postId}`);
  return {
    post: toFailedPost(data.result.post),
    attempts: data.result.attempts.map((a) => ({
      ...a,
      startedAt: zoned(a.startedAt),
      finishedAt: zoned(a.finishedAt),
      nextRetryAt: zoned(a.nextRetryAt),
    })),
  };
}

// POST /me/failed-posts/{id}/retry — "Thử lại ngay" (chạy nền, trả ngay).
export async function retryFailedPost(postId: string): Promise<FailedPostRetryResult> {
  const { data } = await client.post<ApiResponse<FailedPostRetryResult>>(`/me/failed-posts/${postId}/retry`);
  return data.result;
}

// POST /me/failed-posts/{id}/dismiss — bỏ qua lỗi (ẩn khỏi "Cần xử lý").
export async function dismissFailedPost(postId: string): Promise<FailedPost> {
  const { data } = await client.post<ApiResponse<FailedPost>>(`/me/failed-posts/${postId}/dismiss`);
  return toFailedPost(data.result);
}

// POST /me/failed-posts/bulk — 1–50 bài, kết quả từng dòng.
export async function bulkFailedPosts(action: FailedPostBulkAction, postIds: string[]): Promise<FailedPostBulkResult> {
  const { data } = await client.post<ApiResponse<FailedPostBulkResult>>("/me/failed-posts/bulk", { action, postIds });
  return data.result;
}

/** Nền tảng đang có sự cố diện rộng — AIMA tạm hoãn tự thử lại các bài của nền tảng đó. */
export interface PlatformIncident {
  platform: Platform;
  since: string;
  failures: number;
  accounts: number;
}

// GET /me/failed-posts/platform-status — banner sự cố nền tảng.
export async function getPlatformStatus(): Promise<PlatformIncident[]> {
  const { data } = await client.get<ApiResponse<PlatformIncident[]>>("/me/failed-posts/platform-status");
  return data.result;
}
