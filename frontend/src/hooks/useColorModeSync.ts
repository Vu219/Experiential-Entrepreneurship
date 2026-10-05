import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { applyDarkClass, resolveDark } from '../store/colorMode';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

/** Gắn/gỡ class "dark" trên <html> theo lựa chọn + hệ điều hành + route đã hỗ trợ.
 *  Gọi MỘT lần ở App. Lần tải đầu đã được inline script trong index.html áp trước paint. */
export function useColorModeSync(): void {
  const mode = useAppStore((s) => s.colorMode);
  const { pathname } = useLocation();
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(SYSTEM_DARK_QUERY).matches
  );

  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia(SYSTEM_DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  useEffect(() => {
    applyDarkClass(resolveDark({ mode, systemDark, pathname }));
  }, [mode, systemDark, pathname]);
}
