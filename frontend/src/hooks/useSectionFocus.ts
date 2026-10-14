import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Chờ phần tử xuất hiện tối đa ~5s (khối trang thường chỉ render sau khi API trả dữ liệu). */
const WAIT_MS = 5000;
const POLL_MS = 100;
const FLASH_CLASS = 'search-focus-flash';
const FLASH_MS = 2400;

/**
 * Ô tìm kiếm toàn cục → "Khu vực trong trang": URL mang `?focus=<id>` → chờ phần tử `id` xuất hiện, cuộn tới
 * (chừa chiều cao topbar sticky), tô sáng tạm thời rồi XÓA tham số (tải lại trang không cuộn lại).
 * Quá hạn mà không thấy phần tử (vd khối "Hoàn tất thiết lập" đã ẩn) → bỏ qua lặng lẽ, vẫn xóa tham số.
 * Gắn MỘT lần ở AppShell — trang chỉ cần đặt `id` trên khối.
 */
export function useSectionFocus() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const focusId = new URLSearchParams(search).get('focus');

  useEffect(() => {
    if (!focusId) return;
    const clearParam = () => {
      const params = new URLSearchParams(window.location.search);
      params.delete('focus');
      const rest = params.toString();
      navigate({ pathname, search: rest ? `?${rest}` : '' }, { replace: true });
    };
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const tryFocus = () => {
      const el = document.getElementById(focusId);
      if (!el) return false;
      el.style.scrollMarginTop = 'calc(var(--app-header-height) + 16px)';
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      // Đưa focus bàn phím/trình đọc màn hình tới khối mà không giật cuộn lần nữa.
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
      el.classList.remove(FLASH_CLASS);
      void el.offsetWidth; // chạy lại animation nếu chọn lại cùng khối
      el.classList.add(FLASH_CLASS);
      // Hẹn giờ gỡ KHÔNG gắn với cleanup của effect: xóa `?focus=` làm effect chạy lại ngay sau đó.
      setTimeout(() => el.classList.remove(FLASH_CLASS), FLASH_MS);
      return true;
    };

    const started = Date.now();
    const poll = setInterval(() => {
      if (tryFocus() || Date.now() - started > WAIT_MS) {
        clearInterval(poll);
        clearParam();
      }
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [focusId, pathname, navigate]);
}
