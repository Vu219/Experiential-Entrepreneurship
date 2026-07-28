import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePageSize } from '../../../hooks/usePageSize';
import {
  exportPostProblems, getPostProblemSummary, getPostProblems,
  type AdminPostPlatform, type AdminPostProblem, type PostProblemFilter, type PostProblemKind,
  type PostProblemSort, type PostProblemSummary, type PublishErrorType,
} from '../../../api/admin';
export type { AdminPostProblem };

// Toàn bộ logic dữ liệu của trang "Bài đăng lỗi & bị từ chối": đọc/ghi bộ lọc trên URL, tải
// summary (4 thẻ KPI + badge số lượng tab) và trang danh sách, export CSV. Component chỉ trình bày.
//
// Nguồn sự thật là URL query (giống trang Doanh thu) để reload/chia sẻ link giữ nguyên trạng thái;
// riêng số dòng/trang nằm ở localStorage qua usePageSize vì đó là thói quen của người dùng.

export type Load = 'loading' | 'error' | 'ok';

const DEFAULT_RANGE_DAYS = 7;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Mặc định: 7 ngày gần nhất, tính CẢ hôm nay. */
function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (DEFAULT_RANGE_DAYS - 1));
  return { from: iso(start), to: iso(today) };
}

const PLATFORMS: AdminPostPlatform[] = ['FB', 'IG', 'TH'];
const ERROR_TYPES: PublishErrorType[] = ['TEMPORARY', 'PERMANENT', 'POLICY_VIOLATION'];

/** Chỉ nhận giá trị nằm trong danh sách hợp lệ — URL do người dùng sửa được, đừng tin thẳng. */
const oneOf = <T extends string>(raw: string | null, allowed: T[]): T | undefined =>
  allowed.includes(raw as T) ? (raw as T) : undefined;

export interface PostProblemsState {
  kind: PostProblemKind;
  filter: PostProblemFilter;
  sort: PostProblemSort;
  range: { from: string; to: string };
  /** Số bộ lọc đang lệch mặc định (nền tảng / loại lỗi / tìm kiếm) — hiện trên nút "Bộ lọc". */
  activeFilters: number;

  summary: PostProblemSummary | null;
  summaryLoad: Load;
  rows: AdminPostProblem[];
  listLoad: Load;
  total: number;
  pageCount: number;
  page: number;
  pageSize: number;

  exporting: boolean;

  /** Bài đang mở ở panel chi tiết — nằm trên URL (?postId=) nên F5 không mất. */
  selected: AdminPostProblem | null;
  selectedId: string | null;

  setKind: (kind: PostProblemKind) => void;
  setSelectedId: (postId: string | null) => void;
  setRange: (range: { from: string; to: string }) => void;
  setPlatform: (platform?: AdminPostPlatform) => void;
  setErrorType: (errorType?: PublishErrorType) => void;
  setQuery: (q: string) => void;
  setSort: (sort: PostProblemSort) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  resetFilters: () => void;
  reloadSummary: () => void;
  reloadList: () => void;
  /** Trả về CSV; ném lỗi để trang hiển thị toast bằng thông điệp của backend. */
  runExport: () => Promise<string>;
}

