// Chế độ sáng/tối (dark mode) — logic thuần, không phụ thuộc React.
// Áp bằng class "dark" trên <html> → mọi var(--c-*) ở styles/tokens.css đổi theo.
// Tách khỏi `theme` (bảng màu thương hiệu, data-theme) của useAppStore.

export type ColorMode = 'light' | 'dark' | 'system';

export const COLOR_MODES: readonly ColorMode[] = ['light', 'dark', 'system'];
export const DEFAULT_COLOR_MODE: ColorMode = 'light';

/** Cờ tắt cho phép rollback về giao diện sáng. */
export const DARK_MODE_ENABLED = import.meta.env?.VITE_ENABLE_DARK_MODE === 'true';

/** Các route đã hỗ trợ tối, gồm app, admin và khu vực công khai.
 *  ĐỒNG BỘ với inline script trong index.html (áp trước paint) — tests/colorMode.test.ts kiểm tra. */
export const DARK_CAPABLE_PREFIXES: readonly string[] = [
  '/dashboard', '/create', '/calendar', '/failed-posts', '/analytics', '/trends', '/brand',
  '/billing', '/usage', '/profile', '/settings', '/admin',
  '/', '/pricing', '/login', '/register', '/logout', '/forgot-password',
  '/auth/google/callback', '/complete-profile', '/privacy', '/terms', '/data-deletion',
];

export const isDarkCapablePath = (pathname: string): boolean =>
  DARK_CAPABLE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));

export function resolveDark(opts: {
  mode: ColorMode;
  systemDark: boolean;
  pathname: string;
  enabled?: boolean;
}): boolean {
  const { mode, systemDark, pathname, enabled = DARK_MODE_ENABLED } = opts;
  if (!enabled || !isDarkCapablePath(pathname)) return false;
  return mode === 'dark' || (mode === 'system' && systemDark);
}

const isColorMode = (v: unknown): v is ColorMode => COLOR_MODES.includes(v as ColorMode);

/** Nơi DUY NHẤT đọc/ghi lựa chọn của người dùng. Hiện chỉ localStorage (key cũng được
 *  index.html đọc). Thêm đồng bộ backend sau này: sửa `save` (gọi API) và gọi
 *  useAppStore.getState().setColorMode(<giá trị từ profile>) sau khi tải user. */
export const COLOR_MODE_KEY = 'aima-color-mode';
export const colorModeStorage = {
  load(): ColorMode {
    try {
      const v = localStorage.getItem(COLOR_MODE_KEY);
      return isColorMode(v) ? v : DEFAULT_COLOR_MODE;
    } catch {
      return DEFAULT_COLOR_MODE;
    }
  },
  save(mode: ColorMode): void {
    try {
      localStorage.setItem(COLOR_MODE_KEY, mode);
    } catch {
      /* chế độ riêng tư — bỏ qua, vẫn áp trong phiên */
    }
  },
};

export function applyDarkClass(dark: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', dark);
}
