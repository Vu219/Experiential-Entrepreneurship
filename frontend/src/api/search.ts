import client, { type ApiResponse } from "./apiClient";
import type { ContentItemResponse } from "./contentGeneration";
import { toContentListItem, type ContentListItem } from "./contentCreationService";
import type { ContentStrategy } from "./contentStrategy";
import type { PostSchedule } from "./schedules";

// Ô tìm kiếm toàn cục — backend SearchController (GET /search): tìm KHÔNG DẤU trong nội dung (caption/hook/hashtag
// của các bản nền tảng), tên chiến lược, lịch đăng (bài hoặc tên tài khoản đăng) của CHÍNH user. Mỗi nhóm tối đa
// `limit` mục + tổng số khớp. Mục nội dung đi qua cùng hàm map với trang Tạo nội dung → tiêu đề hiển thị khớp nhau.

interface GlobalSearchPayload {
  contents: ContentItemResponse[];
  contentTotal: number;
  strategies: ContentStrategy[];
  strategyTotal: number;
  schedules: PostSchedule[];
  scheduleTotal: number;
}

export interface GlobalSearchResult {
  contents: ContentListItem[];
  contentTotal: number;
  strategies: ContentStrategy[];
  strategyTotal: number;
  schedules: PostSchedule[];
  scheduleTotal: number;
}

/** Số mục mỗi nhóm dữ liệu trong palette. */
export const SEARCH_GROUP_LIMIT = 5;

export async function globalSearch(q: string, signal?: AbortSignal): Promise<GlobalSearchResult> {
  const { data } = await client.get<ApiResponse<GlobalSearchPayload>>("/search", {
    params: { q, limit: SEARCH_GROUP_LIMIT },
    signal,
  });
  const r = data.result;
  return {
    contents: (r.contents ?? []).map(toContentListItem),
    contentTotal: r.contentTotal ?? 0,
    strategies: r.strategies ?? [],
    strategyTotal: r.strategyTotal ?? 0,
    schedules: r.schedules ?? [],
    scheduleTotal: r.scheduleTotal ?? 0,
  };
}
