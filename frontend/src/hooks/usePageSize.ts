import { useCallback, useState } from 'react';

/** Các lựa chọn số dòng/trang dùng chung cho mọi bảng quản trị. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

/**
 * Số dòng KHỞI TẠO theo bề rộng màn hình. Dùng đúng 3 bucket của `useBreakpoint`
 * (<760 / 760–1024 / >1024) để cả dự án chỉ có MỘT bộ breakpoint — không tự đặt mốc mới.
 *
 * Mobile trả 5: nằm ngoài PAGE_SIZE_OPTIONS là CỐ Ý — đây chỉ là giá trị mở màn cho màn
 * hình hẹp, còn selector vẫn chỉ cho chọn 10/20/50.
 */
export function defaultPageSize(width: number): number {
  if (width < 760) return 5;
  if (width <= 1024) return 10;
  return 20;
}

const storageKeyOf = (scope: string) => `aima_page_size_${scope}`;

/**
 * Số dòng/trang có ghi nhớ: khởi tạo theo kích thước màn hình, nhưng LỰA CHỌN CỦA USER
 * được ưu tiên tuyệt đối và lưu vào localStorage theo `scope` (mỗi bảng một khoá riêng).
 *
 * Cố ý KHÔNG đổi lại khi user kéo giãn cửa sổ: bề rộng chỉ là giá trị mở màn, đổi ngầm
 * số dòng dưới chân người đang đọc là hành vi khó chịu.
 */
export function usePageSize(scope: string): [number, (size: number) => void] {
  const [size, setSize] = useState<number>(() => {
    if (typeof window === 'undefined') return 10;
    const saved = Number(window.localStorage.getItem(storageKeyOf(scope)));
    if (Number.isFinite(saved) && saved > 0) return saved;
    return defaultPageSize(window.innerWidth);
  });

  const update = useCallback(
    (next: number) => {
      setSize(next);
      try {
        window.localStorage.setItem(storageKeyOf(scope), String(next));
      } catch {
        // Safari private mode / quota đầy — không lưu được thì thôi, không phá luồng.
      }
    },
    [scope],
  );

  return [size, update];
}
