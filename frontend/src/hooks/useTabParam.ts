import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Tab của trang lấy từ query `?tab=` (URL là nguồn sự thật, cùng mẫu Cài đặt / Doanh thu) — ô tìm kiếm toàn cục và
 * link ngoài mở thẳng được một tab; tải lại trang giữ nguyên tab. Giá trị lạ → tab mặc định; chọn tab mặc định thì
 * bỏ hẳn tham số cho URL gọn. Các tham số khác trên URL được giữ nguyên.
 */
export function useTabParam<T extends string>(allowed: readonly T[], fallback: T, key = 'tab'): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const tab = raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;

  const setTab = useCallback((next: T) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === fallback) p.delete(key);
      else p.set(key, next);
      return p;
    }, { replace: true });
  }, [setParams, fallback, key]);

  return [tab, setTab];
}
