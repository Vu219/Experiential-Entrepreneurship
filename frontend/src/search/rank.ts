import { matchItem } from './match.ts';
import type { Dict } from '../i18n.ts';
import type { RankedItem, SearchContext, StaticSearchItem } from './types.ts';

// Lọc theo quyền/khu vực + chấm điểm các mục tĩnh của palette. Module thuần — tests/globalSearch.test.ts.

/** Mục tĩnh user hiện tại được thấy ở khu vực đang mở. */
export function visibleItems(items: readonly StaticSearchItem[], ctx: SearchContext): StaticSearchItem[] {
  return items.filter((it) =>
    it.areas.includes(ctx.area)
    && (!it.roles || (ctx.role !== undefined && it.roles.includes(ctx.role)))
    && (!it.available || it.available(ctx)));
}

/** Số dòng tối đa mỗi nhóm tĩnh khi đang gõ. */
export const GROUP_LIMITS = { pages: 6, sections: 6, actions: 5 } as const;

/** Chấm điểm + sắp xếp (điểm cao trước, giữ thứ tự khai báo khi bằng điểm) + cắt theo GROUP_LIMITS. */
export function rankStatic(items: readonly StaticSearchItem[], query: string, t: Dict): RankedItem<StaticSearchItem>[] {
  const ranked: RankedItem<StaticSearchItem>[] = [];
  for (const item of items) {
    const label = item.label(t);
    const desc = item.desc?.(t);
    const m = matchItem(query, { label, desc, keywords: item.keywords });
    if (m) ranked.push({ item, label, desc, score: m.score, ranges: m.ranges });
  }
  ranked.sort((a, b) => b.score - a.score);
  const used = { pages: 0, sections: 0, actions: 0 };
  return ranked.filter((r) => used[r.item.group]++ < GROUP_LIMITS[r.item.group]);
}
