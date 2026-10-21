import { useEffect, useState } from 'react';
import { getDashboardSummary } from '../api/dashboard';
import { listFailedPosts } from '../api/failedPosts';
import type { Platform } from '../api/brandProfile';

/** Gợi ý theo ngữ cảnh khi ô tìm kiếm còn trống (khu người dùng). */
export type SearchSuggestion =
  | { kind: 'review'; count: number }
  | { kind: 'failed'; count: number }
  | { kind: 'connect'; platform: Platform }
  | { kind: 'brand' };

/** Số liệu đổi chậm — dùng lại kết quả trong 60s thay vì gọi lại mỗi lần mở palette. */
const CACHE_MS = 60_000;
let cache: { userId: string; at: number; items: SearchSuggestion[] } | null = null;

async function load(): Promise<SearchSuggestion[]> {
  // Dùng lại API sẵn có (không thêm endpoint): tổng hợp Bảng điều khiển + đếm bài lỗi cần xử lý. Mỗi nguồn lỗi
  // thì chỉ bỏ gợi ý của nguồn đó.
  const [summary, failed] = await Promise.allSettled([
    getDashboardSummary(),
    listFailedPosts({ filter: 'ALL', state: 'NEEDS_ACTION', page: 0, size: 1 }),
  ]);
  const items: SearchSuggestion[] = [];
  if (summary.status === 'fulfilled') {
    const s = summary.value;
    if (!s.onboarding.brand) items.push({ kind: 'brand' });
    if (s.awaitingReview > 0) items.push({ kind: 'review', count: s.awaitingReview });
  }
  if (failed.status === 'fulfilled' && failed.value.totalElements > 0) {
    items.push({ kind: 'failed', count: failed.value.totalElements });
  }
  if (summary.status === 'fulfilled') {
    summary.value.platforms.filter((p) => !p.connected).forEach((p) => items.push({ kind: 'connect', platform: p.platform }));
  }
  return items;
}

/** Gợi ý cho user hiện tại; `userId` null (khu quản trị / chưa đăng nhập) → không gọi API. */
export function useSearchSuggestions(userId: string | null): SearchSuggestion[] {
  const fresh = cache && userId && cache.userId === userId && Date.now() - cache.at < CACHE_MS ? cache.items : null;
  const [items, setItems] = useState<SearchSuggestion[]>(fresh ?? []);

  useEffect(() => {
    if (!userId || fresh) return;
    let cancelled = false;
    load()
      .then((next) => {
        cache = { userId, at: Date.now(), items: next };
        if (!cancelled) setItems(next);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
    // `fresh` chỉ quyết định lần mount — không gọi lại khi cache được ghi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return userId ? items : [];
}