export function usePostProblems(): PostProblemsState {
  const [params, setParams] = useSearchParams();
  const [pageSize, setPageSize] = usePageSize('admin-posts');

  const fallbackRange = useMemo(defaultRange, []);
  const kind: PostProblemKind = params.get('tab') === 'system' ? 'system' : 'rejected';
  const range = {
    from: params.get('from') || fallbackRange.from,
    to: params.get('to') || fallbackRange.to,
  };
  const platform = oneOf(params.get('platform'), PLATFORMS);
  const errorType = oneOf(params.get('errorType'), ERROR_TYPES);
  const q = params.get('q') ?? '';
  const sort: PostProblemSort = params.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const page = Math.max(Number(params.get('page') ?? '1') || 1, 1);

  const filter: PostProblemFilter = useMemo(
    () => ({ kind, platform, errorType, from: range.from, to: range.to, q: q || undefined }),
    [kind, platform, errorType, range.from, range.to, q],
  );

  const patch = useCallback((next: Record<string, string | undefined>, resetPage = true) => {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '') merged.delete(key);
      else merged.set(key, value);
    });
    if (resetPage) merged.delete('page');
    setParams(merged, { replace: true });
  }, [params, setParams]);

  // ---- Summary: chỉ phụ thuộc khoảng ngày, KHÔNG phụ thuộc tab/bộ lọc nhanh ----
  // (4 thẻ KPI và badge 2 tab đều là con số của cả kỳ, đổi tab không được làm chúng nhảy.)
  const [summary, setSummary] = useState<PostProblemSummary | null>(null);
  const [summaryLoad, setSummaryLoad] = useState<Load>('loading');
  const [summaryNonce, setSummaryNonce] = useState(0);

  // `kind` chỉ đổi PHẠM VI của thẻ "Tổng" + "Người dùng bị ảnh hưởng"; badge 2 tab vẫn đọc
  // policyViolation/technical nên không nhảy số khi chuyển tab.
  useEffect(() => {
    let alive = true;
    setSummaryLoad('loading');
    getPostProblemSummary(kind, range)
      .then((s) => { if (alive) { setSummary(s); setSummaryLoad('ok'); } })
      .catch(() => { if (alive) setSummaryLoad('error'); });
    return () => { alive = false; };
  }, [kind, range.from, range.to, summaryNonce]);

  // ---- Danh sách: lọc/tìm/sắp xếp/phân trang đều server-side ----
  const [rows, setRows] = useState<AdminPostProblem[]>([]);
  const [listLoad, setListLoad] = useState<Load>('loading');
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [listNonce, setListNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setListLoad('loading');
    // Debounce chung 300ms để gõ ô tìm kiếm không bắn một request mỗi phím (như tab log lỗi).
    const timer = setTimeout(() => {
      getPostProblems({ ...filter, sort, page: page - 1, size: pageSize })
        .then((p) => {
          if (!alive) return;
          setRows(p.rows); setTotal(p.total); setPageCount(p.pageCount); setListLoad('ok');
        })
        .catch(() => { if (alive) setListLoad('error'); });
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [filter, sort, page, pageSize, listNonce]);

  // Bài đang chọn giữ trên URL, nhưng bản ghi thì lấy từ trang đang hiển thị — đổi bộ lọc/trang
  // mà bài đó không còn trong danh sách thì panel tự đóng thay vì hiện dữ liệu mồ côi.
  const selectedId = params.get('postId');
  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;

  const [exporting, setExporting] = useState(false);
  const runExport = useCallback(async () => {
    setExporting(true);
    try {
      return await exportPostProblems(filter);
    } finally {
      setExporting(false);
    }
  }, [filter]);

  return {
    kind,
    filter,
    sort,
    range,
    activeFilters: (platform ? 1 : 0) + (errorType ? 1 : 0) + (q ? 1 : 0),

    summary,
    summaryLoad,
    rows,
    listLoad,
    total,
    pageCount,
    page,
    pageSize,
    exporting,
    selected,
    selectedId,

    // Đổi tab thì bỏ luôn bài đang chọn — bài đó thuộc tập kết quả của tab cũ.
    setKind: (next) => patch({ tab: next === 'system' ? 'system' : undefined, postId: undefined }),
    setSelectedId: (postId) => patch({ postId: postId ?? undefined }, false),
    setRange: (next) => patch({ from: next.from, to: next.to }),
    setPlatform: (next) => patch({ platform: next }),
    setErrorType: (next) => patch({ errorType: next }),
    setQuery: (next) => patch({ q: next }),
    setSort: (next) => patch({ sort: next === 'oldest' ? 'oldest' : undefined }),
    setPage: (next) => patch({ page: next > 1 ? String(next) : undefined }, false),
    setPageSize,
    resetFilters: () => patch({ platform: undefined, errorType: undefined, q: undefined }),
    reloadSummary: () => setSummaryNonce((n) => n + 1),
    reloadList: () => setListNonce((n) => n + 1),
    runExport,
  };
}
