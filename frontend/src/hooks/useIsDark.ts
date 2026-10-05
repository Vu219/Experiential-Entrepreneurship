import { useEffect, useState } from 'react';

const isDarkNow = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark') && !window.matchMedia('print').matches;

/** true khi <html> đang có class "dark" (đã tính cờ, lựa chọn, hệ điều hành, route — xem useColorModeSync).
 *  Bản in dùng logo sáng. Chỉ dùng cho thứ CSS không đổi được (src ảnh logo…); màu dùng token. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(isDarkNow);
  useEffect(() => {
    const sync = () => setDark(isDarkNow());
    const print = window.matchMedia('print');
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    print.addEventListener('change', sync);
    sync();
    return () => { obs.disconnect(); print.removeEventListener('change', sync); };
  }, []);
  return dark;
}
