import { useCallback, useEffect, useState } from 'react';
import { globalSearch, type GlobalSearchResult } from '../api/search';

/** Gõ dừng bao lâu mới gọi API. */
const DEBOUNCE_MS = 250;
/** Ít hơn số ký tự này thì không tìm dữ liệu (chỉ tìm trang/chức năng ở client). */
export const MIN_DATA_QUERY = 2;

export type DataSearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; query: string; result: GlobalSearchResult };

/**
 * Nhóm "Dữ liệu" của ô tìm kiếm toàn cục: debounce, huỷ request cũ khi gõ tiếp (AbortController — kết quả về muộn
 * không đè kết quả mới), trạng thái loading/error/ok + `retry`. `enabled=false` (khu quản trị) → luôn idle.
 */
export function useDataSearch(query: string, enabled: boolean): [DataSearchState, () => void] {
  const q = query.trim();
  const active = enabled && q.length >= MIN_DATA_QUERY;
  const [state, setState] = useState<DataSearchState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      globalSearch(q, controller.signal)
        .then((result) => setState({ status: 'ok', query: q, result }))
        .catch(() => {
          if (!controller.signal.aborted) setState({ status: 'error' });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, q, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return [state, retry];
}
