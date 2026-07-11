import client, { type ApiResponse, type PageResponse } from "./apiClient";
import type { Platform } from "./brandProfile";

// Số liệu bài đã đăng (FR-59..FR-62) — backend PostAnalyticsController (/analytics).
// Mỗi bài kèm snapshot các mốc 24h/48h/7 ngày; CTR/conversion/watch time = null trong MVP.

export interface AnalyticsSnapshot {
  id: string;
  /** 24, 48 hoặc 168 (7 ngày). */
  milestoneHours: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  ctr: number | null;
  conversion: number | null;
  watchTime: number | null;
  collectedAt: string;
}

export interface AnalyzedPost {
  id: string;
  platformName: Platform;
  platformPostId: string | null;
  accountName: string | null;
  contentItemId: string | null;
  formattedCaption: string | null;
  publishedAt: string;
  /** Sắp theo mốc tăng dần (24h → 48h → 7d). */
  analytics: AnalyticsSnapshot[];
}

// GET /analytics/posts — bài POSTED mới nhất trước, phân trang server-side.
export async function listAnalyzedPosts(params: { page?: number; size?: number } = {}): Promise<PageResponse<AnalyzedPost>> {
  const { data } = await client.get<ApiResponse<PageResponse<AnalyzedPost>>>("/analytics/posts", { params });
  return data.result;
}

// GET /analytics/posts/{postId}
export async function getAnalyzedPost(postId: string): Promise<AnalyzedPost> {
  const { data } = await client.get<ApiResponse<AnalyzedPost>>(`/analytics/posts/${postId}`);
  return data.result;
}
